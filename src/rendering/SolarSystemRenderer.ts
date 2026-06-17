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
import { shouldShowCometVisual } from "./cometVisibility";
import { shouldShowMoon } from "./moonVisibility";
import { resolveViewFrameOrigin, type ViewFrame } from "./viewFrame";
import {
  calculateMarkerSizing,
  calculatePhysicalMarkerRadius,
  shouldUsePlanetDotMarkers,
  type MarkerCategory,
  type MarkerOverlapItem,
  type MarkerScaleMode,
} from "./markerSizing";
import { calculateDeclutterVisibility, type DeclutterItem } from "./declutter";

const TRAIL_SAMPLE_SECONDS = 10 * DAY_SECONDS;
const ORBIT_REFRESH_SECONDS = 30 * DAY_SECONDS;
const MOON_VISIBILITY_ZOOM = 28;
const LOCAL_ORBIT_DISPLAY_SCALE = 80;

export type { ViewFrame } from "./viewFrame";
export type { MarkerScaleMode } from "./markerSizing";
export type TrailMode = "off" | "selected" | "planets" | "all";
export type TrailLengthPreset = "short" | "medium" | "long";

export interface RendererFrameCaptureOptions {
  readonly caption?: string;
}

export interface SolarSystemRendererOptions {
  readonly pixelRatio?: number;
}

export interface RendererViewSnapshot {
  readonly cameraPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly controlsTarget: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly zoom: number;
  readonly followBodyId?: string;
}

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
  readonly baseWorldRadius: number;
  readonly physicalRadiusM: number;
  readonly category: MarkerCategory;
  lastTrailSampleSeconds: number;
}

