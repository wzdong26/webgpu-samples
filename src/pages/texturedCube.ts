/**
 * @title texturedCube
 * @description texturedCube
 * @author wzdong
 */

import basicVert from '@/shaders/basic.vert.wgsl?raw';
import textureFrag from '@/shaders/texture.frag.wgsl?raw';
import textureUrl from '/texture.webp?url';
import spritesUrl from '/sprites.webp?url';

import * as cube from '@/geometry/cube';
import { getMvpMatrix } from '@/utils/matrix';
import { animationFrame } from '@/utils/frame';
import { onResize } from '@/utils/resizeObserver';

export function render(canvas: HTMLCanvasElement, panel: HTMLDivElement) {
    const { on, off } = selectInput(panel);
    const cleanup = init(canvas, on);
    return async () => {
        (await cleanup)();
        off();
    };
}

const textures: Record<string, string | ImageBitmap> = {
    texture: textureUrl,
    sprites: spritesUrl,
};

async function getImageBitmap(name: keyof typeof textures) {
    const texture = textures[name];
    if (typeof texture === 'string') {
        const img = new Image();
        img.src = texture;
        await img.decode();
        const imageBitmap = await createImageBitmap(img);
        return (textures[name] = imageBitmap);
    } else {
        return texture;
    }
}

// select input bar
function selectInput(panel: HTMLDivElement) {
    const _select = document.createElement('select');
    const _selectOptions = Object.keys(textures).map((e) => {
        const _selectOption = document.createElement('option');
        _selectOption.value = e;
        _selectOption.innerText = e;
        return _selectOption;
    });
    _select.append(..._selectOptions);

    panel.append(_select);

    let onInput: (e: { target: EventTarget | null }) => Promise<void>;
    return {
        on: async (cb: (name: keyof typeof textures) => void | Promise<void>, immediately?: boolean) => {
            onInput && _select.removeEventListener('input', onInput);
            onInput = async ({ target }) => {
                const { value } = (target || {}) as HTMLSelectElement;
                if (!(textures as any)[value]) return;
                await cb(value as keyof typeof textures);
            };
            _select.addEventListener('input', onInput);
            if (immediately) {
                await onInput({ target: _select });
            }
        },
        off: () => {
            onInput && _select.removeEventListener('input', onInput);
            panel.removeChild(_select);
        },
    };
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

async function init(canvas: HTMLCanvasElement, onSelect: ReturnType<typeof selectInput>['on']) {
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

    let group: GPUBindGroup;
    // select texture
    await onSelect(async (name) => {
        // Fetch the image and upload it into a GPUTexture.
        const imageBitmap = await getImageBitmap(name);
        // create empty texture
        const cubeTexture = device.createTexture({
            size: [imageBitmap.width, imageBitmap.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        // update image to GPUTexture
        device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture: cubeTexture }, [
            imageBitmap.width,
            imageBitmap.height,
        ]);

        // Create a sampler with linear filtering for smooth interpolation.
        const sampler = device.createSampler({
            // addressModeU: 'repeat',
            // addressModeV: 'repeat',
            magFilter: 'linear',
            minFilter: 'linear',
        });

        group = device.createBindGroup({
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
                    resource: cubeTexture.createView(),
                },
            ],
        });
    }, true);

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
