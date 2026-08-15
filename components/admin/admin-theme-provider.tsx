import type { ReactNode } from 'react';
import { getAdminThemeStyle, type AdminTheme } from '@/lib/admin-theme';

export function AdminThemeProvider({
  theme,
  children,
}: {
  theme: AdminTheme;
  children: ReactNode;
}) {
  return (
    <div
      className="admin-theme min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)]"
      data-admin-theme={theme.code}
      data-admin-theme-preset={theme.themePreset || 'default'}
      data-admin-logo-treatment={theme.logoTreatment}
      style={getAdminThemeStyle(theme)}
    >
      {children}
    </div>
  );
}
