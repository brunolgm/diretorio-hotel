'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Download, QrCode } from 'lucide-react';

export function RoomQrCard({
  publicUrl,
  roomNumber,
  isActive,
}: {
  publicUrl: string;
  roomNumber: string;
  isActive: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'done'>('idle');

  useEffect(() => {
    let isMounted = true;

    async function loadQr() {
      const QRCode = await import('qrcode');
      const nextDataUrl = await QRCode.toDataURL(publicUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 256,
      });

      if (isMounted) {
        setQrDataUrl(nextDataUrl);
      }
    }

    loadQr().catch(() => {
      if (isMounted) {
        setQrDataUrl(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [publicUrl]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyState('done');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('idle');
    }
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            QR público
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            Apartamento {roomNumber}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {isActive ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      <div className="mt-4 flex items-start gap-4">
        <div className="flex h-28 w-28 items-center justify-center rounded-[24px] bg-white ring-1 ring-slate-200">
          {qrDataUrl ? (
            <div
              role="img"
              aria-label={`QR do apartamento ${roomNumber}`}
              className="h-24 w-24 bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${qrDataUrl})` }}
            />
          ) : (
            <QrCode className="h-8 w-8 text-slate-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            Link do QR
          </p>
          <p className="mt-2 break-all text-sm leading-6 text-slate-600">{publicUrl}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {copyState === 'done' ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copyState === 'done' ? 'Link copiado' : 'Copiar link'}
            </button>

            {qrDataUrl ? (
              <a
                href={qrDataUrl}
                download={`libguest-apartamento-${roomNumber}.png`}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar QR
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
