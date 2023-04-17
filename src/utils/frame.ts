export function throttleFrame(fn: (time: number) => void) {
    let isRequest = false;
    return () => {
        if (isRequest) return;
        isRequest = true;
        const cleanFlag = requestAnimationFrame(function (time) {
            cleanup();
            isRequest = false;
            fn(time);
        });
        const cleanup = () => cancelAnimationFrame(cleanFlag);
        return cleanup;
    };
}

export function animationFrame(fn: (time: number) => void) {
    let flag = false;
    const frame = throttleFrame(function (time: number) {
        if (flag) return;
        fn(time);
        frame();
    });
    frame();
    return () => {
        flag = true;
    };
}
