import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Newsreader } from 'next/font/google';
import { COMPANY_NAME, COMPANY_URL } from '@/components/support/contactInfo';
import { headers } from 'next/headers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
});

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
  weight: ['400', '600', '700', '800'],
});

const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  weight: ['400', '500', '600'],
  adjustFontFallback: false,
});

// Google Tag Manager container (as given by GTM: script high in <head>, noscript iframe right after <body>).
const GTM_ID = 'GTM-WZFZQ5L6';
const GTM_SNIPPET = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`;

// metadataBase is self-referencing by whichever domain actually served the request (see robots.ts) —
// so canonical/OG URLs are correct under clinicq.praispranav.com today and clinicq.fit later, with no
// env flip or redeploy either time.
function siteUrl(): string {
  const host = headers().get('host');
  if (host && !/^(localhost|127\.0\.0\.1)/.test(host)) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.fit';
}

export async function generateMetadata(): Promise<Metadata> {
  const url = siteUrl();
  // Decision 66: ClinicQ is a doctor & clinic directory; online OPD booking is one of its products.
  const title = 'ClinicQ | Find Doctors & Clinics Near You — Timings, Address & Online OPD Booking';
  const description = 'Find doctors, clinics and hospitals near you with OPD timings, address and directions. Book an online OPD token at clinics that offer it — no app needed.';

  return {
    metadataBase: new URL(url),
    title,
    description,
    keywords: 'doctors near me, doctor in Patna, clinic near me, hospitals in Patna, doctors in Sitamarhi, online OPD booking, OPD token, doctor timings',
    // No site-wide canonical: each page sets its own (a layout canonical of '/' told Google every page was the home page).
    openGraph: {
      title,
      description,
      url,
      siteName: 'ClinicQ',
      locale: 'en_IN',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    appleWebApp: { capable: true, title: 'ClinicQ', statusBarStyle: 'default' },
    icons: {
      icon: [
        { url: '/icons/32', sizes: '32x32', type: 'image/png' },
        { url: '/icons/192', sizes: '192x192', type: 'image/png' },
      ],
      shortcut: '/favicon.ico',
      apple: '/icons/180',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${newsreader.variable}`}>
      <head>
        {/* JSON-LD Schema for SaaS Product — only true, non-fabricated facts (Google's Review Snippet /
            structured-data policy treats made-up ratings as spam and can trigger a manual action; this
            project's own rule is also "no invented stats/testimonials" — never add aggregateRating or
            a reviewCount here without real review data behind it). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'ClinicQ',
                url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.fit',
                description: 'Doctor and clinic directory with online OPD booking at participating clinics.',
                potentialAction: {
                  '@type': 'SearchAction',
                  target: { '@type': 'EntryPoint', urlTemplate: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.fit'}/doctors?q={search_term_string}` },
                  'query-input': 'required name=search_term_string',
                },
              },
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'ClinicQ',
                url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.fit',
                logo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.fit'}/icons/192`,
                parentOrganization: { '@type': 'Organization', name: COMPANY_NAME, url: COMPANY_URL },
              },
            ]).replace(/</g, '\\u003c')
          }}
        />
        {/* Google Tag Manager */}
        <script dangerouslySetInnerHTML={{ __html: GTM_SNIPPET }} />
        {/* End Google Tag Manager */}
        {/* Preload self-hosted Material Symbols font to eliminate critical request chain and FOUT */}
        <link
          rel="preload"
          href="/fonts/material-symbols-outlined.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-body-md antialiased">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {children}
      </body>
    </html>
  );
}
