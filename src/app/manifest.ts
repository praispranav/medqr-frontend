import type { MetadataRoute } from 'next';

// Lets patients "Add to Home Screen" — on iPhone that's required for web push alerts (iOS 16.4+).
// No start_url on purpose: the Home Screen icon reopens the page it was added from (their token).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MedQR — Clinic Queue',
    short_name: 'MedQR',
    display: 'standalone',
    background_color: '#f7f9ff',
    theme_color: '#005c55',
  };
}
