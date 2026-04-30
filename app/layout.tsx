import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://libguest.digital'),
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/icon.svg'],
  },
  title: {
    default: 'LibGuest',
    template: '%s | LibGuest',
  },
  description:
    'LibGuest é a plataforma para hotéis organizarem serviços, contatos, políticas e informações importantes com mais clareza, apresentação premium e operação simples.',
  openGraph: {
    title: 'LibGuest',
    description:
      'Uma plataforma de hospitalidade digital para hotéis com painel administrativo simples e experiência pública premium.',
    url: 'https://libguest.digital',
    siteName: 'LibGuest',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
