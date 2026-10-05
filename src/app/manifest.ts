import type { MetadataRoute } from 'next';

// Lets patients "Add to Home Screen" — on iPhone that's required for web push alerts (iOS 16.4+).
// No start_url on purpose: the Home Screen icon opens the address the page had when it was added
// (AddToHomeScreen sets it to the clinic page + a one-time hand-off code).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MedQR — Clinic Queue',
    short_name: 'MedQR',
    display: 'standalone',
    background_color: '#f7f9ff',
    theme_color: '#005c55',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
