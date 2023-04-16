export async function requestAdapter() {
    const adapter = await navigator.gpu?.requestAdapter({});
    if (!adapter) throw Error('WebGPU not support! Adapter not found!');
    return adapter;
}
