import { ImageResponse } from 'next/og';

// The MedQR app icon (Home Screen / install): white "Q" mark on the brand teal. Drawn at any size
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
