import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { fetchSitemapEntries, generateSitemapXml } from '@/lib/sitemapData';

export const dynamic = 'force-dynamic';

function siteUrl(): string {
  const host = headers().get('host');
  if (host && !/^(localhost|127\.0\.0\.1)/.test(host)) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.fit';
}

export async function GET() {
  const SITE_URL = siteUrl();
  const entries = await fetchSitemapEntries(SITE_URL);
  const xml = generateSitemapXml(entries);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
