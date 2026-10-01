import Link from 'next/link';

// Shared chrome for /terms and /privacy — same header/footer language as the landing page,
// kept separate from the app's staff/patient shells since these are public, unauthenticated pages.

export function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-surface-container">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
              <span aria-hidden className="material-symbols-outlined leading-none text-[22px]">
                qr_code_2
              </span>
            </span>
            <span className="font-headline-sm text-headline-sm text-primary">MedQR</span>
          </Link>
          <nav className="ml-auto flex items-center gap-4 font-label-md text-label-md text-on-surface-variant">
            <Link href="/terms" className="hover:text-on-surface">Terms</Link>
            <Link href="/privacy" className="hover:text-on-surface">Privacy</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-8">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Last updated {updated}</p>
        </div>
        <div className="flex flex-col gap-8 font-body-md text-body-md text-on-surface leading-relaxed [&_h2]:font-headline-sm [&_h2]:text-headline-sm [&_h2]:text-on-surface [&_h2]:mb-2 [&_p]:text-on-surface-variant [&_section>*+*]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:text-on-surface-variant [&_li]:leading-relaxed [&_strong]:text-on-surface">
          {children}
        </div>
      </main>

      <footer className="border-t border-surface-container">
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col sm:flex-row gap-3 justify-between font-body-sm text-body-sm text-on-surface-variant">
          <p>© {new Date().getFullYear()} MedQR · Operated by Altis Labs</p>
          <div className="flex gap-4">
            <Link href="/">Home</Link>
            <Link href="/login">Doctor/Staff Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
