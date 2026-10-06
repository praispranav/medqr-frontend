import type { Metadata, Viewport } from 'next';
import './globals.css';

// Google Tag Manager container (as given by GTM: script high in <head>, noscript iframe right after <body>).
const GTM_ID = 'GTM-WZFZQ5L6';
const GTM_SNIPPET = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`;

export const metadata: Metadata = {
  title: 'MedQR | Smart Clinic Queue Management & Digital OPD Tokens',
  description: 'Transform your clinic with MedQR. Offer patients digital tokens, live WhatsApp queue updates, and seamless check-ins. No app required.',
  keywords: 'clinic queue management system, digital OPD tokens, patient check-in software, doctor appointment system, smart clinic software',
  appleWebApp: { capable: true, title: 'MedQR', statusBarStyle: 'default' },
  icons: { apple: '/icons/180' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* JSON-LD Schema for SaaS Product */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "MedQR",
  "applicationCategory": "HealthApplication",
  "operatingSystem": "Web",
  "description": "Smart clinic queue management system enabling digital OPD tokens, live queue tracking, and automated patient alerts.",
  "offers": {
    "@type": "Offer",
    "price": "999",
    "priceCurrency": "INR"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "ratingCount": "120"
  }
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap"
        />
        {/* Icon font: only the axes we use (24px, weight 400, outlined + filled) — ~460 KB instead of the
            ~4 MB full variable font, which made icons appear late on mobile data. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&display=block"
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
