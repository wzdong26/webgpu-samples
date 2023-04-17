// observe el size change by `ResizeObserver`
export function resizeObserver() {
    const cbs = new WeakMap();
    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            cbs.get(entry.target)?.(entry);
        }
    });
    return {
        onResize(el: Element, cb: (entry: ResizeObserverEntry) => void) {
            cbs.set(el, cb.bind(el));
            observer.observe(el);
            return () => observer.unobserve(el);
        },
        disconnect: () => observer.disconnect(),
    };
}

const { onResize, disconnect } = resizeObserver();

// onResize can be wrapped as a throttling function.
export { onResize, disconnect };
