const triangle = {
    vertex: new Float32Array([
        0.0, 0.5, 0.0, 
        -0.5, -0.5, 0.0, 
        0.5, -0.5, 0.0
    ]),
    vertexCount: 3,
    color: new Float32Array([1, 0, 0, 1]),
    vertexInput: new Float32Array([
        0.0, 0.6, 0, 1,    1, 0, 0, 1, 
        -0.5, -0.6, 0, 1,  0, 1, 0, 1, 
        0.5, -0.6, 0, 1,   0, 0, 1, 1,
    ]),
};
export { triangle };
