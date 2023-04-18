export const router = {
    hash: false,
    beforeHooks: new Set<(s: string) => void>(),
    afterHooks: new Set<(s: string) => void>(),
    push(url: string) {},
    replace(url: string) {},
    before(cb: (s: string) => void) {
        this.beforeHooks.add(cb);
        return () => this.beforeHooks.delete(cb);
    },
    after(cb: (s: string) => void) {
        this.afterHooks.add(cb);
        return () => this.afterHooks.delete(cb);
    },
};

(['push', 'replace'] as ('push' | 'replace')[]).forEach((e) => {
    router[e] = function (url: string) {
        url = url.trim();
        for (const cb of this.beforeHooks) {
            cb(url);
        }
        history[(e + 'State') as 'pushState']({}, '', (this.hash ? '#/' : '') + url);
        for (const cb of this.afterHooks) {
            cb(url);
        }
    };
});

addEventListener('popstate', () => {
    for (const cb of router.afterHooks) {
        cb(location.pathname);
    }
});
