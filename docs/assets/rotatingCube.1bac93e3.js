import{b as C}from"./basic.vert.dd86de92.js";import{p as E}from"./position.frag.9060e7ac.js";import{p,u as B,v as l,a as G,g as R,b as S}from"./matrix.2969bbb4.js";import{o as z}from"./resizeObserver.84f51a4b.js";function D(e){return V(e)}function T(e,t,i){const o={position:{x:0,y:0,z:-8},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}};return function(n){n=n/1e3,o.rotation.x=Math.sin(n),o.rotation.y=Math.cos(n);const s=R(i,o.position,o.rotation,o.scale);e.queue.writeBuffer(t.buffer,0,s)}}async function V(e){var P,v;const{gpu:t}=navigator,i=await((P=t==null?void 0:t.requestAdapter)==null?void 0:P.call(t,{}));if(!i)throw Error("WebGPU not support! Adapter not found!");const o=(v=t.getPreferredCanvasFormat)==null?void 0:v.call(t);if(!o)throw Error("WebGPU not support! Adapter not found!");const r=await i.requestDevice(),n=e.getContext("webgpu"),{devicePixelRatio:s=1}=window;n.configure({device:r,format:o,alphaMode:"premultiplied"});const h=r.createRenderPipeline({vertex:{module:r.createShaderModule({code:C}),entryPoint:"main",buffers:[{attributes:[{shaderLocation:0,offset:0,format:`float32x${p}`},{shaderLocation:1,offset:4*p,format:`float32x${B}`}],arrayStride:4*(p+B),stepMode:"vertex"}]},fragment:{module:r.createShaderModule({code:E}),entryPoint:"main",targets:[{format:o}]},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{depthWriteEnabled:!0,depthCompare:"less",format:"depth24plus"},layout:"auto"}),g=r.createBuffer({size:l.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});r.queue.writeBuffer(g,0,l,0,l.length);const m=O(r,h);let x,w;const b=d=>{const{width:u,height:f,clientHeight:a,clientWidth:M}=e;if(d&&u===M*s&&f===a*s)return;const c={width:e.clientWidth*s,height:e.clientHeight*s};Object.assign(e,c),x=r.createTexture({size:c,format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT}).createView(),w=T(r,m,c.width/c.height)};b();const y=z(e,b),U=G(d=>{w(d);const u=r.createCommandEncoder(),f=n.getCurrentTexture().createView(),a=u.beginRenderPass({colorAttachments:[{view:f,clearValue:{r:.5,g:.5,b:.5,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:x,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});a.setPipeline(h),a.setVertexBuffer(0,g),a.setBindGroup(0,m.group),a.draw(S),a.end(),r.queue.submit([u.finish()])});return()=>{U(),y()}}function O(e,t){const i=e.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),o=e.createBindGroup({layout:t.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}}]});return{buffer:i,group:o}}export{D as render};