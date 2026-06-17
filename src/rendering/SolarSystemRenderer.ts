import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type {
  HierarchicalBodyState,
  HierarchicalOrbitalBody,
  MasslessBodyState,
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
import { shouldShowMoon } from "./moonVisibility";
import { resolveViewFrameOrigin, type ViewFrame } from "./viewFrame";

const TRAIL_SAMPLE_SECONDS = 10 * DAY_SECONDS;
const ORBIT_REFRESH_SECONDS = 30 * DAY_SECONDS;
const MOON_VISIBILITY_ZOOM = 28;
const LOCAL_ORBIT_DISPLAY_SCALE = 80;

export type { ViewFrame } from "./viewFrame";
export type TrailMode = "off" | "selected" | "planets" | "all";
export type TrailLengthPreset = "short" | "medium" | "long";

const TRAIL_POINT_LIMITS: Readonly<Record<TrailLengthPreset, number>> = {
  short: 180,
  medium: 900,
  long: 2_400,
};

interface BodyView {
  readonly mesh: THREE.Mesh;
  readonly label: HTMLDivElement;
  readonly trail: THREE.Line;
  readonly orbit: THREE.Line;
  readonly trailPoints: THREE.Vector3[];
  lastTrailSampleSeconds: number;
}

interface OrbitalBodyView {
  readonly body: HierarchicalOrbitalBody;
  readonly mesh: THREE.Mesh;
  readonly label: HTMLDivElement;
  readonly orbit: THREE.Line;
  readonly tail?: THREE.Line;
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
  private readonly orbitalViews = new Map<string, OrbitalBodyView>();
  private readonly beltViews = new Map<string, BeltView>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private trailsVisible = true;
  private labelsVisible = true;
  private planetPathsVisible = true;
  private cometPathsVisible = true;
  private cometTailsVisible = true;
  private moonsVisible = true;
  private distanceScale: DistanceScaleConfig = DEFAULT_DISTANCE_SCALE;
  private viewFrame: ViewFrame = "barycentric";
  private viewFrameOriginM = { x: 0, y: 0, z: 0 };
  private trailMode: TrailMode = "all";
  private trailPointLimit = TRAIL_POINT_LIMITS.medium;
  private selectionHandler: ((id: string) => void) | undefined;
  private followChangeHandler: ((id: string | undefined) => void) | undefined;
  private followBodyId: string | undefined;
  private selectedBodyId = "sun";
  private lastOrbitRefreshSeconds = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly container: HTMLElement,
    private readonly labelsContainer: HTMLElement,
    bodies: readonly Readonly<MutableBodyState>[],
    orbitalBodies: readonly HierarchicalOrbitalBody[],
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
    this.createOrbitalViews(orbitalBodies);
    this.createBeltViews(belts);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.controls.addEventListener("start", this.handleControlsStart);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
  }

  onBodySelected(handler: (id: string) => void): void {
    this.selectionHandler = handler;
  }

  onFollowChanged(handler: (id: string | undefined) => void): void {
    this.followChangeHandler = handler;
  }

  update(
    bodies: readonly Readonly<MutableBodyState>[],
    orbitalStates: readonly HierarchicalBodyState[],
    elapsedSeconds: number,
  ): void {
    const sun = bodies.find((body) => body.id === "sun");
    if (!sun) return;
    this.viewFrameOriginM = resolveViewFrameOrigin({
      frame: this.viewFrame,
      selectedBodyId: this.selectedBodyId,
      bodies,
      orbitalStates,
    });
    for (const body of bodies) {
      const view = this.bodyViews.get(body.id);
      if (!view) continue;
      const scenePosition = this.toScenePosition(body.positionM);
      view.mesh.position.copy(scenePosition);
      if (
        this.shouldShowTrailFor(body.id, body.category) &&
        (view.trailPoints.length === 0 ||
          elapsedSeconds - view.lastTrailSampleSeconds >= TRAIL_SAMPLE_SECONDS)
      ) {
        view.trailPoints.push(scenePosition.clone());
        while (view.trailPoints.length > this.trailPointLimit) view.trailPoints.shift();
        view.trail.geometry.setFromPoints(view.trailPoints);
        view.lastTrailSampleSeconds = elapsedSeconds;
      }
      view.trail.visible = this.shouldShowTrailFor(body.id, body.category);
    }

    for (const orbitalState of orbitalStates) {
      const view = this.orbitalViews.get(orbitalState.body.id);
      if (!view) continue;
      const scenePosition = this.orbitalStateToScenePosition(orbitalState);
      view.mesh.position.copy(scenePosition);
      if (orbitalState.body.category === "moon") {
        view.orbit.position.copy(this.toScenePosition(orbitalState.parentPositionM));
      }
      if (orbitalState.body.category === "comet" && view.tail) {
        this.updateCometTail(view.tail, scenePosition, this.toScenePosition(sun.positionM));
      }
    }

    const julianDay = J2000_JULIAN_DAY + elapsedSeconds / DAY_SECONDS;
    this.updateBelts(julianDay, this.toScenePosition(sun.positionM));
    if (
      elapsedSeconds - this.lastOrbitRefreshSeconds >= ORBIT_REFRESH_SECONDS ||
      elapsedSeconds === 0
    ) {
      this.updateOrbitPaths(bodies, orbitalStates, sun);
      this.lastOrbitRefreshSeconds = elapsedSeconds;
    }
    this.updateFollowTarget();
    this.updateMoonVisibility();
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }

  setTrailsVisible(visible: boolean): void {
    this.trailsVisible = visible;
    for (const [id, view] of this.bodyViews) {
      const category = view.mesh.userData.category;
      view.trail.visible =
        typeof category === "string" && this.shouldShowTrailFor(id, category);
    }
  }

  setTrailMode(mode: TrailMode, selectedBodyId = this.selectedBodyId): void {
    this.trailMode = mode;
    this.selectedBodyId = selectedBodyId;
    for (const [id, view] of this.bodyViews) {
      const category = view.mesh.userData.category;
      view.trail.visible =
        typeof category === "string" && this.shouldShowTrailFor(id, category);
    }
  }

  setTrailLengthPreset(preset: TrailLengthPreset): void {
    this.trailPointLimit = TRAIL_POINT_LIMITS[preset];
    for (const view of this.bodyViews.values()) {
      while (view.trailPoints.length > this.trailPointLimit) view.trailPoints.shift();
      view.trail.geometry.setFromPoints(view.trailPoints);
    }
  }

  setViewFrame(frame: ViewFrame, selectedBodyId = this.selectedBodyId): void {
    this.viewFrame = frame;
    this.selectedBodyId = selectedBodyId;
    this.clearTrails();
  }

  setPlanetPathsVisible(visible: boolean): void {
    this.planetPathsVisible = visible;
    for (const [id, view] of this.bodyViews) view.orbit.visible = visible && id !== "sun";
  }

  setCometPathsVisible(visible: boolean): void {
    this.cometPathsVisible = visible;
    for (const view of this.orbitalViews.values()) {
      if (view.body.category === "comet") view.orbit.visible = visible;
    }
  }

  setCometTailsVisible(visible: boolean): void {
    this.cometTailsVisible = visible;
    for (const view of this.orbitalViews.values()) {
      if (view.tail) view.tail.visible = visible;
    }
  }

  setMoonsVisible(visible: boolean): void {
    this.moonsVisible = visible;
    this.updateMoonVisibility();
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
    this.selectedBodyId = id;
    for (const [bodyId, view] of this.bodyViews) {
      this.styleSelection(view.mesh, view.label, bodyId === id);
    }
    for (const [bodyId, view] of this.orbitalViews) {
      this.styleSelection(view.mesh, view.label, bodyId === id);
    }
    this.updateMoonVisibility();
  }

  focusBody(id: string, follow = true): void {
    const view = this.bodyViews.get(id) ?? this.orbitalViews.get(id);
    if (!view) return;
    this.controls.target.copy(view.mesh.position);
    this.camera.position.x = view.mesh.position.x;
    this.camera.position.y = view.mesh.position.y;
    const hasMoons = [...this.orbitalViews.values()].some(
      (candidate) => candidate.body.category === "moon" && candidate.body.parentId === id,
    );
    const isMoon = "body" in view && view.body.category === "moon";
    this.camera.zoom = Math.max(
      this.camera.zoom,
      id === "sun" ? 5 : hasMoons || isMoon ? 90 : 14,
    );
    this.camera.updateProjectionMatrix();
    if (follow) this.setFollowBody(id);
  }

  setFollowBody(id: string | undefined): void {
    this.followBodyId = id;
    this.followChangeHandler?.(id);
  }

  stopFollowing(): void {
    this.setFollowBody(undefined);
  }

  fitSystem(): void {
    this.frameAt(55 * this.distanceScale.scaleFactor);
  }

  fitInnerSystem(): void {
    this.frameAt(6.5 * this.distanceScale.scaleFactor);
  }

  showAll(): void {
    this.stopFollowing();
    this.fitSystem();
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
    this.controls.removeEventListener("start", this.handleControlsStart);
    this.renderer.domElement.remove();
    this.renderer.dispose();
    for (const view of this.bodyViews.values()) view.label.remove();
    for (const view of this.orbitalViews.values()) view.label.remove();
    this.labelsContainer.replaceChildren();
  }

  private createBodyViews(bodies: readonly Readonly<MutableBodyState>[]): void {
    for (const body of bodies) {
      const visibleRadius =
        body.category === "star"
          ? 0.22
          : Math.max(0.11, Math.min(0.38, Math.log10(body.radiusM) * 0.075 - 0.35));
      const mesh = this.createDisc(body.id, visibleRadius, body.visual.color);
      mesh.userData.category = body.category;
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

  private createOrbitalViews(bodies: readonly HierarchicalOrbitalBody[]): void {
    for (const body of bodies) {
      const radius =
        body.category === "moon"
          ? Math.max(0.055, Math.min(0.13, Math.log10(body.radiusM) * 0.035 - 0.08))
          : body.category === "dwarf-planet"
            ? 0.15
            : 0.13;
      const mesh = this.createDisc(body.id, radius, body.visual.color);
      mesh.userData.category = body.category;
      const label = this.createLabel(body.name);
      const orbit = this.createLine(body.visual.color, body.category === "moon" ? 0.32 : 0.24);
      const tail =
        body.category === "comet" ? this.createLine(body.visual.color, 0.7) : undefined;
      this.orbitalViews.set(body.id, { body, mesh, label, orbit, tail });
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
        const displayPosition = this.toSceneOffset(state.positionM);
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
    orbitalStates: readonly MasslessBodyState[],
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
    for (const orbitalState of orbitalStates) {
      const view = this.orbitalViews.get(orbitalState.body.id);
      if (!view) continue;
      if (orbitalState.body.category === "moon") {
        view.orbit.geometry.setFromPoints(
          sampleOrbitPath(orbitalState.body.elements, 128).map((point) =>
            this.toLocalSceneOffset(point),
          ),
        );
      } else {
        view.orbit.geometry.setFromPoints(
          sampleOrbitPath(orbitalState.body.elements, 320).map((point) =>
            this.toScenePosition(add(point, orbitalState.parentPositionM)),
          ),
        );
      }
      view.orbit.visible =
        orbitalState.body.category === "comet" ? this.cometPathsVisible : true;
    }
  }

  private updateCometTail(
    tail: THREE.Line,
    cometPosition: THREE.Vector3,
    sunPosition: THREE.Vector3,
  ): void {
    const away = cometPosition.clone().sub(sunPosition);
    const distanceAu = Math.max(away.length(), 0.1);
    const activity = Math.max(0, Math.min(1, (6 - distanceAu) / 5));
    const lengthAu = 0.08 + activity * 0.65;
    away.normalize().multiplyScalar(lengthAu);
    tail.geometry.setFromPoints([cometPosition, cometPosition.clone().add(away)]);
    const material = tail.material;
    if (material instanceof THREE.LineBasicMaterial) material.opacity = activity * 0.72;
    tail.visible = this.cometTailsVisible && activity > 0.02;
  }

  private orbitalStateToScenePosition(state: HierarchicalBodyState): THREE.Vector3 {
    if (state.body.category !== "moon") return this.toScenePosition(state.positionM);
    return this.toScenePosition(state.parentPositionM).add(
      this.toLocalSceneOffset(state.relativePositionM),
    );
  }

  private toLocalSceneOffset(positionM: {
    x: number;
    y: number;
    z: number;
  }): THREE.Vector3 {
    return new THREE.Vector3(
      (positionM.x / ASTRONOMICAL_UNIT_M) * LOCAL_ORBIT_DISPLAY_SCALE,
      (positionM.y / ASTRONOMICAL_UNIT_M) * LOCAL_ORBIT_DISPLAY_SCALE,
      (positionM.z / ASTRONOMICAL_UNIT_M) * LOCAL_ORBIT_DISPLAY_SCALE,
    );
  }

  private updateMoonVisibility(): void {
    const selectedOrbital = this.orbitalViews.get(this.selectedBodyId)?.body;
    for (const view of this.orbitalViews.values()) {
      if (view.body.category !== "moon") continue;
      const visible = shouldShowMoon({
        enabled: this.moonsVisible,
        cameraZoom: this.camera.zoom,
        thresholdZoom: MOON_VISIBILITY_ZOOM,
        moonId: view.body.id,
        parentId: view.body.parentId,
        selectedBodyId: this.selectedBodyId,
        selectedParentId: selectedOrbital?.parentId,
      });
      view.mesh.visible = visible;
      view.orbit.visible = visible;
      if (!visible) view.label.style.display = "none";
    }
  }

  private updateFollowTarget(): void {
    if (!this.followBodyId) return;
    const view = this.bodyViews.get(this.followBodyId) ?? this.orbitalViews.get(this.followBodyId);
    if (!view) {
      this.setFollowBody(undefined);
      return;
    }
    const delta = view.mesh.position.clone().sub(this.controls.target);
    this.controls.target.copy(view.mesh.position);
    this.camera.position.add(delta);
  }

  private createDisc(id: string, radius: number, color: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    mesh.userData.bodyId = id;
    mesh.renderOrder = id === "sun" || id === "validation-primary" ? 1 : 3;
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
      new THREE.CircleGeometry(0.42, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13 }),
    );
    glow.renderOrder = 0;
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
      ...[...this.orbitalViews.values()].map((view) => ({ mesh: view.mesh, label: view.label })),
    ];
    for (const view of entries) {
      if (!view.mesh.visible) {
        view.label.style.display = "none";
        continue;
      }
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
      ...[...this.orbitalViews.values()]
        .filter((view) => view.mesh.visible)
        .map((view) => view.mesh),
    ];
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    const id = hit?.object.userData.bodyId;
    if (typeof id === "string") {
      this.selectBody(id);
      this.selectionHandler?.(id);
    }
  };

  private readonly handleControlsStart = (): void => {
    if (this.followBodyId) this.setFollowBody(undefined);
  };

  private toScenePosition(positionM: { x: number; y: number; z: number }): THREE.Vector3 {
    const displayPosition = scaleDistanceForDisplay(
      {
        x: positionM.x - this.viewFrameOriginM.x,
        y: positionM.y - this.viewFrameOriginM.y,
        z: positionM.z - this.viewFrameOriginM.z,
      },
      this.distanceScale,
    );
    return new THREE.Vector3(
      displayPosition.x / ASTRONOMICAL_UNIT_M,
      displayPosition.y / ASTRONOMICAL_UNIT_M,
      displayPosition.z / ASTRONOMICAL_UNIT_M,
    );
  }

  private toSceneOffset(positionM: { x: number; y: number; z: number }): THREE.Vector3 {
    const displayPosition = scaleDistanceForDisplay(positionM, this.distanceScale);
    return new THREE.Vector3(
      displayPosition.x / ASTRONOMICAL_UNIT_M,
      displayPosition.y / ASTRONOMICAL_UNIT_M,
      displayPosition.z / ASTRONOMICAL_UNIT_M,
    );
  }

  private shouldShowTrailFor(id: string, category: string): boolean {
    if (!this.trailsVisible || this.trailMode === "off") return false;
    if (this.trailMode === "selected") return id === this.selectedBodyId;
    if (this.trailMode === "planets") return category === "planet";
    return true;
  }
}
