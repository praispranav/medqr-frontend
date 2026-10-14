import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';

// Google Tag Manager container (as given by GTM: script high in <head>, noscript iframe right after <body>).
const GTM_ID = 'GTM-WZFZQ5L6';
const GTM_SNIPPET = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`;

// metadataBase is self-referencing by whichever domain actually served the request (see robots.ts) —
// so canonical/OG URLs are correct under clinicq.praispranav.com today and clinicq.in later, with no
// env flip or redeploy either time.
function siteUrl(): string {
  const host = headers().get('host');
  if (host && !/^(localhost|127\.0\.0\.1)/.test(host)) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.in';
}

export async function generateMetadata(): Promise<Metadata> {
  const url = siteUrl();
  const title = 'ClinicQ | Smart Clinic Queue Management & Digital OPD Tokens';
  const description = 'Transform your clinic with ClinicQ. Offer patients digital tokens, live WhatsApp queue updates, and seamless check-ins. No app required.';

  return {
    metadataBase: new URL(url),
    title,
    description,
    keywords: 'clinic queue management system, digital OPD tokens, patient check-in software, doctor appointment system, smart clinic software',
    alternates: {
      canonical: '/',
    },
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
    <html lang="en">
      <head>
        {/* JSON-LD Schema for SaaS Product — only true, non-fabricated facts (Google's Review Snippet /
            structured-data policy treats made-up ratings as spam and can trigger a manual action; this
            project's own rule is also "no invented stats/testimonials" — never add aggregateRating or
            a reviewCount here without real review data behind it). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "ClinicQ",
  "applicationCategory": "HealthApplication",
  "operatingSystem": "Web",
  "description": "Smart clinic queue management system enabling digital OPD tokens, live queue tracking, and automated patient alerts.",
})
          }}
        />
        {/* Google Tag Manager */}
        <script dangerouslySetInnerHTML={{ __html: GTM_SNIPPET }} />
        {/* End Google Tag Manager */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@400;600;700;800&family=Newsreader:ital,wght@0,400;0,500;0,600;1,500&display=swap"
        />
        {/* Icon font: display=swap prevents render blocking */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&display=swap"
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
