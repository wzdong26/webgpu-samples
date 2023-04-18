/**
 * @title canvasTexturedCube
 * @description canvasTexturedCube
 * @author wzdong
 */

import basicVert from '@/shaders/basic.vert.wgsl?raw';
import textureFrag from '@/shaders/texture.frag.wgsl?raw';

import * as cube from '@/geometry/cube';
import { getMvpMatrix } from '@/utils/matrix';
import { animationFrame } from '@/utils/frame';
import { onResize } from '@/utils/resizeObserver';

export function render(canvas: HTMLCanvasElement, panel: HTMLDivElement) {
    const cleanCanvas2d = canvas2d(panel);

    const off = init(canvas, cleanCanvas2d.target);
    return async () => {
        cleanCanvas2d();
        (await off)();
    };
}

function canvas2d(panel: HTMLDivElement) {
    const _div = document.createElement('div');
    _div.innerText = 'Try drawing on the canvas below:';
    const _canvas = document.createElement('canvas');
    panel.append(_div, _canvas);

    const ctx = _canvas.getContext('2d');
    if (!ctx) throw new Error('No support 2d');
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    let lastX = 0,
        lastY = 0;
    let hue = 0;

    const onpointerdown = (e: PointerEvent) => {
        lastX = e.offsetX;
        lastY = e.offsetY;
        document.addEventListener('pointermove', onpointermove);
        document.addEventListener('pointerup', onpointerup, { once: true });
        _canvas.addEventListener('pointerout', onpointerup, { once: true });
    };
    const onpointermove = (e: PointerEvent) => {
        const x = e.offsetX;
        const y = e.offsetY;
        hue = hue > 360 ? 0 : hue + 1;
        ctx.strokeStyle = `hsl(${hue}, 90%, 50%)`;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();

        lastX = x;
        lastY = y;
    };
    const onpointerup = () => document.removeEventListener('pointermove', onpointermove);
    _canvas.addEventListener('pointerdown', onpointerdown);

    const cleanup = () => {
        onpointerup();
        document.removeEventListener('pointerup', onpointerup);
        _canvas.removeEventListener('pointerout', onpointerup);
        _canvas.removeEventListener('pointerdown', onpointerdown);
        panel.removeChild(_div);
        panel.removeChild(_canvas);
    };
    cleanup.target = _canvas;
    return cleanup;
}

function mvpRotate(device: GPUDevice, buffer: GPUBuffer, aspect: number) {
    const mvp = {
        position: { x: 0, y: 0, z: -8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
    };

    return function rotate(time: number) {
        time = time / 1000;
        mvp.rotation.x = Math.sin(time);
        mvp.rotation.y = Math.cos(time);
        const mvpMatrix = getMvpMatrix(aspect, mvp.position, mvp.rotation, mvp.scale);
        device.queue.writeBuffer(buffer, 0, mvpMatrix);
    };
}

async function init(canvas: HTMLCanvasElement, canvas2d: HTMLCanvasElement) {
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
                code: textureFrag,
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

    // create a 4x4 mvp matrix buffer
    const mvpBuffer = device.createBuffer({
        size: 4 * 4 * 4, // 4 x 4 x float32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const canvas2dSize = [canvas2d.width, canvas2d.height];
    // create empty texture
    const texture = device.createTexture({
        size: [...canvas2dSize, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Create a sampler with linear filtering for smooth interpolation.
    const sampler = device.createSampler({
        // addressModeU: 'repeat',
        // addressModeV: 'repeat',
        magFilter: 'linear',
        minFilter: 'linear',
    });

    const group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: mvpBuffer,
                },
            },
            {
                binding: 1,
                resource: sampler,
            },
            {
                binding: 2,
                resource: texture.createView(),
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
        // update texture from canvas every frame
        device.queue.copyExternalImageToTexture({ source: canvas2d }, { texture }, canvas2dSize);

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
            passEncoder.setBindGroup(0, group);
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
