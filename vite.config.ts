import type { UserConfig } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import path from 'path';

// vite config
let config: UserConfig = {};
// plugins
config.plugins = [
];
// resolve
config.resolve = {};
// alias
config.resolve.alias = [
    {
        find: '@',
        replacement: path.resolve(__dirname, './src/'),
    },
];

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
    const { VITE_BASE_URL_PATH } = loadEnv(
        mode,
        process.cwd()
    );
    // base
    config.base = VITE_BASE_URL_PATH;
    if (command === 'serve') {
        // dev 独有配置

        // server
        config.server = {
            // host: true, // 服务器主机名
            hmr: true,
            port: 8081,
            // open: true,
            // https: true,
            proxy: {
                '/api': {
                    target: '', // 配置api地址
                    // changeOrigin: true,
                    // rewrite: (path) => path.replace(/^\/api/, '')
                },
            },
        };
    } else if (command === 'build') {
        // build 独有配置
        // build
        config.build = {
            outDir: `./dist${config.base}`,
            target: ['edge90', 'chrome90', 'firefox90', 'safari15', 'esnext'],
        };
        // config.productionSourceMap= true
        // https://webpack.js.org/configuration/devtool/#production
        // config.devtool= '#source-map',
    }
    return config;
});
