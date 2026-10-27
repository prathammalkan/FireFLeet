import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const publicRoot = resolve(process.cwd(), 'public');
const manifest = JSON.parse(readFileSync(resolve(publicRoot, 'manifest.json'), 'utf8')) as {
  start_url: string;
  scope: string;
  display: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
};
const serviceWorker = readFileSync(resolve(publicRoot, 'sw.js'), 'utf8');

describe('PWA release assets', () => {
  it('has installable manifest metadata and existing icon files', () => {
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/png')).toBe(true);
    expect(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.type === 'image/png')).toBe(true);

    for (const icon of manifest.icons) {
      const path = resolve(publicRoot, icon.src.replace(/^\//, ''));
      expect(existsSync(path)).toBe(true);
    }
  });

  it('stores valid PNG dimensions for the required install icons', () => {
    for (const size of [192, 512]) {
      const png = readFileSync(resolve(publicRoot, `icons/icon-${size}x${size}.png`));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });

  it('does not cache navigation or cross-origin/private API responses', () => {
    expect(serviceWorker).toContain("if (request.method !== 'GET') return;");
    expect(serviceWorker).toContain("if (url.origin !== self.location.origin) return;");
    expect(serviceWorker).toContain("if (request.mode === 'navigate')");
    expect(serviceWorker).toContain("const SW_VERSION = 'v6'");
    expect(readFileSync(resolve(process.cwd(), 'src/app/page.tsx'), 'utf8')).toContain('registration.update()');
    expect(serviceWorker).not.toContain('supabase.co');
  });
});
