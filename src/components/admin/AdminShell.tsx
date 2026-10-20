'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { ADMIN_KEY_STORAGE, adminApi, platformAuth, type AdminApi, type PlatformAdminMe } from '@/lib/adminApi';
import { Icon, LoadingPage } from '@/components/patient/ui';

// Platform admin chrome (ClinicQ operators, not clinic staff). Sign in with email + password; the
// session is an httpOnly cookie (12 hours). Super admin accounts are created on the server with
// `npm run admin:create -- <email>` — there's no sign-up page. Referral partners (Decision 27) are
// created in Owner › Referrers and get a cut-down panel: their clinics + My earnings.

type NavItem = { href: string; label: string; icon: string } | { label: string; isCategory: true };

// Grouped the same way StaffShell groups its own sidebar (Decision 44) — headings only, nothing
// collapsible: 12 items across 4 short groups reads fine without adding a fold/unfold interaction.
const NAV: NavItem[] = [
  { href: '/owner', label: 'Activity', icon: 'monitoring' },
  { label: 'Clinics', isCategory: true },
  { href: '/owner/clinics', label: 'Clinics', icon: 'local_hospital' },
  { href: '/owner/listings', label: 'Clinic listings', icon: 'travel_explore' },
  { href: '/owner/doctor-details', label: 'Doctor details', icon: 'person_search' },
  { href: '/owner/claims', label: 'Claims & removals', icon: 'verified_user' },
  { href: '/owner/qr-codes', label: 'QR codes', icon: 'qr_code_2' },
  { label: 'Growth', isCategory: true },
  { href: '/owner/referrers', label: 'Referrers & marketers', icon: 'handshake' },
  { href: '/owner/coupons', label: 'Coupons', icon: 'sell' },
  { href: '/owner/leads', label: 'Trial requests', icon: 'inbox' },
  { label: 'Requests & support', isCategory: true },
  { href: '/owner/change-requests', label: 'Change requests', icon: 'rule' },
  { href: '/owner/reviews', label: 'Reviews', icon: 'star' },
  { href: '/owner/module-requests', label: 'Module requests', icon: 'extension' },
  { href: '/owner/setting-requests', label: 'Setting requests', icon: 'auto_awesome' },
  { href: '/owner/support', label: 'Support', icon: 'support_agent' },
  { label: 'Platform', isCategory: true },
  { href: '/owner/analytics', label: 'Analytics', icon: 'insights' },
  { href: '/owner/api-usage', label: 'API usage & credits', icon: 'speed' },
];

/** Splits the flat nav into headed sections: loose items first (no heading), then each category. */
function sectionsOf(nav: NavItem[]): { label: string | null; items: Extract<NavItem, { href: string }>[] }[] {
  const out: { label: string | null; items: Extract<NavItem, { href: string }>[] }[] = [];
  for (const item of nav) {
    if ('isCategory' in item) out.push({ label: item.label, items: [] });
    else {
      if (!out.length) out.push({ label: null, items: [] });
      out[out.length - 1].items.push(item);
    }
  }
  return out.filter((sec) => sec.items.length > 0);
}

const REFERRER_NAV = [
  { href: '/owner/clinics', label: 'My clinics', icon: 'local_hospital' },
  { href: '/owner/earnings', label: 'My earnings', icon: 'payments' },
];

