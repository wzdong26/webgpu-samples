/**
 * @title basicTriangle
 * @author wzdong
 */

import positionVert from '@/shaders/position.vert.wgsl?raw';
import colorFrag from '@/shaders/color.frag.wgsl?raw';
import { triangle } from '@/geometry/triangle';

export async function render(canvas: HTMLCanvasElement) {
    const { device, context, pipeline } = await init(canvas);
    const buffer = initBuffer(device, pipeline);
    // start draw
    draw(device, context, pipeline, buffer);

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
                code: positionVert,
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
                    ],
                    arrayStride: 4 * 3, // every 3 elements is a vertex
                    stepMode: 'vertex',
                },
            ],
        },
        fragment: {
            module: device.createShaderModule({
                code: colorFrag,
            }),
            entryPoint: 'main',
            targets: [{ format }],
        },
        primitive: {
            topology: 'triangle-list', // try point-list, line-list, line-strip, triangle-strip?
        },
        layout: 'auto',
    });
}

function initBuffer(device: GPUDevice, pipeline: GPURenderPipeline) {
    // create vertex buffer
    const vertexBuffer = device.createBuffer({
        size: triangle.vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, triangle.vertex, 0, triangle.vertex.length);
    // create color buffer
    const colorBuffer = device.createBuffer({
        size: triangle.color.byteLength, // 4 * float32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(colorBuffer, 0, triangle.color, 0, triangle.color.length);
    // create a uniform group for color
    const uniformGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0), // group(0)
        entries: [
            {
                binding: 0, // binding(0)
                resource: {
                    buffer: colorBuffer,
                },
            },
        ],
    });

    return { vertexBuffer, colorBuffer, uniformGroup };
}

function draw(
    device: GPUDevice,
    context: GPUCanvasContext,
    pipeline: GPURenderPipeline,
    buffer: { vertexBuffer: GPUBuffer; uniformGroup: GPUBindGroup }
) {
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0.5, b: 1.0, a: 1.0 },
                loadOp: 'clear', // clear/load
                storeOp: 'store', // store/discard
            },
        ],
    });
    passEncoder.setPipeline(pipeline);
    // set vertex
    passEncoder.setVertexBuffer(0, buffer.vertexBuffer);
    // set uniformGroup
    passEncoder.setBindGroup(0, buffer.uniformGroup);
    // 3 vertex form a triangle
    passEncoder.draw(triangle.vertexCount);

    passEncoder.end();
    // webgpu run in a separate process, all the commands will be executed after submit
    device.queue.submit([commandEncoder.finish()]);
}
