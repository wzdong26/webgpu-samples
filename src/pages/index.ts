export const pages = {
    basicTriangle: () => import('./basicTriangle'),
    basicTriangleMSAA: () => import('./basicTriangleMSAA'),
    colorTriangle: () => import('./colorTriangle'),
    rotatingCube: () => import('./rotatingCube'),
    texturedCube: () => import('./texturedCube'),
    canvasTexturedCube: () => import('./canvasTexturedCube'),
    twoCubes: () => import('./twoCubes'),
    instancedCubes: () => import('./instancedCubes'),
    // canvasTexturedCube: () => import('./canvasTexturedCube'),
}