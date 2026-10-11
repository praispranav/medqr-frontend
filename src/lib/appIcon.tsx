import { ImageResponse } from 'next/og';

// The ClinicQ app icon (Home Screen / install): white "Q" mark on the brand teal. Drawn at any size
// so iPhone (180), Android (192 / 512) and the maskable safe zone all come from one design.
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#005c55' }}>
        <div
          style={{
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: size * 0.14,
            border: `${Math.round(size * 0.055)}px solid #ffffff`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: size * 0.3,
            fontWeight: 800,
          }}
        >
          Q
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}

/** Browser-tab favicon: a bold white "Q" drawn as shapes (a font would render it too thin at 32px) on the brand teal. */
export function faviconIcon(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="22" fill="#005c55" />
          <circle cx="48" cy="47" r="23" fill="none" stroke="#ffffff" strokeWidth="12" />
          <line x1="60" y1="59" x2="79" y2="78" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
