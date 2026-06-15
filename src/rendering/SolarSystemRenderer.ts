import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type {
  MasslessBodyState,
  MasslessOrbitalBody,
  OrbitalParticle,
  ParticleBeltDefinition,
} from "../domain/orbits";
import type { MutableBodyState } from "../domain/types";
import { add, subtract } from "../domain/vector";
import { ASTRONOMICAL_UNIT_M, DAY_SECONDS } from "../physics/constants";
import {
  J2000_JULIAN_DAY,
  propagateEllipticOrbit,
  sampleOrbitPath,
  stateToOsculatingElements,
} from "../physics/orbitalMechanics";
import {
  DEFAULT_DISTANCE_SCALE,
  scaleDistanceForDisplay,
  type DistanceScaleConfig,
} from "./distanceScale";

const MAX_TRAIL_POINTS = 900;
const TRAIL_SAMPLE_SECONDS = 10 * DAY_SECONDS;
const ORBIT_REFRESH_SECONDS = 30 * DAY_SECONDS;

interface BodyView {
  readonly mesh: THREE.Mesh;
  readonly label: HTMLDivElement;
  readonly trail: THREE.Line;
  readonly orbit: THREE.Line;
  readonly trailPoints: THREE.Vector3[];
  lastTrailSampleSeconds: number;
}

interface CometView {
  readonly mesh: THREE.Mesh;
  readonly label: HTMLDivElement;
  readonly orbit: THREE.Line;
  readonly tail: THREE.Line;
}

interface BeltView {
  readonly definition: ParticleBeltDefinition;
  readonly particles: readonly OrbitalParticle[];
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  readonly positions: Float32Array;
}

