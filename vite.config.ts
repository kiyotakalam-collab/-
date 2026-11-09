import { defineConfig, type Plugin } from 'vite';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';

function offlineShell(): Plugin {
  let output = '';
  return {
    name: 'culture-offline-shell',
    apply: 'build',
    configResolved(config) { output = resolve(config.root, config.build.outDir); },
    async closeBundle() {
      const files: string[] = [];
      async function walk(directory: string): Promise<void> {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) await walk(path);
          else {
            const name = relative(output, path).replaceAll('\\', '/');
            if (name !== 'sw.js' && !name.endsWith('.map') && !name.startsWith('.')) files.push(name);
          }
        }
      }
      await walk(output);
      files.sort();
      const hash = createHash('sha256');
      const source = await readFile(join(output, 'sw.js'), 'utf8');
      hash.update(source);
      for (const file of files) { hash.update(file); hash.update(await readFile(join(output, file))); }
      const worker = source.replace('__BUILD_VERSION__', hash.digest('hex').slice(0, 16))
        .replace('/* __PRECACHE_URLS__ */ []', JSON.stringify(files));
      await writeFile(join(output, 'sw.js'), worker);
    },
  };
}

export default defineConfig({ base: './', plugins: [offlineShell()] });
