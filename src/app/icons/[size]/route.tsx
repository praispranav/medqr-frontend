import { appIcon } from '@/lib/appIcon';

// /icons/180 (iPhone Home Screen), /icons/192 and /icons/512 (manifest — Android install, Chrome).
const SIZES = new Set([180, 192, 512]);

export function GET(_req: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size);
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 });
  return appIcon(size);
}
