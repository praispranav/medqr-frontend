import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

// Self-referencing by whichever domain actually served the request (same instinct as the QR redirect
// system) — so this site ranks correctly under clinicq.praispranav.com right now, and clinicq.fit once
// that's live, with no env flip or redeploy needed either time. NEXT_PUBLIC_SITE_URL is only a
// fallback for contexts with no request (e.g. a build-time check).
function siteUrl(): string {
  const host = headers().get('host');
  if (host && !/^(localhost|127\.0\.0\.1)/.test(host)) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.fit';
}

export default function robots(): MetadataRoute.Robots {
  const SITE_URL = siteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/manage',
        '/manage/',
        '/owner',
        '/owner/',
        '/patient',
        '/patient/',
        // Note: NOT a bare "/doctor" — that's a prefix match, so it would also disallow
        // "/doctors/<slug>", the public doctor profile pages (Decision 50), since every path under
        // "/doctors/" literally starts with the string "/doctor". "/doctor/" (with the trailing
        // slash) blocks only the private staff portal (/doctor/dashboard, /doctor/hours, …) without
        // touching "/doctors/...".
        '/doctor/',
        '/reception',
        '/reception/',
        '/login',
        '/setup-password',
        '/change-password',
        '/q/',
      ],
    },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/duplicatesitemap.xml`,
      `${SITE_URL}/sitemap_index.xml`,
    ],
  };
}
