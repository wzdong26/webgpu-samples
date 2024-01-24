var u=`@vertex
fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 3>(
	    vec2<f32>(0.0, 0.5),
	    vec2<f32>(-0.5, -0.5),
	    vec2<f32>(0.5, -0.5)
    );
    return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}`,s=`@fragment
fn main() -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
}`;async function l(e){var c;const t=await((c=navigator.gpu)==null?void 0:c.requestAdapter({powerPreference:"high-performance"}));if(!t)throw Error("WebGPU not support! Adapter not found!");const n=await t.requestDevice(),o=e.getContext("webgpu"),r=navigator.gpu.getPreferredCanvasFormat(),a=window.devicePixelRatio||1;e.width=e.clientWidth*a,e.height=e.clientHeight*a;const i={width:e.width,height:e.height};return o.configure({device:n,format:r,alphaMode:"opaque"}),{device:n,context:o,format:r,size:i}}async function g(e,t){const n={layout:"auto",vertex:{module:e.createShaderModule({code:u}),entryPoint:"main"},primitive:{topology:"triangle-list"},fragment:{module:e.createShaderModule({code:s}),entryPoint:"main",targets:[{format:t}]},multisample:{count:4}};return await e.createRenderPipelineAsync(n)}function d(e,t,n,o){const r=e.createCommandEncoder(),a={colorAttachments:[{view:o,resolveTarget:t.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]},i=r.beginRenderPass(a);i.setPipeline(n),i.draw(3),i.end(),e.queue.submit([r.finish()])}async function p(e){const{device:t,context:n,format:o,size:r}=await l(e),a=await g(t,o);let i=t.createTexture({size:r,format:o,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),c=i.createView();d(t,n,a,c),window.addEventListener("resize",()=>{r.width=e.width=e.clientWidth*devicePixelRatio,r.height=e.height=e.clientHeight*devicePixelRatio,i.destroy(),i=t.createTexture({size:r,format:o,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),c=i.createView(),d(t,n,a,c)})}export{p as render};
