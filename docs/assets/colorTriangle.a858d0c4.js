import{p as y}from"./position.frag.9060e7ac.js";import{v as a,a as m,p as g,u as U}from"./triangle.f5e91035.js";import{o as C}from"./resizeObserver.84f51a4b.js";var E=`\r
struct VertexOutput {\r
    @builtin(position) Position : vec4<f32>,\r
    @location(0) fragUV : vec2<f32>,\r
    @location(1) fragPosition: vec4<f32>\r
};\r
\r
@vertex\r
fn main(\r
    @location(0) position : vec4<f32>,\r
    @location(1) uv : vec2<f32>\r
) -> VertexOutput {\r
    var output : VertexOutput;\r
    output.Position = position;\r
    output.fragUV = uv;\r
    output.fragPosition = 0.5 * (position + vec4<f32>(1.0, 1.0, 1.0, 1.0));\r
    return output;\r
}`;function q(e){return O(e)}async function O(e){var p,l;const{gpu:t}=navigator,u=await((p=t==null?void 0:t.requestAdapter)==null?void 0:p.call(t,{}));if(!u)throw Error("WebGPU not support! Adapter not found!");const s=(l=t.getPreferredCanvasFormat)==null?void 0:l.call(t);if(!s)throw Error("WebGPU not support! Adapter not found!");const r=await u.requestDevice(),c=e.getContext("webgpu"),{devicePixelRatio:n=1}=window;c.configure({device:r,format:s,alphaMode:"premultiplied"});const h=a.length/m,v=r.createRenderPipeline({vertex:{module:r.createShaderModule({code:E}),entryPoint:"main",buffers:[{attributes:[{shaderLocation:0,offset:0,format:`float32x${g}`},{shaderLocation:1,offset:4*g,format:`float32x${U}`}],arrayStride:4*h,stepMode:"vertex"}]},fragment:{module:r.createShaderModule({code:y}),entryPoint:"main",targets:[{format:s}]},primitive:{topology:"triangle-list"},layout:"auto"}),f=r.createBuffer({size:a.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});r.queue.writeBuffer(f,0,a,0,a.length);const x=()=>{const i=r.createCommandEncoder(),o=i.beginRenderPass({colorAttachments:[{view:c.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});o.setPipeline(v),o.setVertexBuffer(0,f),o.draw(m),o.end(),r.queue.submit([i.finish()])},d=i=>{const{width:o,height:P,clientHeight:w,clientWidth:b}=e;if(i&&o===b*n&&P===w*n)return;const V={width:e.clientWidth*n,height:e.clientHeight*n};Object.assign(e,V),x()};return d(),C(e,d)}export{q as render};
