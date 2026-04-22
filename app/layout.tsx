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
    'GuestDesk é a base digital para hotéis apresentarem serviços, contatos, políticas e informações importantes com mais clareza, presença de marca e operação simples.',
  openGraph: {
    title: 'GuestDesk',
    description:
      'Presença digital premium para hotéis, com painel administrativo simples e experiência pública elegante para hóspedes.',
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
