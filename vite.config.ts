import { defineConfig, mergeConfig } from 'vite';
import { createRequire } from 'node:module';
import vue from '@vitejs/plugin-vue';
import { offlineBuild } from './tools/offline-build.ts';

createRequire(import.meta.url)('./tools/vue-compiler.cjs');

export default defineConfig(async ({ command, mode }) => {
  const config = { plugins: [vue(), offlineBuild()], base: '/universe-idle/', build: { target: 'es2022' } };
  if (command !== 'serve' || mode !== 'dev') return config;
  const local = new URL('./local-dev/vite.config.ts', import.meta.url);
  try { return mergeConfig(config, (await import(local.href)).default); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND' && 'url' in error && error.url === local.href) return config;
    throw error;
  }
});
