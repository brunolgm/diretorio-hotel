'use client';
import Image from 'next/image';
import { useState } from 'react';

function ImageContent({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <Image src={src} alt={alt} width={1200} height={800} unoptimized onError={() => setFailed(true)} className="h-auto w-full rounded-xl object-contain" />;
}
export function TourismImage({ src, alt }: { src: string | null; alt: string }) {
  return src ? <ImageContent key={src} src={src} alt={alt} /> : null;
}
