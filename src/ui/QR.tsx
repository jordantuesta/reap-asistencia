import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function urlApp(): string {
  return location.origin + location.pathname + '#/app';
}

export default function QR({ texto, size = 168 }: { texto: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(texto, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0F2A44', light: '#FFFFFF' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [texto]);
  return <div style={{ width: size, height: size }} className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
