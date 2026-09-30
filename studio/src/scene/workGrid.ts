import * as THREE from "three";

/** Fade grid lines toward the work plane's perimeter without changing its 10 mm spacing. */
export function createWorkGrid() {
  const grid = new THREE.GridHelper(1000, 100, 0xbeb6a6, 0xd5cfc3);
  const material = grid.material as THREE.LineBasicMaterial;
  material.transparent = true;
  material.depthWrite = false;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `varying vec2 vWorkGridPosition;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvWorkGridPosition = position.xz;",
      );
    shader.fragmentShader =
      `varying vec2 vWorkGridPosition;\n${shader.fragmentShader}`.replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(70.0, 370.0, length(vWorkGridPosition));",
      );
  };
  material.customProgramCacheKey = () => "work-grid-fade-v1";
  return grid;
}
