var r=`@group(0) @binding(1) var mySampler: sampler;\r
@group(0) @binding(2) var myTexture: texture_2d<f32>;\r
\r
@fragment\r
fn main(\r
    @location(0) fragUV: vec2<f32>,\r
    @location(1) fragPosition: vec4<f32>\r
) -> @location(0) vec4<f32> {\r
    return textureSample(myTexture, mySampler, fragUV) * fragPosition;\r
}`;export{r as t};
