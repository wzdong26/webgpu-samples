/**
 * @title rotatingCube
 * @description rotatingCube
 * @author wzdong
 */

import basicVert from '@/shaders/basic.vert.wgsl?raw';
import positionFrag from '@/shaders/position.frag.wgsl?raw';

import { cube } from '@/geometry/cube';
import { getMvpMatrix } from '@/utils/matrix';

export async function render(canvas: HTMLCanvasElement) {
    const { device, context, pipeline, canvasSize } = await init(canvas);
    const buffer = initBuffer(device, pipeline);

    // defaut state
    let aspect = canvasSize.width / canvasSize.height;
    const position1 = { x: 2, y: 0, z: -8 };
    const rotation1 = { x: 0, y: 0, z: 0 };
    const scale1 = { x: 1, y: 1, z: 1 };
    const position2 = { x: -2, y: 0, z: -8 };
    const rotation2 = { x: 0, y: 0, z: 0 };
    const scale2 = { x: 1, y: 1, z: 1 };
    let flag = false;
    function pause() {
        flag = true;
    }
    // start loop
    function frame() {
        if (flag) return;
        // first, update two transform matrixs
        const now = Date.now() / 1000;
        {
            // first cube
            rotation1.x = Math.sin(now);
            rotation1.y = Math.cos(now);
            const mvpMatrix1 = getMvpMatrix(aspect, position1, rotation1, scale1);
            device.queue.writeBuffer(buffer.group1.buffer, 0, mvpMatrix1);
        }
        {
            // second cube
            rotation2.x = Math.cos(now);
            rotation2.y = Math.sin(now);
            const mvpMatrix2 = getMvpMatrix(aspect, position2, rotation2, scale2);
            device.queue.writeBuffer(buffer.group2.buffer, 0, mvpMatrix2);
        }
        // then draw
        draw(device, context, pipeline, buffer, canvasSize);
        requestAnimationFrame(frame);
    }
    frame();
    return pause;
    // requestAnimationFrame(() => {
    //     // {
    //     //     triangle.vertex[0] =
    //     // }
    //     device.queue.writeBuffer(buffer.vertexBuffer, 0, triangle.vertex);
    //     device.queue.writeBuffer(buffer.colorBuffer, 0, triangle.color);
    // draw(device, context, pipeline, buffer);
    // })
    // // re-configure context on resize
    // addEventListener('resize', () => {
    //     canvas.width = canvas.clientWidth * devicePixelRatio;
    //     canvas.height = canvas.clientHeight * devicePixelRatio;
    //     // don't need to recall context.configure() after v104
    //     draw(device, context, pipeline);
    // });
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
    const canvasSize = {
        width: canvas.clientWidth * devicePixelRatio,
        height: canvas.clientHeight * devicePixelRatio,
    };
    Object.assign(canvas, canvasSize);
    context.configure({
        device,
        format,
        alphaMode: 'opaque',
    });
    const pipeline = await initPipeline(device, format);
    return { device, context, format, canvasSize, pipeline };
}

function initPipeline(device: GPUDevice, format: GPUTextureFormat) {
    return device.createRenderPipelineAsync({
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
                        }
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
}

function initBuffer(device: GPUDevice, pipeline: GPURenderPipeline) {
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

    return { vertexBuffer, group1, group2 };
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

function draw(
    device: GPUDevice,
    context: GPUCanvasContext,
    pipeline: GPURenderPipeline,
    buffer: { vertexBuffer: GPUBuffer; group1: { group: GPUBindGroup }; group2: { group: GPUBindGroup } },
    size: { width: number; height: number }
) {
    const commandEncoder = device.createCommandEncoder();
    // create depthTexture for renderPass
    const depthTexture = device.createTexture({
        size,
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const depthView = depthTexture.createView();

    const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
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
    passEncoder.setVertexBuffer(0, buffer.vertexBuffer);
    {
        // draw first cube
        passEncoder.setBindGroup(0, buffer.group1.group);
        passEncoder.draw(cube.vertexCount);
        // draw second cube
        passEncoder.setBindGroup(0, buffer.group2.group);
        passEncoder.draw(cube.vertexCount);
    }
    passEncoder.end();
    // webgpu run in a separate process, all the commands will be executed after submit
    device.queue.submit([commandEncoder.finish()]);
}
