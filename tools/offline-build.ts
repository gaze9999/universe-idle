import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** 每次建置產生完整快取清單, 保留靜態部署子路徑, 不快取玩家資料 */
export function offlineBuild(): Plugin {
  let base = '/';
  let publicDir = '';
  return {
    name: 'universe-offline', enforce: 'post', apply: 'build',
    configResolved(config) { base = config.base; publicDir = config.publicDir; },
    generateBundle(_, bundle) {
      const publicFiles = readdirSync(publicDir, { recursive: true, encoding: 'utf8' })
        .filter(name => statSync(resolve(publicDir, name)).isFile())
        .map(name => name.replaceAll('\\', '/'));
      const files = [...Object.keys(bundle).filter(name => !name.endsWith('.map')), ...publicFiles].sort();
      const hash = createHash('sha256');
      for (const name of files) {
        const output = bundle[name];
        hash.update(name).update(output ? output.type === 'chunk' ? output.code : output.source : readFileSync(resolve(publicDir, name)));
      }
      const revision = hash.digest('hex').slice(0, 16);
      const source = `const cacheName = 'universe-idle-' + ${JSON.stringify(base)} + ${JSON.stringify(revision)};
const base = ${JSON.stringify(base)};
const assets = ${JSON.stringify(files.map(name => base + name))};
self.addEventListener('install', event => event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const prefix = 'universe-idle-' + base;
  await Promise.all((await caches.keys()).filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(base)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    if (event.request.mode === 'navigate') {
      return (await cache.match(base + 'index.html')) || fetch(event.request);
    }
    // This cache contains only the fixed public build assets, identical for every player.
    return (await cache.match(event.request, { ignoreVary: true })) || fetch(event.request);
  })());
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