export class SolarSystemRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly controls: OrbitControls;
  private readonly bodyViews = new Map<string, BodyView>();
  private readonly cometViews = new Map<string, CometView>();
  private readonly beltViews = new Map<string, BeltView>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private trailsVisible = true;
  private labelsVisible = true;
  private planetPathsVisible = true;
  private cometPathsVisible = true;
  private cometTailsVisible = true;
  private distanceScale: DistanceScaleConfig = DEFAULT_DISTANCE_SCALE;
  private selectionHandler: ((id: string) => void) | undefined;
  private lastOrbitRefreshSeconds = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly container: HTMLElement,
    private readonly labelsContainer: HTMLElement,
    bodies: readonly Readonly<MutableBodyState>[],
    comets: readonly MasslessOrbitalBody[],
    belts: readonly {
      readonly definition: ParticleBeltDefinition;
      readonly particles: readonly OrbitalParticle[];
    }[],
    private readonly centralMassKg: number,
  ) {
    const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
    this.camera = new THREE.OrthographicCamera(-55 * aspect, 55 * aspect, 55, -55, 0.1, 500);
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;
    this.controls.minZoom = 0.1;
    this.controls.maxZoom = 300;

    this.addBackground();
    this.createBodyViews(bodies);
    this.createCometViews(comets);
    this.createBeltViews(belts);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
  }

  onBodySelected(handler: (id: string) => void): void {
    this.selectionHandler = handler;
  }

  update(
    bodies: readonly Readonly<MutableBodyState>[],
    comets: readonly MasslessBodyState[],
    elapsedSeconds: number,
  ): void {
    const sun = bodies.find((body) => body.id === "sun");
    if (!sun) return;
    for (const body of bodies) {
      const view = this.bodyViews.get(body.id);
      if (!view) continue;
      const scenePosition = this.toScenePosition(body.positionM);
      view.mesh.position.copy(scenePosition);
      if (
        this.trailsVisible &&
        (view.trailPoints.length === 0 ||
          elapsedSeconds - view.lastTrailSampleSeconds >= TRAIL_SAMPLE_SECONDS)
      ) {
        view.trailPoints.push(scenePosition.clone());
        if (view.trailPoints.length > MAX_TRAIL_POINTS) view.trailPoints.shift();
        view.trail.geometry.setFromPoints(view.trailPoints);
        view.lastTrailSampleSeconds = elapsedSeconds;
      }
    }

    for (const cometState of comets) {
      const view = this.cometViews.get(cometState.body.id);
      if (!view) continue;
      const absolutePosition = add(sun.positionM, cometState.positionM);
      const scenePosition = this.toScenePosition(absolutePosition);
      view.mesh.position.copy(scenePosition);
      this.updateCometTail(view, scenePosition, this.toScenePosition(sun.positionM));
    }

    const julianDay = J2000_JULIAN_DAY + elapsedSeconds / DAY_SECONDS;
    this.updateBelts(julianDay, this.toScenePosition(sun.positionM));
    if (
      elapsedSeconds - this.lastOrbitRefreshSeconds >= ORBIT_REFRESH_SECONDS ||
      elapsedSeconds === 0
    ) {
      this.updateOrbitPaths(bodies, comets, sun);
      this.lastOrbitRefreshSeconds = elapsedSeconds;
    }
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }

  setTrailsVisible(visible: boolean): void {
    this.trailsVisible = visible;
    for (const view of this.bodyViews.values()) view.trail.visible = visible;
  }

  setPlanetPathsVisible(visible: boolean): void {
    this.planetPathsVisible = visible;
    for (const [id, view] of this.bodyViews) view.orbit.visible = visible && id !== "sun";
  }

  setCometPathsVisible(visible: boolean): void {
    this.cometPathsVisible = visible;
    for (const view of this.cometViews.values()) view.orbit.visible = visible;
  }

  setCometTailsVisible(visible: boolean): void {
    this.cometTailsVisible = visible;
    for (const view of this.cometViews.values()) view.tail.visible = visible;
  }

  setBeltVisible(id: ParticleBeltDefinition["id"], visible: boolean): void {
    const belt = this.beltViews.get(id);
    if (belt) belt.points.visible = visible;
  }

  setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible;
    this.labelsContainer.style.display = visible ? "block" : "none";
  }

  setDistanceScale(scaleFactor: number): void {
    this.distanceScale = { scaleFactor };
    this.clearTrails();
  }

  selectBody(id: string): void {
    for (const [bodyId, view] of this.bodyViews) {
      this.styleSelection(view.mesh, view.label, bodyId === id);
    }
    for (const [bodyId, view] of this.cometViews) {
      this.styleSelection(view.mesh, view.label, bodyId === id);
    }
  }

  focusBody(id: string): void {
    const view = this.bodyViews.get(id) ?? this.cometViews.get(id);
    if (!view) return;
    this.controls.target.copy(view.mesh.position);
    this.camera.position.x = view.mesh.position.x;
    this.camera.position.y = view.mesh.position.y;
    this.camera.zoom = Math.max(this.camera.zoom, id === "sun" ? 5 : 14);
    this.camera.updateProjectionMatrix();
  }

  fitSystem(): void {
    this.frameAt(55 * this.distanceScale.scaleFactor);
  }

  fitInnerSystem(): void {
    this.frameAt(6.5 * this.distanceScale.scaleFactor);
  }

  clearTrails(): void {
    for (const view of this.bodyViews.values()) {
      view.trailPoints.length = 0;
      view.trail.geometry.setFromPoints([]);
      view.lastTrailSampleSeconds = Number.NEGATIVE_INFINITY;
    }
    this.lastOrbitRefreshSeconds = Number.NEGATIVE_INFINITY;
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.controls.dispose();
    this.renderer.dispose();
    for (const view of this.bodyViews.values()) view.label.remove();
    for (const view of this.cometViews.values()) view.label.remove();
  }

  private createBodyViews(bodies: readonly Readonly<MutableBodyState>[]): void {
    for (const body of bodies) {
      const visibleRadius =
        body.category === "star"
          ? 0.5
          : Math.max(0.11, Math.min(0.38, Math.log10(body.radiusM) * 0.075 - 0.35));
      const mesh = this.createDisc(body.id, visibleRadius, body.visual.color);
      if (body.id === "sun") this.addSunGlow(mesh, body.visual.emissive ?? body.visual.color);
      if (body.id === "saturn") this.addSaturnRing(mesh, visibleRadius);
      const label = this.createLabel(body.name);
      const trail = this.createLine(body.visual.color, body.category === "star" ? 0.08 : 0.28);
      const orbit = this.createLine(body.visual.color, body.category === "star" ? 0 : 0.18);
      orbit.visible = body.id !== "sun";
      this.bodyViews.set(body.id, {
        mesh,
        label,
        trail,
        orbit,
        trailPoints: [],
        lastTrailSampleSeconds: Number.NEGATIVE_INFINITY,
      });
    }
  }

  private createCometViews(comets: readonly MasslessOrbitalBody[]): void {
    for (const comet of comets) {
      const mesh = this.createDisc(comet.id, 0.13, comet.visual.color);
      const label = this.createLabel(comet.name);
      const orbit = this.createLine(comet.visual.color, 0.24);
      const tail = this.createLine(comet.visual.color, 0.7);
      this.cometViews.set(comet.id, { mesh, label, orbit, tail });
    }
  }

  private createBeltViews(
    belts: readonly {
      readonly definition: ParticleBeltDefinition;
      readonly particles: readonly OrbitalParticle[];
    }[],
  ): void {
    for (const belt of belts) {
      const positions = new Float32Array(belt.particles.length * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: belt.definition.color,
        size: belt.definition.id === "main-belt" ? 1.25 : 1,
        sizeAttenuation: false,
        transparent: true,
        opacity: belt.definition.opacity,
        depthWrite: false,
      });
      const points = new THREE.Points(geometry, material);
      points.renderOrder = -1;
      this.scene.add(points);
      this.beltViews.set(belt.definition.id, {
        definition: belt.definition,
        particles: belt.particles,
        points,
        positions,
      });
    }
  }

  private updateBelts(julianDay: number, sunScenePosition: THREE.Vector3): void {
    for (const belt of this.beltViews.values()) {
      for (let index = 0; index < belt.particles.length; index += 1) {
        const particle = belt.particles[index];
        if (!particle) continue;
        const state = propagateEllipticOrbit(
          particle.elements,
          julianDay,
          this.centralMassKg,
        );
        const offset = index * 3;
        const displayPosition = this.toScenePosition(state.positionM);
        belt.positions[offset] = displayPosition.x + sunScenePosition.x;
        belt.positions[offset + 1] = displayPosition.y + sunScenePosition.y;
        belt.positions[offset + 2] = displayPosition.z + sunScenePosition.z;
      }
      const attribute = belt.points.geometry.getAttribute("position");
      if (attribute instanceof THREE.BufferAttribute) attribute.needsUpdate = true;
    }
  }

  private updateOrbitPaths(
    bodies: readonly Readonly<MutableBodyState>[],
    comets: readonly MasslessBodyState[],
    sun: Readonly<MutableBodyState>,
  ): void {
    for (const body of bodies) {
      if (body.id === "sun") continue;
      const view = this.bodyViews.get(body.id);
      if (!view) continue;
      const relativePosition = subtract(body.positionM, sun.positionM);
      const relativeVelocity = subtract(body.velocityMps, sun.velocityMps);
      const elements = stateToOsculatingElements(
        relativePosition,
        relativeVelocity,
        this.centralMassKg + body.massKg,
        J2000_JULIAN_DAY,
      );
      const points = sampleOrbitPath(elements).map((point) =>
        this.toScenePosition(add(point, sun.positionM)),
      );
      view.orbit.geometry.setFromPoints(points);
      view.orbit.visible = this.planetPathsVisible;
    }
    for (const comet of comets) {
      const view = this.cometViews.get(comet.body.id);
      if (!view) continue;
      const elements = stateToOsculatingElements(
        comet.positionM,
        comet.velocityMps,
        this.centralMassKg,
        J2000_JULIAN_DAY,
      );
      view.orbit.geometry.setFromPoints(
        sampleOrbitPath(elements, 320).map((point) =>
          this.toScenePosition(add(point, sun.positionM)),
        ),
      );
      view.orbit.visible = this.cometPathsVisible;
    }
  }

  private updateCometTail(
    view: CometView,
    cometPosition: THREE.Vector3,
    sunPosition: THREE.Vector3,
  ): void {
    const away = cometPosition.clone().sub(sunPosition);
    const distanceAu = Math.max(away.length(), 0.1);
    const activity = Math.max(0, Math.min(1, (6 - distanceAu) / 5));
    const lengthAu = 0.08 + activity * 0.65;
    away.normalize().multiplyScalar(lengthAu);
    view.tail.geometry.setFromPoints([cometPosition, cometPosition.clone().add(away)]);
    const material = view.tail.material;
    if (material instanceof THREE.LineBasicMaterial) material.opacity = activity * 0.72;
    view.tail.visible = this.cometTailsVisible && activity > 0.02;
  }

  private createDisc(id: string, radius: number, color: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    mesh.userData.bodyId = id;
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    return mesh;
  }

  private createLabel(text: string): HTMLDivElement {
    const label = document.createElement("div");
    label.className = "body-label";
    label.textContent = text;
    this.labelsContainer.append(label);
    return label;
  }

  private createLine(color: number, opacity: number): THREE.Line {
    const line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
    line.renderOrder = 0;
    this.scene.add(line);
    return line;
  }

  private addSunGlow(mesh: THREE.Mesh, color: number): void {
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.86, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13 }),
    );
    glow.renderOrder = 1;
    mesh.add(glow);
  }

  private addSaturnRing(mesh: THREE.Mesh, radius: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.25, radius * 1.8, 48),
      new THREE.MeshBasicMaterial({
        color: 0xbda77a,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    ring.renderOrder = 1;
    mesh.add(ring);
  }

  private styleSelection(mesh: THREE.Mesh, label: HTMLDivElement, selected: boolean): void {
    if (mesh.material instanceof THREE.MeshBasicMaterial) {
      mesh.material.opacity = selected ? 1 : 0.86;
    }
    label.style.color = selected ? "#e6b35b" : "#aeb6c6";
  }

  private frameAt(verticalExtent: number): void {
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 0, 100);
    this.camera.zoom = 55 / verticalExtent;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private addBackground(): void {
    const positions: number[] = [];
    let seed = 90_210;
    const random = (): number => {
      seed = (seed * 16_807) % 2_147_483_647;
      return (seed - 1) / 2_147_483_646;
    };
    for (let index = 0; index < 700; index += 1) {
      positions.push((random() - 0.5) * 180, (random() - 0.5) * 120, -2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.scene.add(
      new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: 0x8b94a8,
          size: 0.045,
          transparent: true,
          opacity: 0.65,
          sizeAttenuation: false,
        }),
      ),
    );
  }

  private updateLabels(): void {
    if (!this.labelsVisible) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const entries = [
      ...[...this.bodyViews.values()].map((view) => ({ mesh: view.mesh, label: view.label })),
      ...[...this.cometViews.values()].map((view) => ({ mesh: view.mesh, label: view.label })),
    ];
    for (const view of entries) {
      const screen = view.mesh.position.clone().project(this.camera);
      const visible = Math.abs(screen.x) <= 1.1 && Math.abs(screen.y) <= 1.1;
      view.label.style.display = visible ? "block" : "none";
      view.label.style.left = `${(screen.x * 0.5 + 0.5) * width}px`;
      view.label.style.top = `${(-screen.y * 0.5 + 0.5) * height}px`;
    }
  }

  private readonly resize = (): void => {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const verticalExtent = 55;
    const aspect = width / height;
    this.camera.left = -verticalExtent * aspect;
    this.camera.right = verticalExtent * aspect;
    this.camera.top = verticalExtent;
    this.camera.bottom = -verticalExtent;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [
      ...[...this.bodyViews.values()].map((view) => view.mesh),
      ...[...this.cometViews.values()].map((view) => view.mesh),
    ];
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    const id = hit?.object.userData.bodyId;
    if (typeof id === "string") {
      this.selectBody(id);
      this.selectionHandler?.(id);
    }
  };

  private toScenePosition(positionM: { x: number; y: number; z: number }): THREE.Vector3 {
    const displayPosition = scaleDistanceForDisplay(positionM, this.distanceScale);
    return new THREE.Vector3(
      displayPosition.x / ASTRONOMICAL_UNIT_M,
      displayPosition.y / ASTRONOMICAL_UNIT_M,
      displayPosition.z / ASTRONOMICAL_UNIT_M,
    );
  }
}
