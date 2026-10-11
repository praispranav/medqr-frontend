import { faviconIcon } from '@/lib/appIcon';

// Browsers ask for /favicon.ico on their own, so serve the same icon there as the <link rel="icon"> tags.
export function GET() {
  const icon = faviconIcon(48);
  return new Response(icon.body, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
}