export function AdminShell({ active, children }: { active: string; children: (api: AdminApi, me: PlatformAdminMe) => ReactNode }) {
  // undefined = checking, null = signed out
  const [me, setMe] = useState<PlatformAdminMe | null | undefined>(undefined);
  const api = useMemo(() => adminApi(''), []);

  // Fold-away sidebar sections: active section open by default, persists user toggles in localStorage
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin_sidebar_open_sections');
      if (saved) setOpenSections(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleSection = (label: string, isOpen: boolean) => {
    setOpenSections((prev) => {
      const next = { ...prev, [label]: !isOpen };
      try {
        localStorage.setItem('admin_sidebar_open_sections', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    platformAuth
      .me()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const signOut = async () => {
    await platformAuth.logout().catch(() => undefined);
    setMe(null);
  };

  if (me === undefined) return <LoadingPage />;
  if (!me) return <SignIn onOk={setMe} />;

  const referrer = me.role !== 'super';
  const marketer = me.role === 'marketer';
  const nav: NavItem[] = marketer
    ? [{ href: '/owner/listings', label: 'My clinic submissions', icon: 'travel_explore' }, { href: '/owner/earnings', label: 'My earnings', icon: 'payments' }]
    : referrer
      ? REFERRER_NAV
      : NAV;
  const flatItems = nav.filter((n): n is Extract<NavItem, { href: string }> => 'href' in n);
  // A referrer on a super-admin page (bookmark, old link) goes to their clinics instead.
  if (referrer && !flatItems.some((n) => n.href === active)) {
    if (typeof window !== 'undefined') window.location.replace(marketer ? '/owner/listings' : '/owner/clinics');
    return <LoadingPage />;
  }
  const sections = sectionsOf(nav);

  return (
    <div className="min-h-screen bg-surface text-on-surface lg:flex">
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-inverse-surface text-white min-h-screen sticky top-0 h-screen p-4 gap-4">
        <div className="flex items-center gap-2 px-2">
          <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center">
            <Icon name="admin_panel_settings" className="text-[22px]" />
          </div>
          <div>
            <p className="font-headline-sm text-headline-sm leading-tight">ClinicQ</p>
            <p className="font-label-sm text-label-sm uppercase opacity-70">{marketer ? 'Marketer' : referrer ? 'Referral partner' : 'Platform admin'}</p>
          </div>
        </div>
        <nav className="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto no-scrollbar custom-scrollbar pr-1">
          {sections.map((sec) => {
            const hasActive = sec.items.some(
              (n) => active === n.href || (n.href === '/owner/clinics' && active.startsWith('/owner/clinics/'))
            );
            const open = sec.label ? (openSections[sec.label] ?? hasActive) : true;

            return (
              <div key={sec.label ?? 'top'} className="flex flex-col gap-1">
                {sec.label && (
                  <button
                    type="button"
                    onClick={() => toggleSection(sec.label!, open)}
                    aria-expanded={open}
                    className="mt-3 mb-1 px-3 py-1 flex items-center justify-between rounded-lg hover:bg-white/10 transition-colors text-left group cursor-pointer"
                  >
                    <span className="font-label-sm text-label-sm opacity-60 group-hover:opacity-90 uppercase tracking-wider font-semibold">
                      {sec.label}
                    </span>
                    <Icon
                      name={open ? 'expand_less' : 'expand_more'}
                      className="text-[18px] opacity-60 group-hover:opacity-90 transition-transform"
                    />
                  </button>
                )}
                {open &&
                  sec.items.map((n) => (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-lg text-label-lg transition-colors ${
                        active === n.href || (n.href === '/owner/clinics' && active.startsWith('/owner/clinics/'))
                          ? 'bg-primary-container text-white'
                          : 'opacity-80 hover:bg-white/10 hover:opacity-100'
                      }`}
                    >
                      <Icon name={n.icon} className="text-[20px]" />
                      {n.label}
                    </Link>
                  ))}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-xl opacity-80 hover:bg-white/10 font-label-md text-label-md">
            <Icon name="home" className="text-[18px]" /> Website
          </Link>
          <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 rounded-xl opacity-80 hover:bg-white/10 font-label-md text-label-md text-left">
            <Icon name="logout" className="text-[18px]" /> Sign out
          </button>
          <p className="px-3 font-body-sm text-body-sm opacity-60 truncate">{me.email}</p>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-inverse-surface text-white px-4 h-14 flex items-center gap-3">
          <Icon name="admin_panel_settings" className="text-[22px]" />
          <span className="font-label-lg text-label-lg flex-1">{referrer ? 'ClinicQ partner' : 'ClinicQ admin'}</span>
          {flatItems.map((n) => (
            <Link key={n.href} href={n.href} className={`px-3 py-1.5 rounded-full font-label-md text-label-md ${active === n.href ? 'bg-primary-container' : 'opacity-80'}`}>
              {n.label}
            </Link>
          ))}
          <button onClick={signOut} aria-label="Sign out"><Icon name="logout" className="text-[20px]" /></button>
        </header>
        <main className="p-4 lg:p-8 max-w-6xl">{children(api, me)}</main>
      </div>
    </div>
  );
}

function SignIn({ onOk }: { onOk: (me: PlatformAdminMe) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const me = await platformAuth.login(email.trim(), password);
      try {
        localStorage.removeItem(ADMIN_KEY_STORAGE); // the old key login isn't used any more
      } catch {
        /* ignore */
      }
      onOk(me);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Can't reach the ClinicQ server.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-inverse-surface p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 shadow-xl flex flex-col gap-4"
      >
        <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
          <Icon name="admin_panel_settings" className="text-[26px]" />
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md">ClinicQ platform admin</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Sign in to manage clinics, QR codes and modules.</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Email</span>
          <input
            autoFocus
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button disabled={busy || !email.trim() || !password} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
