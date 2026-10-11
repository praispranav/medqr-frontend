import { appIcon, faviconIcon } from '@/lib/appIcon';

// /icons/32 and /icons/48 (browser-tab favicon), /icons/180 (iPhone Home Screen), /icons/192 and /icons/512 (manifest — Android install, Chrome).
const SIZES = new Set([32, 48, 180, 192, 512]);

export function GET(_req: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size);
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 });
  return size <= 48 ? faviconIcon(size) : appIcon(size);
}
