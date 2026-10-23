import { defineConfig } from 'vite';

// 生产构建使用 GitHub Pages 子路径 /SEAPP1/；开发服务器保持根路径，二者不冲突。
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/SEAPP1/' : '/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
  },
}));
