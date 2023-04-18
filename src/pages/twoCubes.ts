/**
 * @title twoCubes
 * @description twoCubes
 * @author wzdong
 */

import basicVert from '@/shaders/basic.vert.wgsl?raw';
import positionFrag from '@/shaders/position.frag.wgsl?raw';

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

const selectOptions = ['groups', 'offsets'];

// select input bar
function selectInput(panel: HTMLDivElement) {
    const _select = document.createElement('select');
    const _selectOptions = selectOptions.map((e) => {
        const _selectOption = document.createElement('option');
        _selectOption.value = e;
        _selectOption.innerText = e;
        return _selectOption;
    });
    _select.append(..._selectOptions);

    panel.append(_select);

    let onInput: (e: { target: EventTarget | null }) => Promise<void>;
    return {
        on: async (cb: (name: string) => void | Promise<void>, immediately?: boolean) => {
            onInput && _select.removeEventListener('input', onInput);
            onInput = async ({ target }) => {
                const { value } = (target || {}) as HTMLSelectElement;
                await cb(value);
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

function mvpRotate(aspect: number) {
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

        mvp2.rotation.x = Math.cos(time);
        mvp2.rotation.y = Math.sin(time);
        const mvpMatrix2 = getMvpMatrix(aspect, mvp2.position, mvp2.rotation, mvp2.scale);
        return [mvpMatrix1, mvpMatrix2];
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

    let group1: ReturnType<typeof createMvpGroupByGroups>, group2: ReturnType<typeof createMvpGroupByGroups>;
    await onSelect((name) => {
        let createMvpGroup;
        if (name === 'offsets') {
            createMvpGroup = createMvpGroupByOffsets(device, pipeline, 2);
        } else {
            createMvpGroup = createMvpGroupByGroups;
        }
        // create a 4x4 mvp matrix1
        group1 = createMvpGroup(device, pipeline);
        // create a 4x4 mvp matrix2
        group2 = createMvpGroup(device, pipeline);
    }, true);

    // create depthTexture for renderPass
    let depthView: GPUTextureView;

    let rotate: (time: number) => Float32Array[];

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

        rotate = mvpRotate(size.width / size.height);
    };
    onCanvasResize();
    const offResize = onResize(canvas, onCanvasResize);

    const pause = animationFrame((time) => {
        if (!rotate || !depthView) return;
        const [mat1, mat2] = rotate(time);
        group1.write(mat1);
        group2.write(mat2);

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
            // draw first cube
            group1.setGroup(passEncoder);
            passEncoder.draw(cube.vertexCount);
            // draw second cube
            group2.setGroup(passEncoder);
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

// groups
function createMvpGroupByGroups(device: GPUDevice, pipeline: GPURenderPipeline) {
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
    return {
        write(mvpMatrix: Float32Array) {
            device.queue.writeBuffer(buffer, 0, mvpMatrix);
        },
        setGroup(passEncoder: GPURenderPassEncoder) {
            passEncoder.setBindGroup(0, group);
        },
    };
}

// offsets
function createMvpGroupByOffsets(device: GPUDevice, pipeline: GPURenderPipeline, num: number) {
    const buffer = device.createBuffer({
        size: 256 * num + 4 * 4 * 4, // uniformBindGroup offset must be 256-byte aligned
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    let count = 0;
    return () => {
        if (count >= num) throw Error('');
        const offset = 256 * count++;
        // create a uniform group for buffer
        const group = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer, offset, size: 4 * 4 * 4 },
                },
            ],
        });
        return {
            write(mvpMatrix: Float32Array) {
                device.queue.writeBuffer(buffer, offset, mvpMatrix);
            },
            setGroup(passEncoder: GPURenderPassEncoder) {
                passEncoder.setBindGroup(0, group);
            },
        };
    };
}
