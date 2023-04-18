/**
 * @title instancedCubes
 * @description instancedCubes
 * @author wzdong
 */

import instancedVert from '@/shaders/instanced.vert.wgsl?raw';
import positionFrag from '@/shaders/position.frag.wgsl?raw';

import * as cube from '@/geometry/cube';
import { getMvpMatrix } from '@/utils/matrix';
import { animationFrame } from '@/utils/frame';
import { onResize } from '@/utils/resizeObserver';

export function render(canvas: HTMLCanvasElement) {
    return init(canvas);
}

// total objects
const NUM = 1000;

function mvpRotate(device: GPUDevice, buffer: GPUBuffer, aspect: number) {
    const scene: any[] = [];
    const mvpBuffer = new Float32Array(NUM * 4 * 4);
    for (let i = 0; i < NUM; i++) {
        // create simple object
        const position = { x: Math.random() * 40 - 20, y: Math.random() * 40 - 20, z: -30 - Math.random() * 50 };
        const rotation = { x: 0, y: 0, z: 0 };
        const scale = { x: 1, y: 1, z: 1 };
        scene.push({ position, rotation, scale });
    }

    return function rotate(time: number) {
        time = time / 1000;
        // update rotation for each object
        for (let i = 0; i < scene.length - 1; i++) {
            const obj = scene[i];
            obj.rotation.x = Math.sin(time + i);
            obj.rotation.y = Math.cos(time + i);
            const mvpMatrix = getMvpMatrix(aspect, obj.position, obj.rotation, obj.scale);
            // update buffer based on offset
            // device.queue.writeBuffer(
            //     pipelineObj.mvpBuffer,
            //     i * 4 * 4 * 4, // offset for each object, no need to 256-byte aligned
            //     mvpMatrix
            // )
            // or save to mvpBuffer first
            mvpBuffer.set(mvpMatrix, i * 4 * 4);
        }
        device.queue.writeBuffer(buffer, 0, mvpBuffer);
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

    context.configure({
        device,
        format,
        alphaMode: 'opaque',
    });

    // pipeline
    const pipeline = device.createRenderPipeline({
        vertex: {
            module: device.createShaderModule({
                code: instancedVert,
            }),
            entryPoint: 'main',
            buffers: [
                {
                    attributes: [
                        {
                            shaderLocation: 0, // location(0)
                            offset: 0,
                            format: `float32x${cube.positionStride}`,
                        },
                        {
                            // uv
                            shaderLocation: 1,
                            offset: 4 * cube.positionStride,
                            format: `float32x${cube.uvStride}`,
                        },
                    ],
                    arrayStride: 4 * (cube.positionStride + cube.uvStride),
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

    // create a 4x4xNUM STORAGE buffer to store matrix
    const mvpBuffer = device.createBuffer({
        size: 4 * 4 * 4 * NUM, // 4 x 4 x float32 x NUM
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    // create a uniform group for Matrix
    const group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: mvpBuffer,
                },
            },
        ],
    });

    // create depthTexture for renderPass
    let depthView: GPUTextureView;

    let rotate: (time: number) => void;

    const onCanvasResize = (entry?: ResizeObserverEntry) => {
        const { width, height, clientHeight, clientWidth } = canvas;
        if (entry && width === clientWidth * devicePixelRatio && height === clientHeight * devicePixelRatio) return;
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

        rotate = mvpRotate(device, mvpBuffer, size.width / size.height);
    };
    onCanvasResize();
    const offResize = onResize(canvas, onCanvasResize);

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
                    clearValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
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
            // draw NUM cubes in one draw()
            passEncoder.setBindGroup(0, group);
            passEncoder.draw(cube.vertexCount, NUM);
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
