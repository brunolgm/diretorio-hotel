import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { resolveAdminTheme } from '../../lib/admin-theme.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
    const [red, green, blue] = channels.map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

test('resolves every canonical hotel brand to its own admin identity', () => {
  assert.equal(resolveAdminTheme('grand-mercure').code, 'grand-mercure');
  assert.equal(resolveAdminTheme('mercure').code, 'mercure');
  assert.equal(resolveAdminTheme('novotel').code, 'novotel');

  const themes = ['grand-mercure', 'mercure', 'novotel'].map(
    (brandCode) => resolveAdminTheme(brandCode).colors
  );
  assert.equal(new Set(themes.map((theme) => theme.sidebar)).size, 3);
  assert.equal(new Set(themes.map((theme) => theme.accent)).size, 3);
});

test('uses LibGuest Default for null and unknown brand codes', () => {
  assert.equal(resolveAdminTheme(null).code, 'libguest-default');
  assert.equal(resolveAdminTheme(undefined).code, 'libguest-default');
  assert.equal(resolveAdminTheme('unexpected-brand').code, 'libguest-default');
});

test('shows only natural canonical brand labels in the sidebar', () => {
  const layout = read('app', 'admin', 'layout.tsx');
  const sidebar = read('components', 'admin', 'admin-sidebar.tsx');

  assert.match(layout, /themeLabel=\{adminTheme\.brandCode \? adminTheme\.label : null\}/);
  assert.doesNotMatch(sidebar, /Identidade \{themeLabel\}/);
  assert.match(sidebar, /\{themeLabel\}/);
});

test('allows only bounded preset refinement and keeps semantic colors stable', () => {
  const base = resolveAdminTheme('grand-mercure', 'midnight-slate');
  const refined = resolveAdminTheme('grand-mercure', 'graphite-gold');

  assert.notEqual(base.colors.surfaceMuted, refined.colors.surfaceMuted);
  assert.equal(base.colors.sidebar, refined.colors.sidebar);
  assert.equal(base.colors.accent, refined.colors.accent);
  assert.deepEqual(base.semantic, refined.semantic);
  assert.deepEqual(base.semantic, resolveAdminTheme('novotel').semantic);
});

test('keeps critical text pairs at accessible contrast in every theme', () => {
  for (const brandCode of [null, 'grand-mercure', 'mercure', 'novotel']) {
    const theme = resolveAdminTheme(brandCode);
    assert.ok(contrastRatio(theme.colors.accentText, theme.colors.accent) >= 4.5);
    assert.ok(contrastRatio(theme.colors.sidebarText, theme.colors.sidebar) >= 4.5);
    assert.ok(contrastRatio(theme.colors.activeText, theme.colors.activeBackground) >= 4.5);
  }

  const navigation = read('components', 'admin', 'nav-links.tsx');
  assert.match(navigation, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.match(navigation, /before:bg-\[var\(--admin-accent\)\]/);
});

test('resolves the admin theme server-side from the scoped hotel only', () => {
  const layout = read('app', 'admin', 'layout.tsx');
  const provider = read('components', 'admin', 'admin-theme-provider.tsx');
  const mobileMenu = read('components', 'admin', 'mobile-menu.tsx');
  const resolver = read('lib', 'admin-theme.ts');

  assert.match(layout, /requireAdminAccess\('visualizador'\)/);
  assert.match(layout, /\.eq\('id', profile\.hotel_id\)/);
  assert.match(layout, /select\('name, city, logo_url, brand_code, theme_preset'\)/);
  assert.match(layout, /resolveAdminTheme\(hotel\?\.brand_code, hotel\?\.theme_preset\)/);
  assert.doesNotMatch(layout, /searchParams|query|string|localStorage/i);
  assert.doesNotMatch(provider, /use client|localStorage|searchParams/i);
  assert.doesNotMatch(resolver, /theme_primary_color|window\.|document\./i);
  assert.match(mobileMenu, /className="admin-theme/);
  assert.match(mobileMenu, /style=\{themeStyle\}/);
  assert.match(layout, /themeStyle=\{adminThemeStyle\}/);
});

test('keeps platform and public experiences outside the admin brand theme', () => {
  const platformLayout = read('app', 'platform', 'layout.tsx');
  const platformFiles = [
    platformLayout,
    read('components', 'platform', 'platform-nav.tsx'),
    read('app', 'platform', 'page.tsx'),
  ].join('\n');
  const publicResolver = read('lib', 'hotel-theme.ts');

  assert.doesNotMatch(platformFiles, /AdminThemeProvider|resolveAdminTheme|data-admin-theme/);
  assert.doesNotMatch(publicResolver, /AdminThemeProvider|resolveAdminTheme|--admin-/);
});

test('does not change guards, server actions or database security contracts', () => {
  const themeFiles = [
    read('lib', 'admin-theme.ts'),
    read('components', 'admin', 'admin-theme-provider.tsx'),
  ].join('\n');

  assert.doesNotMatch(themeFiles, /\.from\(|\.rpc\(|service_role|supabase|insert\(|update\(|delete\(/i);
  assert.doesNotMatch(themeFiles, /use server|use client/i);
});
