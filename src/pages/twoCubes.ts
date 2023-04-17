/**
 * @title rotatingCube
 * @description rotatingCube
 * @author wzdong
 */

import basicVert from '@/shaders/basic.vert.wgsl?raw';
import positionFrag from '@/shaders/position.frag.wgsl?raw';

import { cube } from '@/geometry/cube';
import { getMvpMatrix } from '@/utils/matrix';
import { animationFrame } from '@/utils/frame';
import { onResize } from '@/utils/resizeObserver';

export async function render(canvas: HTMLCanvasElement) {
    return init(canvas);
}

function mvpRotate(
    device: GPUDevice,
    group1: ReturnType<typeof createBindGroup>,
    group2: ReturnType<typeof createBindGroup>,
    aspect: number
) {
    const mvp1 = {
        position: { x: 2, y: 0, z: -8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
    };
    const mvp2 = {
        position: { x: -2, y: 0, z: -8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
    };

    return function rotate(time: number) {
        time = time / 1000;
        mvp1.rotation.x = Math.sin(time);
        mvp1.rotation.y = Math.cos(time);
        const mvpMatrix1 = getMvpMatrix(aspect, mvp1.position, mvp1.rotation, mvp1.scale);
        device.queue.writeBuffer(group1.buffer, 0, mvpMatrix1);

        mvp2.rotation.x = Math.cos(time);
        mvp2.rotation.y = Math.sin(time);
        const mvpMatrix2 = getMvpMatrix(aspect, mvp2.position, mvp2.rotation, mvp2.scale);
        device.queue.writeBuffer(group2.buffer, 0, mvpMatrix2);
    };
}

async function init(canvas: HTMLCanvasElement) {
    // `navigator.gpu`, `requestAdapter`, `getPreferredCanvasFormat` have compatibility problems
    const { gpu } = navigator;
    const adapter = await gpu?.requestAdapter?.({});
    if (!adapter) throw Error('WebGPU not support! Adapter not found!');
    const format = gpu.getPreferredCanvasFormat?.();
    if (!format) throw Error('WebGPU not support! Adapter not found!');

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu')!;
    const { devicePixelRatio = 1 } = window;

    const onCanvasResize = () => {
        const { width, height, clientHeight, clientWidth } = canvas;
        if (width === clientWidth * devicePixelRatio && height === clientHeight * devicePixelRatio) return;
        const size = {
            width: canvas.clientWidth * devicePixelRatio,
            height: canvas.clientHeight * devicePixelRatio,
        };
        Object.assign(canvas, size);

        depthView = device
            .createTexture({
                size,
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            })
            .createView();

        rotate = mvpRotate(device, group1, group2, size.width / size.height);
    };
    onCanvasResize();
    const offResize = onResize(canvas, onCanvasResize);

    context.configure({
        device,
        format,
        alphaMode: 'opaque',
    });

    // pipeline
    const pipeline = device.createRenderPipeline({
        vertex: {
            module: device.createShaderModule({
                code: basicVert,
            }),
            entryPoint: 'main',
            buffers: [
                {
                    attributes: [
                        {
                            shaderLocation: 0, // location(0)
                            offset: 0,
                            format: 'float32x3',
                        },
                        {
                            // uv
                            shaderLocation: 1,
                            offset: 3 * 4,
                            format: 'float32x2',
                        },
                    ],
                    arrayStride: 4 * 5, // every 3 elements is a vertex
                    stepMode: 'vertex',
                },
            ],
        },
        fragment: {
            module: device.createShaderModule({
                code: positionFrag,
            }),
            entryPoint: 'main',
            targets: [{ format }],
        },
        primitive: {
            // try point-list, line-list, line-strip, triangle-strip
            topology: 'triangle-list',
            // Culling backfaces pointing away from the camera
            cullMode: 'back',
        },
        // Enable depth testing since we have z-level positions
        // Fragment closest to the camera is rendered in front
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
        layout: 'auto',
    });

    // create vertex buffer
    const vertexBuffer = device.createBuffer({
        size: cube.vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, cube.vertex, 0, cube.vertex.length);

    // create a 4x4 mvp matrix1
    const group1 = createBindGroup(device, pipeline);
    // create a 4x4 mvp matrix2
    const group2 = createBindGroup(device, pipeline);

    // create depthTexture for renderPass
    let depthView: GPUTextureView;

    let rotate: (time: number) => void;

    const pause = animationFrame((time) => {
        rotate(time);

        const commandEncoder = device.createCommandEncoder();

        // create colorTexture for renderPass, every frame create new colorTexture.
        const colorView = context.getCurrentTexture().createView();

        const passEncoder = commandEncoder.beginRenderPass({
            // required attribute `colorAttachments`, required `colorView`
            colorAttachments: [
                {
                    view: colorView,
                    clearValue: { r: 0, g: 0.5, b: 1.0, a: 1.0 },
                    loadOp: 'clear', // clear/load
                    storeOp: 'store', // store/discard
                },
            ],
            depthStencilAttachment: {
                view: depthView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });
        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        {
            // draw first cube
            passEncoder.setBindGroup(0, group1.group);
            passEncoder.draw(cube.vertexCount);
            // draw second cube
            passEncoder.setBindGroup(0, group2.group);
            passEncoder.draw(cube.vertexCount);
        }
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
    });

    return () => {
        pause();
        offResize();
    };
}

function createBindGroup(device: GPUDevice, pipeline: GPURenderPipeline) {
    const buffer = device.createBuffer({
        size: 4 * 4 * 4, // 4 x 4 x float32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // create a uniform group for buffer
    const group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: { buffer },
            },
        ],
    });
    return { buffer, group };
}
