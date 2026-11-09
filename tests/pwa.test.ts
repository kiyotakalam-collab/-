import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

async function worker(scope: string, keys: string[] = []) {
  const source = (await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'))
    .replace('__BUILD_VERSION__', 'current')
    .replace('/* __PRECACHE_URLS__ */ []', '["index.html","catalog.json","assets/app.js"]');
  const handlers = new Map<string, (event: any) => void>();
  const remove = vi.fn().mockResolvedValue(true);
  const claim = vi.fn().mockResolvedValue(undefined);
  const caches = { keys: async () => keys, delete: remove, open: vi.fn() };
  const network = vi.fn();
  runInNewContext(source, {
    self: { location: {href: `https://student.github.io${scope}sw.js`}, clients: {claim}, addEventListener: (type: string, handler: (event: any) => void) => handlers.set(type, handler) },
    caches, URL, Request, fetch: network,
  });
  return { handlers, remove, claim, caches, network };
}

describe('service worker update and sync boundaries', () => {
  it('clears old shell caches only for its own project scope', async () => {
    const own = 'culture-master-%2Frepo-a%2F-';
    const other = 'culture-master-%2Frepo-b%2F-';
    const app = await worker('/repo-a/', [`${own}shell-old`, `${own}shell-current`, `${own}images-v1`, `${other}shell-old`, 'unrelated-cache']);
    let done: Promise<unknown> = Promise.resolve();
    app.handlers.get('activate')!({waitUntil: (task: Promise<unknown>) => {done = task;}});
    await done;
    expect(app.remove.mock.calls).toEqual([[`${own}shell-old`]]);
    expect(app.claim).toHaveBeenCalledOnce();
  });

  it('does not intercept no-store synchronization even if the JSON was precached', async () => {
    const app = await worker('/history/'); const respond = vi.fn();
    app.handlers.get('fetch')!({request: new Request('https://student.github.io/history/catalog.json', {cache: 'no-store'}), respondWith: respond});
    expect(respond).not.toHaveBeenCalled();
    expect(app.caches.open).not.toHaveBeenCalled();
  });

  it('leaves external JSON/API requests to the network', async () => {
    const app = await worker('/history/'); const respond = vi.fn();
    app.handlers.get('fetch')!({request: new Request('https://script.google.com/macros/s/example/exec'), respondWith: respond});
    expect(respond).not.toHaveBeenCalled();
  });

  it('serves the offline shell on a no-store navigation reload', async () => {
    const app = await worker('/history/');
    const response = new Response('<html>offline shell</html>');
    const match = vi.fn().mockResolvedValue(response);
    app.caches.open.mockResolvedValue({match});
    const respond = vi.fn();
    app.handlers.get('fetch')!({request: {method: 'GET', url: 'https://student.github.io/history/', mode: 'navigate', cache: 'no-store', destination: 'document'}, respondWith: respond});
    expect(await respond.mock.calls[0][0]).toBe(response);
    expect(match.mock.calls[0][1]).toEqual({ignoreVary: true});
    expect(app.network).not.toHaveBeenCalled();
  });

  it('uses precached static scripts despite Vary Origin or a no-store reload', async () => {
    const app = await worker('/history/'); const response = new Response('app code');
    const match = vi.fn().mockImplementation((_request, options) => Promise.resolve(options?.ignoreVary ? response : undefined));
    app.caches.open.mockResolvedValue({match});
    const request = new Request('https://student.github.io/history/assets/app.js', {cache: 'no-store', headers: {Origin: 'https://student.github.io'}});
    Object.defineProperty(request, 'destination', {value: 'script'});
    const respond = vi.fn(); app.handlers.get('fetch')!({request, respondWith: respond});
    expect(await respond.mock.calls[0][0]).toBe(response);
    expect(app.network).not.toHaveBeenCalled();
  });
});

it('ships relative install metadata and PNG icons at the declared dimensions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  expect(manifest).toMatchObject({id: './', start_url: './', scope: './', display: 'standalone', lang: 'ja'});
  for (const icon of manifest.icons) {
    const png = await readFile(new URL(`../public/${icon.src}`, import.meta.url));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    const [width, height] = icon.sizes.split('x').map(Number);
    expect(png.readUInt32BE(16)).toBe(width);
    expect(png.readUInt32BE(20)).toBe(height);
  }
  expect(manifest.icons.some((icon: {purpose: string}) => icon.purpose === 'maskable')).toBe(true);
});
