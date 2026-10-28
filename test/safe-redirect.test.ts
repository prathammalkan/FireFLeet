import { isTrustedHost, safeNextPath } from '../src/lib/safe-redirect';

describe('safeNextPath', () => {
  it('accepts same-origin application paths', () => {
    expect(safeNextPath('/settings?tab=data#export')).toBe('/settings?tab=data#export');
  });

  it('rejects external and protocol-relative targets', () => {
    expect(safeNextPath('//evil.example/login')).toBe('/');
    expect(safeNextPath('https://evil.example/login')).toBe('/');
    expect(safeNextPath('/\\\\evil.example')).toBe('/');
  });
});

describe('isTrustedHost', () => {
  it('accepts the configured production host', () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://fire-f-leet.vercel.app';
    expect(isTrustedHost('fire-f-leet.vercel.app')).toBe(true);
    expect(isTrustedHost('attacker.example')).toBe(false);
    process.env.NEXT_PUBLIC_APP_URL = previous;
  });
});
