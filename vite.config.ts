import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  return {
    base: '',
    resolve: {
      alias: [
        {
          find: '@',
          replacement: path.resolve(__dirname, './src/'),
        },
      ],
    },
    build: {
      outDir: `docs`,
    },
  };
});