interface OrbitalBodyView {
  readonly body: HierarchicalOrbitalBody;
  readonly mesh: THREE.Mesh;
  readonly label: HTMLDivElement;
  readonly orbit: THREE.Line;
  readonly baseWorldRadius: number;
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
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
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
  private cometsVisible = true;
  private moonsVisible = true;
  private distanceScale: DistanceScaleConfig = DEFAULT_DISTANCE_SCALE;
  private viewFrame: ViewFrame = "barycentric";
  private viewFrameOriginM = { x: 0, y: 0, z: 0 };
  private viewFrameOriginBodyId = "sun";
  private trailMode: TrailMode = "all";
  private trailPointLimit = TRAIL_POINT_LIMITS.medium;
  private markerScaleMode: MarkerScaleMode = "readable";
  private manualBodyScaleEnabled = false;
  private bodyScaleOverrides: ReadonlyMap<string, number> = new Map();
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
    options: SolarSystemRendererOptions = {},
  ) {
    const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
    this.camera = new THREE.OrthographicCamera(-55 * aspect, 55 * aspect, 55, -55, 0.1, 500);
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);
    this.renderer.setPixelRatio(options.pixelRatio ?? Math.min(window.devicePixelRatio, 2));
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
      originBodyId: this.viewFrameOriginBodyId,
      bodies,
      orbitalStates,
    });
    for (const body of bodies) {
      const view = this.bodyViews.get(body.id);
      if (!view) continue;
      const scenePosition = this.bodyToScenePosition(body, bodies);
      view.mesh.position.copy(scenePosition);
      if (body.category === "moon") {
        const parent = body.parentId
          ? bodies.find((candidate) => candidate.id === body.parentId)
          : undefined;
        if (parent) view.orbit.position.copy(this.toScenePosition(parent.positionM));
      }
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
      view.trail.visible =
        this.isBaseVisible(view.mesh) && this.shouldShowTrailFor(body.id, body.category);
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
    this.updateMarkerSizes();
    this.updateDeclutterVisibility();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }

  getViewSnapshot(): RendererViewSnapshot {
    return {
      cameraPosition: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      controlsTarget: {
        x: this.controls.target.x,
        y: this.controls.target.y,
        z: this.controls.target.z,
      },
      zoom: this.camera.zoom,
      followBodyId: this.followBodyId,
    };
  }

  applyViewSnapshot(snapshot: RendererViewSnapshot): void {
    this.camera.position.set(
      snapshot.cameraPosition.x,
      snapshot.cameraPosition.y,
      snapshot.cameraPosition.z,
    );
    this.controls.target.set(
      snapshot.controlsTarget.x,
      snapshot.controlsTarget.y,
      snapshot.controlsTarget.z,
    );
    this.camera.zoom = Math.max(this.controls.minZoom, Math.min(this.controls.maxZoom, snapshot.zoom));
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.setFollowBody(snapshot.followBodyId);
  }

  setTrailsVisible(visible: boolean): void {
    this.trailsVisible = visible;
    for (const [id, view] of this.bodyViews) {
      const category = view.mesh.userData.category;
      view.trail.visible =
        this.isBaseVisible(view.mesh) &&
        typeof category === "string" &&
        this.shouldShowTrailFor(id, category);
    }
  }

  setTrailMode(mode: TrailMode, selectedBodyId = this.selectedBodyId): void {
    this.trailMode = mode;
    this.selectedBodyId = selectedBodyId;
    for (const [id, view] of this.bodyViews) {
      const category = view.mesh.userData.category;
      view.trail.visible =
        this.isBaseVisible(view.mesh) &&
        typeof category === "string" &&
        this.shouldShowTrailFor(id, category);
    }
  }

  setTrailLengthPreset(preset: TrailLengthPreset): void {
    this.trailPointLimit = TRAIL_POINT_LIMITS[preset];
    for (const view of this.bodyViews.values()) {
      while (view.trailPoints.length > this.trailPointLimit) view.trailPoints.shift();
      view.trail.geometry.setFromPoints(view.trailPoints);
    }
  }

  setViewFrame(
    frame: ViewFrame,
    selectedBodyId = this.selectedBodyId,
    originBodyId = selectedBodyId,
  ): void {
    this.viewFrame = frame;
    this.selectedBodyId = selectedBodyId;
    this.viewFrameOriginBodyId = originBodyId;
    this.clearTrails();
  }

  setPlanetPathsVisible(visible: boolean): void {
    this.planetPathsVisible = visible;
    for (const [id, view] of this.bodyViews) {
      view.orbit.visible = visible && id !== "sun" && view.category !== "moon";
    }
    this.updateMoonVisibility();
  }

  setCometPathsVisible(visible: boolean): void {
    this.cometPathsVisible = visible;
    for (const view of this.orbitalViews.values()) {
      if (view.body.category === "comet") {
        view.orbit.visible = shouldShowCometVisual({
          kind: "path",
          cometsVisible: this.cometsVisible,
          cometPathsVisible: visible,
        });
      }
    }
  }

  setCometTailsVisible(visible: boolean): void {
    this.cometTailsVisible = visible;
    for (const view of this.orbitalViews.values()) {
      if (view.body.category === "comet" && view.tail) {
        view.tail.visible = shouldShowCometVisual({
          kind: "tail",
          cometsVisible: this.cometsVisible,
          cometTailsVisible: visible,
        });
      }
    }
  }

  setCometsVisible(visible: boolean): void {
    this.cometsVisible = visible;
    for (const view of this.orbitalViews.values()) {
      if (view.body.category !== "comet") continue;
      this.setBaseVisible(
        view.mesh,
        shouldShowCometVisual({ kind: "body", cometsVisible: visible }),
      );
      view.orbit.visible = shouldShowCometVisual({
        kind: "path",
        cometsVisible: visible,
        cometPathsVisible: this.cometPathsVisible,
      });
      if (view.tail) {
        view.tail.visible = shouldShowCometVisual({
          kind: "tail",
          cometsVisible: visible,
          cometTailsVisible: this.cometTailsVisible,
        });
      }
      if (!visible) view.label.style.display = "none";
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

  setMarkerScaleMode(mode: MarkerScaleMode): void {
    this.markerScaleMode = mode;
    this.updateMarkerSizes();
  }

  setManualBodyScaleEnabled(enabled: boolean): void {
    this.manualBodyScaleEnabled = enabled;
    this.updateMarkerSizes();
  }

  setBodyScaleOverrides(overrides: ReadonlyMap<string, number>): void {
    this.bodyScaleOverrides = new Map(overrides);
    this.updateMarkerSizes();
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
    const hasMoons =
      [...this.bodyViews.values()].some(
        (candidate) =>
          candidate.category === "moon" && candidate.mesh.userData.parentId === id,
      ) ||
      [...this.orbitalViews.values()].some(
        (candidate) => candidate.body.category === "moon" && candidate.body.parentId === id,
      );
    const isMoon =
      ("category" in view && view.category === "moon") ||
      ("body" in view && view.body.category === "moon");
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

  frameOrbitRadius(radiusM: number, localScale = false): void {
    const displayRadiusAu =
      (radiusM / ASTRONOMICAL_UNIT_M) * (localScale ? LOCAL_ORBIT_DISPLAY_SCALE : this.distanceScale.scaleFactor);
    this.frameAt(Math.max(0.5, displayRadiusAu * 1.35));
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

  captureFrame(options: RendererFrameCaptureOptions): ImageData {
    const sourceCanvas = this.renderer.domElement;
    const sourceWidth = Math.max(sourceCanvas.width, 1);
    const sourceHeight = Math.max(sourceCanvas.height, 1);
    const width = sourceWidth;
    const height = sourceHeight;
    const cssWidth = Math.max(this.container.clientWidth, 1);
    const labelScale = width / cssWidth;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not create a 2D canvas for GIF capture.");
    context.drawImage(sourceCanvas, 0, 0, width, height);
    this.drawLabelsForCapture(context, labelScale, width, height);
    if (options.caption) this.drawCaptureCaption(context, options.caption, width, height);
    return context.getImageData(0, 0, width, height);
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
      const visibleRadius = calculatePhysicalMarkerRadius(body.category, body.radiusM);
      const mesh = this.createDisc(body.id, visibleRadius, body.visual.color);
      mesh.userData.category = body.category;
      mesh.userData.parentId = body.parentId;
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
        baseWorldRadius: visibleRadius,
        physicalRadiusM: body.radiusM,
        category: body.category,
        lastTrailSampleSeconds: Number.NEGATIVE_INFINITY,
      });
    }
  }

  private createOrbitalViews(bodies: readonly HierarchicalOrbitalBody[]): void {
    for (const body of bodies) {
      const radius = calculatePhysicalMarkerRadius(body.category, body.radiusM);
      const mesh = this.createDisc(body.id, radius, body.visual.color);
      mesh.userData.category = body.category;
      const label = this.createLabel(body.name);
      const orbit = this.createLine(body.visual.color, body.category === "moon" ? 0.32 : 0.24);
      const tail =
        body.category === "comet" ? this.createLine(body.visual.color, 0.7) : undefined;
      this.orbitalViews.set(body.id, { body, mesh, label, orbit, baseWorldRadius: radius, tail });
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
      if (body.category === "moon") {
        const parent = body.parentId
          ? bodies.find((candidate) => candidate.id === body.parentId)
          : undefined;
        if (!parent) continue;
        const relativePosition = subtract(body.positionM, parent.positionM);
        const relativeVelocity = subtract(body.velocityMps, parent.velocityMps);
        const elements = stateToOsculatingElements(
          relativePosition,
          relativeVelocity,
          parent.massKg + body.massKg,
          J2000_JULIAN_DAY,
        );
        view.orbit.geometry.setFromPoints(
          sampleOrbitPath(elements, 128).map((point) => this.toLocalSceneOffset(point)),
        );
        view.orbit.position.copy(this.toScenePosition(parent.positionM));
        continue;
      }
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
        orbitalState.body.category === "comet"
          ? shouldShowCometVisual({
              kind: "path",
              cometsVisible: this.cometsVisible,
              cometPathsVisible: this.cometPathsVisible,
            })
          : true;
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
    tail.visible = shouldShowCometVisual({
      kind: "tail",
      cometsVisible: this.cometsVisible,
      cometTailsVisible: this.cometTailsVisible,
      tailActive: activity > 0.02,
    });
  }

  private orbitalStateToScenePosition(state: HierarchicalBodyState): THREE.Vector3 {
    if (state.body.category !== "moon") return this.toScenePosition(state.positionM);
    return this.toScenePosition(state.parentPositionM).add(
      this.toLocalSceneOffset(state.relativePositionM),
    );
  }

  private bodyToScenePosition(
    body: Readonly<MutableBodyState>,
    bodies: readonly Readonly<MutableBodyState>[],
  ): THREE.Vector3 {
    if (body.category !== "moon" || !body.parentId) return this.toScenePosition(body.positionM);
    const parent = bodies.find((candidate) => candidate.id === body.parentId);
    if (!parent) return this.toScenePosition(body.positionM);
    return this.toScenePosition(parent.positionM).add(
      this.toLocalSceneOffset(subtract(body.positionM, parent.positionM)),
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
    const selectedPhysical = this.bodyViews.get(this.selectedBodyId);
    const selectedOrbital = this.orbitalViews.get(this.selectedBodyId)?.body;
    const selectedParentId =
      typeof selectedPhysical?.mesh.userData.parentId === "string"
        ? selectedPhysical.mesh.userData.parentId
        : selectedOrbital?.parentId;

    for (const [id, view] of this.bodyViews) {
      if (view.category !== "moon") continue;
      const parentId =
        typeof view.mesh.userData.parentId === "string" ? view.mesh.userData.parentId : "";
      const visible = shouldShowMoon({
        enabled: this.moonsVisible,
        cameraZoom: this.camera.zoom,
        thresholdZoom: MOON_VISIBILITY_ZOOM,
        moonId: id,
        parentId,
        selectedBodyId: this.selectedBodyId,
        selectedParentId,
      });
      this.setBaseVisible(view.mesh, visible);
      view.orbit.visible = visible;
      view.trail.visible = visible && this.shouldShowTrailFor(id, "moon");
      if (!visible) view.label.style.display = "none";
    }

    for (const view of this.orbitalViews.values()) {
      if (view.body.category !== "moon") continue;
      const visible = shouldShowMoon({
        enabled: this.moonsVisible,
        cameraZoom: this.camera.zoom,
        thresholdZoom: MOON_VISIBILITY_ZOOM,
        moonId: view.body.id,
        parentId: view.body.parentId,
        selectedBodyId: this.selectedBodyId,
        selectedParentId,
      });
      this.setBaseVisible(view.mesh, visible);
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

  private updateMarkerSizes(): void {
    const viewportHeightPx = Math.max(this.container.clientHeight, 1);
    const cameraWorldHeight = Math.abs(this.camera.top - this.camera.bottom);
    for (const [id, view] of this.bodyViews) {
      this.applyMarkerSize(id, view.mesh, {
        category: view.category,
        physicalRadiusM: view.physicalRadiusM,
        baseWorldRadius: view.baseWorldRadius,
      }, viewportHeightPx, cameraWorldHeight, false);
    }
    for (const [id, view] of this.orbitalViews) {
      this.applyMarkerSize(id, view.mesh, {
        category: view.body.category,
        physicalRadiusM: view.body.radiusM,
        baseWorldRadius: view.baseWorldRadius,
      }, viewportHeightPx, cameraWorldHeight, false);
    }

    if (
      this.markerScaleMode === "readable" &&
      shouldUsePlanetDotMarkers(this.collectMarkerOverlapItems())
    ) {
      for (const [id, view] of this.bodyViews) {
        if (view.category !== "star" && view.category !== "planet") continue;
        this.applyMarkerSize(id, view.mesh, {
          category: view.category,
          physicalRadiusM: view.physicalRadiusM,
          baseWorldRadius: view.baseWorldRadius,
        }, viewportHeightPx, cameraWorldHeight, true);
      }
    }
  }

  private applyMarkerSize(
    id: string,
    mesh: THREE.Mesh,
    body: {
      readonly category: MarkerCategory;
      readonly physicalRadiusM: number;
      readonly baseWorldRadius: number;
    },
    viewportHeightPx: number,
    cameraWorldHeight: number,
    compactPrimaryMarkers: boolean,
  ): void {
    const sizing = calculateMarkerSizing({
      mode: this.markerScaleMode,
      category: body.category,
      physicalRadiusM: body.physicalRadiusM,
      baseWorldRadius: body.baseWorldRadius,
      selected: id === this.selectedBodyId,
      cameraZoom: this.camera.zoom,
      viewportHeightPx,
      cameraWorldHeight,
      manualScaleEnabled: this.manualBodyScaleEnabled,
      manualScale: this.bodyScaleOverrides.get(id),
      compactPrimaryMarkers,
    });
    const scale = sizing.worldRadius / body.baseWorldRadius;
    mesh.scale.setScalar(Number.isFinite(scale) && scale > 0 ? scale : 1);
    mesh.userData.renderRadiusPx = sizing.pixelRadius;
  }

  private collectMarkerOverlapItems(): MarkerOverlapItem[] {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const items: MarkerOverlapItem[] = [];

    for (const view of this.bodyViews.values()) {
      if (view.category !== "star" && view.category !== "planet") continue;
      items.push(this.createMarkerOverlapItem(view.mesh, view.category, width, height));
    }

    return items;
  }

  private createMarkerOverlapItem(
    mesh: THREE.Mesh,
    category: MarkerCategory,
    width: number,
    height: number,
  ): MarkerOverlapItem {
    const screen = mesh.position.clone().project(this.camera);
    return {
      category,
      screenXPx: (screen.x * 0.5 + 0.5) * width,
      screenYPx: (-screen.y * 0.5 + 0.5) * height,
      pixelRadius:
        typeof mesh.userData.renderRadiusPx === "number" ? mesh.userData.renderRadiusPx : 0,
      baseVisible: this.isBaseVisible(mesh),
    };
  }

  private updateDeclutterVisibility(): void {
    const entries = this.collectDeclutterItems();
    if (this.markerScaleMode !== "readable") {
      for (const entry of entries) {
        this.setDeclutterHidden(entry.mesh, false);
        this.setLabelDeclutterHidden(entry.mesh, false);
      }
      return;
    }

    const result = calculateDeclutterVisibility(
      entries.map((entry) => entry.item),
      {
        viewportWidthPx: Math.max(this.container.clientWidth, 1),
        viewportHeightPx: Math.max(this.container.clientHeight, 1),
      },
    );
    for (const entry of entries) {
      this.setDeclutterHidden(
        entry.mesh,
        this.isBaseVisible(entry.mesh) && !result.visibleIds.has(entry.item.id),
      );
      this.setLabelDeclutterHidden(
        entry.mesh,
        this.isBaseVisible(entry.mesh) && !result.labelVisibleIds.has(entry.item.id),
      );
    }
  }

  private collectDeclutterItems(): { readonly item: DeclutterItem; readonly mesh: THREE.Mesh }[] {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const entries: { readonly item: DeclutterItem; readonly mesh: THREE.Mesh }[] = [];

    for (const [id, view] of this.bodyViews) {
      entries.push({
        item: this.createDeclutterItem({
          id,
          mesh: view.mesh,
          label: view.label,
          category: view.category,
          width,
          height,
        }),
        mesh: view.mesh,
      });
    }
    for (const [id, view] of this.orbitalViews) {
      entries.push({
        item: this.createDeclutterItem({
          id,
          mesh: view.mesh,
          label: view.label,
          category: view.body.category,
          width,
          height,
        }),
        mesh: view.mesh,
      });
    }

    return entries;
  }

  private createDeclutterItem(input: {
    readonly id: string;
    readonly mesh: THREE.Mesh;
    readonly label: HTMLDivElement;
    readonly category: MarkerCategory;
    readonly width: number;
    readonly height: number;
  }): DeclutterItem {
    const screen = input.mesh.position.clone().project(this.camera);
    const markerRadiusPx =
      typeof input.mesh.userData.renderRadiusPx === "number"
        ? input.mesh.userData.renderRadiusPx
        : 0;
    const labelSize = this.estimateLabelSize(input.label);
    return {
      id: input.id,
      category: input.category,
      screenXPx: (screen.x * 0.5 + 0.5) * input.width,
      screenYPx: (-screen.y * 0.5 + 0.5) * input.height,
      markerRadiusPx,
      selected: input.id === this.selectedBodyId,
      baseVisible: this.isBaseVisible(input.mesh),
      protectMarker: input.category === "moon",
      labelWidthPx: labelSize.width,
      labelHeightPx: labelSize.height,
    };
  }

  private estimateLabelSize(
    label: HTMLDivElement,
  ): { readonly width: number; readonly height: number } {
    if (!this.labelsVisible) return { width: 0, height: 0 };
    const fallbackWidth = (label.textContent?.length ?? 0) * 6;
    return {
      width: Math.max(label.offsetWidth, fallbackWidth),
      height: Math.max(label.offsetHeight, 12),
    };
  }

  private setBaseVisible(mesh: THREE.Mesh, visible: boolean): void {
    mesh.userData.baseVisible = visible;
    this.applyEffectiveVisibility(mesh);
  }

  private setDeclutterHidden(mesh: THREE.Mesh, hidden: boolean): void {
    mesh.userData.hiddenByDeclutter = hidden;
    this.applyEffectiveVisibility(mesh);
  }

  private setLabelDeclutterHidden(mesh: THREE.Mesh, hidden: boolean): void {
    mesh.userData.labelHiddenByDeclutter = hidden;
  }

  private isBaseVisible(mesh: THREE.Mesh): boolean {
    return mesh.userData.baseVisible !== false;
  }

  private applyEffectiveVisibility(mesh: THREE.Mesh): void {
    mesh.visible = this.isBaseVisible(mesh) && mesh.userData.hiddenByDeclutter !== true;
  }

  private createDisc(id: string, radius: number, color: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    mesh.userData.bodyId = id;
    mesh.userData.baseVisible = true;
    mesh.userData.hiddenByDeclutter = false;
    mesh.userData.labelHiddenByDeclutter = false;
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

  private drawLabelsForCapture(
    context: CanvasRenderingContext2D,
    scale: number,
    width: number,
    height: number,
  ): void {
    if (!this.labelsVisible) return;
    const cssWidth = Math.max(this.container.clientWidth, 1);
    const cssHeight = Math.max(this.container.clientHeight, 1);
    context.save();
    context.font = `${Math.max(8, Math.round(9 * scale))}px "DM Mono", monospace`;
    context.textBaseline = "middle";
    context.shadowColor = "#05070c";
    context.shadowBlur = Math.max(2, 4 * scale);
    for (const label of this.labelsContainer.querySelectorAll<HTMLDivElement>(".body-label")) {
      if (label.style.display === "none" || !label.textContent) continue;
      const left = Number.parseFloat(label.style.left);
      const top = Number.parseFloat(label.style.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) continue;
      const x = (left / cssWidth) * width;
      const y = (top / cssHeight) * height;
      context.fillStyle = label.style.color || "#aeb6c6";
      context.fillText(label.textContent, x, y);
    }
    context.restore();
  }

  private drawCaptureCaption(
    context: CanvasRenderingContext2D,
    caption: string,
    width: number,
    height: number,
  ): void {
    const padding = Math.max(10, Math.round(width * 0.018));
    const fontSize = Math.max(10, Math.round(width * 0.017));
    context.save();
    context.font = `${fontSize}px "DM Mono", monospace`;
    context.textBaseline = "bottom";
    const metrics = context.measureText(caption);
    const labelWidth = Math.min(metrics.width + padding * 2, width - padding * 2);
    const labelHeight = fontSize + padding;
    context.fillStyle = "rgba(5, 7, 12, 0.72)";
    context.fillRect(padding, height - labelHeight - padding, labelWidth, labelHeight);
    context.fillStyle = "#e9edf5";
    context.fillText(caption, padding * 2, height - padding * 1.5);
    context.restore();
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
      if (!view.mesh.visible || view.mesh.userData.labelHiddenByDeclutter === true) {
        view.label.style.display = "none";
        continue;
      }
      const screen = view.mesh.position.clone().project(this.camera);
      const visible = Math.abs(screen.x) <= 1.1 && Math.abs(screen.y) <= 1.1;
      const radiusPx =
        typeof view.mesh.userData.renderRadiusPx === "number"
          ? view.mesh.userData.renderRadiusPx
          : 0;
      view.label.style.display = visible ? "block" : "none";
      view.label.style.left = `${(screen.x * 0.5 + 0.5) * width + radiusPx + 8}px`;
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
      ...[...this.bodyViews.values()]
        .filter((view) => view.mesh.visible)
        .map((view) => view.mesh),
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
