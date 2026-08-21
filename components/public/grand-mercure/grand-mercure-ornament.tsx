import type { CSSProperties } from 'react';
import backgroundMandala from '@/docs/references/grand-mercure-background-mandala.png';

type MandalaStyle = CSSProperties & {
  '--grand-mercure-background-mandala': string;
};

export function GrandMercureGlobalMandala({ internal = false }: { internal?: boolean }) {
  const style: MandalaStyle = {
    '--grand-mercure-background-mandala': `url("${backgroundMandala.src}")`,
  };

  return (
    <div
      className={`grand-mercure-global-mandala ${internal ? 'grand-mercure-global-mandala-internal' : ''}`}
      style={style}
      aria-hidden="true"
    >
      <span className="grand-mercure-global-mandala-art grand-mercure-global-mandala-left" />
      <span className="grand-mercure-global-mandala-art grand-mercure-global-mandala-right" />
    </div>
  );
}
