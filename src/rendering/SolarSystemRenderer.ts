import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { MutableBodyState } from "../domain/types";
import { ASTRONOMICAL_UNIT_M } from "../physics/constants";

const MAX_TRAIL_POINTS = 900;
const TRAIL_SAMPLE_SECONDS = 10 * 86_400;

interface BodyView {
  readonly mesh: THREE.Mesh;
  readonly label: HTMLDivElement;
  readonly trail: THREE.Line;
  readonly trailPoints: THREE.Vector3[];
  lastTrailSampleSeconds: number;
}

export class SolarSystemRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly controls: OrbitControls;
  private readonly views = new Map<string, BodyView>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private trailsVisible = true;
  private labelsVisible = true;
  private selectionHandler: ((id: string) => void) | undefined;

  constructor(
    private readonly container: HTMLElement,
    private readonly labelsContainer: HTMLElement,
    bodies: readonly Readonly<MutableBodyState>[],
  ) {
    const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
    this.camera = new THREE.OrthographicCamera(-36 * aspect, 36 * aspect, 36, -36, 0.1, 500);
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
    this.controls.minZoom = 0.35;
    this.controls.maxZoom = 300;

    this.addBackground();
    this.createBodyViews(bodies);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
  }

  onBodySelected(handler: (id: string) => void): void {
    this.selectionHandler = handler;
  }

  update(bodies: readonly Readonly<MutableBodyState>[], elapsedSeconds: number): void {
    for (const body of bodies) {
      const view = this.views.get(body.id);
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
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }

  setTrailsVisible(visible: boolean): void {
    this.trailsVisible = visible;
    for (const view of this.views.values()) view.trail.visible = visible;
  }

  setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible;
    this.labelsContainer.style.display = visible ? "block" : "none";
  }

  selectBody(id: string): void {
    for (const [bodyId, view] of this.views) {
      const material = view.mesh.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = bodyId === id ? 1 : 0.86;
      }
      view.label.style.color = bodyId === id ? "#e6b35b" : "#aeb6c6";
    }
  }

  focusBody(id: string): void {
    const view = this.views.get(id);
    if (!view) return;
    this.controls.target.copy(view.mesh.position);
    this.camera.position.x = view.mesh.position.x;
    this.camera.position.y = view.mesh.position.y;
    this.camera.zoom = Math.max(this.camera.zoom, id === "sun" ? 5 : 14);
    this.camera.updateProjectionMatrix();
  }

  fitSystem(): void {
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 0, 100);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  clearTrails(): void {
    for (const view of this.views.values()) {
      view.trailPoints.length = 0;
      view.trail.geometry.setFromPoints([]);
      view.lastTrailSampleSeconds = Number.NEGATIVE_INFINITY;
    }
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.controls.dispose();
    this.renderer.dispose();
    for (const view of this.views.values()) view.label.remove();
  }

  private createBodyViews(bodies: readonly Readonly<MutableBodyState>[]): void {
    for (const body of bodies) {
      const visibleRadius =
        body.category === "star"
          ? 0.5
          : Math.max(0.11, Math.min(0.38, Math.log10(body.radiusM) * 0.075 - 0.35));
      const geometry = new THREE.CircleGeometry(visibleRadius, 32);
      const material = new THREE.MeshBasicMaterial({
        color: body.visual.color,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.bodyId = body.id;
      mesh.renderOrder = 2;
      this.scene.add(mesh);

      if (body.id === "sun") {
        const glow = new THREE.Mesh(
          new THREE.CircleGeometry(0.86, 40),
          new THREE.MeshBasicMaterial({
            color: body.visual.emissive ?? body.visual.color,
            transparent: true,
            opacity: 0.13,
          }),
        );
        glow.renderOrder = 1;
        mesh.add(glow);
      }

      if (body.id === "saturn") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(visibleRadius * 1.25, visibleRadius * 1.8, 48),
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

      const label = document.createElement("div");
      label.className = "body-label";
      label.textContent = body.name;
      this.labelsContainer.append(label);

      const trail = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: body.visual.color,
          transparent: true,
          opacity: body.category === "star" ? 0.08 : 0.3,
        }),
      );
      trail.renderOrder = 0;
      this.scene.add(trail);

      this.views.set(body.id, {
        mesh,
        label,
        trail,
        trailPoints: [],
        lastTrailSampleSeconds: Number.NEGATIVE_INFINITY,
      });
    }
  }

  private addBackground(): void {
    const positions: number[] = [];
    let seed = 90210;
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
    for (const view of this.views.values()) {
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
    const verticalExtent = 36;
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
    const meshes = [...this.views.values()].map((view) => view.mesh);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    const id = hit?.object.userData.bodyId;
    if (typeof id === "string") {
      this.selectBody(id);
      this.selectionHandler?.(id);
    }
  };

  private toScenePosition(positionM: { x: number; y: number; z: number }): THREE.Vector3 {
    return new THREE.Vector3(
      positionM.x / ASTRONOMICAL_UNIT_M,
      positionM.y / ASTRONOMICAL_UNIT_M,
      positionM.z / ASTRONOMICAL_UNIT_M,
    );
  }
}
