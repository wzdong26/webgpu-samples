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

export function render(canvas: HTMLCanvasElement, panel: HTMLDivElement) {
  const { on, off } = selectInput(panel);
  const cleanup = init(canvas, on);
  return async () => {
    (await cleanup)();
    off();
  };
}

const selectOptions = ['renderInstance', 'renderBundle'];

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

// total objects
const NUM = 1000;

function mvpRotate(aspect: number) {
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
    return mvpBuffer;
  };
}

async function init(canvas: HTMLCanvasElement, onSelect: ReturnType<typeof selectInput>['on']) {
  // `navigator.gpu`, `requestAdapter`, `getPreferredCanvasFormat` have compatibility problems
  const { gpu } = navigator;
  const adapter = await gpu.requestAdapter({});
  if (!adapter) throw Error('WebGPU not support! Adapter not found!');
  const format = gpu.getPreferredCanvasFormat();
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

  const { write, setGroup } = createMvpGroup(device, pipeline);

  // create depthTexture for renderPass
  let depthTexture: GPUTexture;

  let rotate: (time: number) => Float32Array;

  const onCanvasResize = (entry?: ResizeObserverEntry) => {
    const { width, height, clientHeight, clientWidth } = canvas;
    if (entry && width === clientWidth * devicePixelRatio && height === clientHeight * devicePixelRatio) return;
    const size = {
      width: canvas.clientWidth * devicePixelRatio,
      height: canvas.clientHeight * devicePixelRatio,
    };
    Object.assign(canvas, size);

    // re-create depth texture
    depthTexture?.destroy();
    depthTexture = device.createTexture({
      size,
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    rotate = mvpRotate(size.width / size.height);
  };
  onCanvasResize();
  const offResize = onResize(canvas, onCanvasResize);

  // case1: renderInstance
  function renderInstance() {
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: undefined as any, // Assigned later
          clearValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    };
    return () => {
      const commandEncoder = device.createCommandEncoder();
      (renderPassDescriptor.colorAttachments as any)[0].view = context.getCurrentTexture().createView();

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(pipeline);
      passEncoder.setVertexBuffer(0, vertexBuffer);
      {
        // draw NUM cubes in one draw()
        setGroup(passEncoder);
        passEncoder.draw(cube.vertexCount, NUM);
      }
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);
    };
  }

  // case2: renderBundle
  function renderBundle() {
    const passEncoder = device.createRenderBundleEncoder({
      colorFormats: [format],
      depthStencilFormat: 'depth24plus',
    });
    passEncoder.setPipeline(pipeline);
    // assume we have different objects
    // need to change vertex and group on every draw
    // that requires a lot of cpu time for a large NUM
    console.time('recordBundles');
    for (let i = 0; i < NUM; i++) {
      passEncoder.setVertexBuffer(0, vertexBuffer);
      setGroup(passEncoder);
      passEncoder.draw(cube.vertexCount, 1, 0, i);
    }
    console.timeEnd('recordBundles');
    const renderBundle = [passEncoder.finish()];

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: undefined as any, // Assigned later
          clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    };
    return () => {
      const commandEncoder = device.createCommandEncoder();
      (renderPassDescriptor.colorAttachments as any)[0].view = context.getCurrentTexture().createView();
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      // execute bundles, could save over 10X CPU time
      // but won't help with GPU time
      passEncoder.executeBundles(renderBundle);
      passEncoder.end();
      // webgpu run in a separate process, all the commands will be executed after submit
      device.queue.submit([commandEncoder.finish()]);
    };
  }

  let render: () => void;
  await onSelect((name) => {
    if (name === 'renderBundle') {
      render = renderBundle();
    } else {
      render = renderInstance();
    }
  }, true);

  const pause = animationFrame((time) => {
    const mvpBuffer = rotate(time);
    write(mvpBuffer);
    render();
  });

  return () => {
    pause();
    offResize();
  };
}

function createMvpGroup(device: GPUDevice, pipeline: GPURenderPipeline) {
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
  return {
    write(mvpMatrix: Float32Array) {
      device.queue.writeBuffer(mvpBuffer, 0, mvpMatrix);
    },
    setGroup(passEncoder: GPURenderPassEncoder | GPURenderBundleEncoder) {
      passEncoder.setBindGroup(0, group);
    },
  };
}
