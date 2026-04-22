import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://guestdesk.digital'),
  title: {
    default: 'GuestDesk',
    template: '%s | GuestDesk',
  },
  description:
    'GuestDesk é a plataforma para hotéis organizarem serviços, contatos, políticas e informações importantes com mais clareza, apresentação premium e operação simples.',
  openGraph: {
    title: 'GuestDesk',
    description:
      'Uma plataforma de hospitalidade digital para hotéis com painel administrativo simples e experiência pública premium.',
    url: 'https://guestdesk.digital',
    siteName: 'GuestDesk',
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
