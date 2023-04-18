import{p as C}from"./position.frag.9060e7ac.js";import{p as m,u as y,v as x,a as G,g as O,b as R}from"./matrix.2969bbb4.js";import{o as S}from"./resizeObserver.84f51a4b.js";var T=`@binding(0) @group(0) var<storage, read> mvpMatrix : array<mat4x4<f32>>;\r
\r
struct VertexOutput {\r
    @builtin(position) Position: vec4<f32>,\r
    @location(0) fragUV: vec2<f32>,\r
    @location(1) fragPosition: vec4<f32>\r
};\r
\r
@vertex\r
fn main(\r
    @builtin(instance_index) index: u32,\r
    @location(0) position: vec4<f32>,\r
    @location(1) uv: vec2<f32>\r
) -> VertexOutput {\r
    var output: VertexOutput;\r
    output.Position = mvpMatrix[index] * position;\r
    output.fragUV = uv;\r
    output.fragPosition = 0.5 * (position + vec4<f32>(1.0));\r
    return output;\r
}`;function D(o){return A(o)}const l=1e3;function z(o,n,c){const a=[],e=new Float32Array(l*4*4);for(let u=0;u<l;u++){const t={x:Math.random()*40-20,y:Math.random()*40-20,z:-30-Math.random()*50},r={x:0,y:0,z:0},i={x:1,y:1,z:1};a.push({position:t,rotation:r,scale:i})}return function(t){t=t/1e3;for(let r=0;r<a.length-1;r++){const i=a[r];i.rotation.x=Math.sin(t+r),i.rotation.y=Math.cos(t+r);const f=O(c,i.position,i.rotation,i.scale);e.set(f,r*4*4)}o.queue.writeBuffer(n,0,e)}}async function A(o){var b,M;const{gpu:n}=navigator,c=await((b=n==null?void 0:n.requestAdapter)==null?void 0:b.call(n,{}));if(!c)throw Error("WebGPU not support! Adapter not found!");const a=(M=n.getPreferredCanvasFormat)==null?void 0:M.call(n);if(!a)throw Error("WebGPU not support! Adapter not found!");const e=await c.requestDevice(),u=o.getContext("webgpu"),{devicePixelRatio:t=1}=window;u.configure({device:e,format:a,alphaMode:"opaque"});const r=e.createRenderPipeline({vertex:{module:e.createShaderModule({code:T}),entryPoint:"main",buffers:[{attributes:[{shaderLocation:0,offset:0,format:`float32x${m}`},{shaderLocation:1,offset:4*m,format:`float32x${y}`}],arrayStride:4*(m+y),stepMode:"vertex"}]},fragment:{module:e.createShaderModule({code:C}),entryPoint:"main",targets:[{format:a}]},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{depthWriteEnabled:!0,depthCompare:"less",format:"depth24plus"},layout:"auto"}),i=e.createBuffer({size:x.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(i,0,x,0,x.length);const f=e.createBuffer({size:4*4*4*l,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),B=e.createBindGroup({layout:r.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}}]});let v,w;const P=h=>{const{width:d,height:g,clientHeight:s,clientWidth:E}=o;if(h&&d===E*t&&g===s*t)return;const p={width:o.clientWidth*t,height:o.clientHeight*t};Object.assign(o,p),v=e.createTexture({size:p,format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT}).createView(),w=z(e,f,p.width/p.height)};P();const U=S(o,P),V=G(h=>{w(h);const d=e.createCommandEncoder(),g=u.getCurrentTexture().createView(),s=d.beginRenderPass({colorAttachments:[{view:g,clearValue:{r:.5,g:.5,b:.5,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:v,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});s.setPipeline(r),s.setVertexBuffer(0,i),s.setBindGroup(0,B),s.draw(R,l),s.end(),e.queue.submit([d.finish()])});return()=>{V(),U()}}export{D as render};
