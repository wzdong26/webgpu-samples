/**
 * @title rotatingCube
 * @description rotatingCube
 * @author wzdong
 */

import basicVert from '@/shaders/basic.vert.wgsl?raw';
import positionFrag from '@/shaders/position.frag.wgsl?raw';

import * as cube from '@/geometry/cube';
import { getMvpMatrix } from '@/utils/matrix';
import { animationFrame } from '@/utils/frame';
import { onResize } from '@/utils/resizeObserver';

export function render(canvas: HTMLCanvasElement) {
    return init(canvas);
}

function mvpRotate(device: GPUDevice, group: ReturnType<typeof createBindGroup>, aspect: number) {
    const mvp = {
        position: { x: 0, y: 0, z: -8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
    };

    return function rotate(time: number) {
        time = time / 1000;
        mvp.rotation.x = Math.sin(time);
        mvp.rotation.y = Math.cos(time);
        const mvpMatrix1 = getMvpMatrix(aspect, mvp.position, mvp.rotation, mvp.scale);
        device.queue.writeBuffer(group.buffer, 0, mvpMatrix1);
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
        alphaMode: 'premultiplied',
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

    // create a 4x4 mvp matrix
    const group = createBindGroup(device, pipeline);

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

        rotate = mvpRotate(device, group, size.width / size.height);
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
            // draw cube
            passEncoder.setBindGroup(0, group.group);
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
