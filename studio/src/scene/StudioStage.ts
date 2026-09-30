import * as THREE from "three";

/** Presentation-only lighting and a shadow catcher, excluded from document geometry and picking. */
export class StudioStage {
  private root = new THREE.Group();
  private sun = new THREE.DirectionalLight(0xfff9ec, 3.2);
  private ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({
      color: 0x76634d,
      opacity: 0.09,
      depthWrite: false,
    }),
  );
  private targetHeight = 0;
  private initialized = false;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    renderer.setClearColor("#f0eee8");
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    this.root.add(new THREE.HemisphereLight(0xfffdf7, 0xa7a294, 1.8));
    const fill = new THREE.DirectionalLight(0xe7efff, 0.7);
    fill.position.set(120, 40, -100);
    this.root.add(fill);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.normalBias = 0.25;
    this.sun.shadow.bias = -0.0001;
    this.sun.shadow.radius = 4;
    this.root.add(this.sun, this.sun.target);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.root.add(this.ground);
    scene.add(this.root);
  }

  fit(bounds: THREE.Box3) {
    this.ground.visible = !bounds.isEmpty();
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(50, bounds.getSize(new THREE.Vector3()).length());
    this.targetHeight = bounds.min.y - 0.3;
    if (!this.initialized) {
      this.ground.position.y = this.targetHeight;
      this.initialized = true;
    }
    this.ground.position.x = center.x;
    this.ground.position.z = center.z;
    this.ground.scale.setScalar(radius * 5);
    this.sun.position
      .copy(center)
      .add(new THREE.Vector3(-0.8, 1.8, 1.3).multiplyScalar(radius));
    this.sun.target.position.copy(center);
    const camera = this.sun.shadow.camera;
    camera.left = camera.bottom = -radius;
    camera.right = camera.top = radius;
    camera.near = radius * 0.1;
    camera.far = radius * 6;
    camera.updateProjectionMatrix();
  }

  update(seconds: number) {
    this.ground.position.y +=
      (this.targetHeight - this.ground.position.y) *
      (1 - Math.exp(-seconds / 0.1));
  }

  dispose() {
    this.root.removeFromParent();
    this.ground.geometry.dispose();
    this.ground.material.dispose();
    this.sun.shadow.map?.dispose();
  }
}
