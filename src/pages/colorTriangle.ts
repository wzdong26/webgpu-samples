/**
 * @title colorTriangle
 * @author wzdong
 */

import basicVert from '@/shaders/basicPosition.vert.wgsl?raw';
import positionFrag from '@/shaders/position.frag.wgsl?raw';
import * as triangle from '@/geometry/triangle';
import { onResize } from '@/utils/resizeObserver';

export function render(canvas: HTMLCanvasElement) {
    return init(canvas);
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
        alphaMode: 'premultiplied', // premultiplied / opaque
    });

    const arrayStride = triangle.vertex.length / triangle.vertexCount;
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
                            format: `float32x${triangle.positionStride}`,
                        },
                        // uv, used for texture, here as a placeholder only.
                        {
                            shaderLocation: 1, // location(1)
                            offset: 4 * triangle.positionStride,
                            format: `float32x${triangle.uvStride}`,
                        },
                    ],
                    arrayStride: 4 * arrayStride, // every 3 elements is a vertex
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
            topology: 'triangle-list', // try point-list, line-list, line-strip, triangle-strip?
        },
        layout: 'auto',
    });

    // create vertex buffer
    const vertexBuffer = device.createBuffer({
        size: triangle.vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, triangle.vertex, 0, triangle.vertex.length);

    // draw
    const draw = () => {
        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                    loadOp: 'clear', // clear/load
                    storeOp: 'store', // store/discard
                },
            ],
        });
        passEncoder.setPipeline(pipeline);
        // set vertex
        passEncoder.setVertexBuffer(0, vertexBuffer);
        // 3 vertex form a triangle
        passEncoder.draw(triangle.vertexCount);

        passEncoder.end();
        // webgpu run in a separate process, all the commands will be executed after submit
        device.queue.submit([commandEncoder.finish()]);
    };

    const onCanvasResize = (entry?: ResizeObserverEntry) => {
        const { width, height, clientHeight, clientWidth } = canvas;
        if (entry && width === clientWidth * devicePixelRatio && height === clientHeight * devicePixelRatio) return;
        const size = {
            width: canvas.clientWidth * devicePixelRatio,
            height: canvas.clientHeight * devicePixelRatio,
        };
        Object.assign(canvas, size);

        draw();
    };

    onCanvasResize();
    return onResize(canvas, onCanvasResize);
}
