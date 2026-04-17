import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Diretório Hotel',
  description: 'Painel administrativo e diretório digital do hotel',
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