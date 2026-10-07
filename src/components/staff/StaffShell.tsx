'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type DoctorToday, type Me, type SubscriptionStatus, type Tenant } from '@/lib/api';
import { HOME_FOR_ROLE } from '@/lib/staffRoutes';
import { DoctorAvatar, Icon, LoadingPage } from '@/components/patient/ui';

// Shared chrome for the staff screens (Reception #4, Doctor Suite #5/#6/#9/#10 + QR poster),
// following the sidebar layout the Stitch staff screens share.
//
// Access comes from the staff login (/login): reception and doctor accounts are separate, and the
// server enforces the role on every staff API. A logged-in reception account opening a doctor
// screen (or vice versa) gets a clear "wrong login" page instead of the screen.
//
// 'manage' is the clinic admin (Decision 14): a separate owner login, or a doctor given owner
// access by MedQR. Solo-doctor clinics never need it — their doctor keeps Billing and Queue Rules;
// with 2+ doctors those two move to the clinic admin only.

export interface StaffContext {
  tenant: Tenant;
  doctors: DoctorToday[];
  /** Only set in the doctor suite. */
  doctor: DoctorToday | null;
  refreshTenant: () => Promise<void>;
  me: Me;
}

type Variant = 'reception' | 'doctor' | 'manage';
type NavItem = { href?: string; label: string; icon?: string; managersOnly?: boolean; isCategory?: boolean };

const NAV: Record<Variant, NavItem[]> = {
  doctor: [
    { label: 'Patient', isCategory: true },
    { href: '/doctor/dashboard', label: 'My Queue', icon: 'space_dashboard' },
    { href: '/doctor/payments', label: 'Payments', icon: 'currency_rupee' },
    { label: 'Doctor', isCategory: true },
    { href: '/doctor/hours', label: 'My Hours', icon: 'schedule' },
    { href: '/doctor/profile', label: 'Public Profile', icon: 'badge' },
    { label: 'Settings', isCategory: true },
    { href: '/doctor/settings', label: 'Queue Rules', icon: 'tune', managersOnly: true },
    { href: '/doctor/notifications', label: 'Patient Notifications', icon: 'notifications_active' },
    { href: '/doctor/intake-form', label: 'Intake Form', icon: 'assignment' },
    { href: '/doctor/qr-poster', label: 'QR Standee', icon: 'qr_code_2' },
    { href: '/doctor/billing', label: 'Billing & Add-ons', icon: 'account_balance_wallet', managersOnly: true },
  ],
  reception: [
    { href: '/reception', label: 'Queue Verifier', icon: 'qr_code_scanner' },
    { href: '/reception/payments', label: 'Payments', icon: 'currency_rupee' },
  ],
  manage: [
    { href: '/manage', label: 'Today', icon: 'monitoring' },
    { href: '/manage/money', label: 'Money', icon: 'currency_rupee' },
    { href: '/manage/activity', label: 'Activity', icon: 'history' },
    { href: '/manage/team', label: 'Doctors & Staff', icon: 'group' },
    { href: '/manage/qr', label: 'QR Standees', icon: 'qr_code_2' },
    { href: '/manage/clinic', label: 'Clinic Profile', icon: 'apartment' },
    { href: '/manage/settings', label: 'Queue Rules', icon: 'tune' },
    { href: '/manage/billing', label: 'Billing & Add-ons', icon: 'account_balance_wallet' },
  ],
};

const ROLE_LABEL: Record<Me['user']['role'], string> = { doctor: 'Doctor', reception: 'Reception', owner: 'Clinic admin' };

// Decision 18: the public read-only demo never shows payments or admin-ish config screens.
const DEMO_HIDDEN_HREFS = new Set(['/doctor/payments', '/doctor/settings', '/doctor/billing', '/doctor/profile', '/doctor/notifications', '/doctor/intake-form', '/reception/payments']);

function navFor(variant: Variant, me: Me, isDemo: boolean): NavItem[] {
  let items: NavItem[];
  if (variant === 'doctor') {
    // In a multi-doctor clinic, a doctor with owner access finds these under Clinic admin instead.
    const soloDoctor = me.doctor_count <= 1;
    items = NAV.doctor.filter((i) => !i.managersOnly || soloDoctor);
    if (me.user.is_owner && !soloDoctor) items.push({ href: '/manage', label: 'Clinic admin', icon: 'admin_panel_settings' });
  } else if (variant === 'manage' && me.user.role === 'doctor') {
    items = [...NAV.manage, { href: '/doctor/dashboard', label: 'My queue', icon: 'space_dashboard' }];
  } else {
    items = NAV[variant];
  }
  return isDemo ? items.filter((i) => !DEMO_HIDDEN_HREFS.has(i.href || '')) : items;
}

export function StaffShell({
  variant,
  active,
  managersOnly = false,
  headerAction,
  children,
}: {
  variant: Variant;
  active: string;
  /** Billing / Queue Rules: solo doctor or clinic admin only (Decision 14). */
  managersOnly?: boolean;
  headerAction?: ReactNode;
  children: (ctx: StaffContext) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [doctors, setDoctors] = useState<DoctorToday[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);

  const load = useCallback(async () => {
    const who = await api.me();
    // Decision 15: a bookmarked/direct link shouldn't skip the forced password change either.
    if (who.user.must_change_password) return who;
    const [t, ds] = await Promise.all([api.getMyTenant(), api.getDoctorsToday(who.tenant.id)]);
    setMe(who);
    setTenant(t);
    setDoctors(ds);
    api.getSubscription().then(setSub).catch(() => undefined); // Decision 18: banner is best-effort, never blocks the shell
    return who;
  }, []);

  useEffect(() => {
    load()
      .then((who) => {
        if (who.user.must_change_password) router.replace(`/change-password?next=${encodeURIComponent(pathname)}`);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        } else {
          setFailed(true);
        }
      });
  }, [load, router, pathname]);

  const refreshTenant = useCallback(async () => {
    const [t, ds] = await Promise.all([api.getMyTenant(), api.getDoctorsToday(me?.tenant.id ?? '')]);
    setTenant(t);
    setDoctors(ds);
  }, [me?.tenant.id]);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    router.replace('/login');
  };

  if (failed)
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-headline-md text-headline-md">Can&apos;t reach MedQR</p>
        <p className="font-body-md text-body-md text-on-surface-variant">Check the connection and reload the page.</p>
      </main>
    );
  if (!me || !tenant || !doctors) return <LoadingPage />;

  const allowed = variant === 'manage' ? me.user.is_owner : me.user.role === variant;
  if (!allowed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4 text-center">
          <Icon name="lock" className="text-[36px] text-primary" />
          <h1 className="font-headline-md text-headline-md">
            This screen is for {variant === 'doctor' ? 'doctors' : variant === 'manage' ? 'the clinic admin' : 'reception'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            You&apos;re logged in as <strong>{me.user.name}</strong> ({ROLE_LABEL[me.user.role]}).
          </p>
          <Link href={HOME_FOR_ROLE[me.user.role]} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center">
            Go to my screen
          </Link>
          <button onClick={logout} className="font-label-md text-label-md text-primary">
            Log out and use another account
          </button>
        </div>
      </main>
    );
  }

  const doctor = variant === 'doctor' ? (doctors.find((d) => d.id === me.user.doctor_id) ?? null) : null;
  if (variant === 'doctor' && !doctor) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-headline-md text-headline-md">Your doctor profile was removed</p>
        <p className="font-body-md text-body-md text-on-surface-variant">Ask MedQR support to relink your login.</p>
        <button onClick={logout} className="font-label-md text-label-md text-primary">
          Log out
        </button>
      </main>
    );
  }

  if (managersOnly && !me.user.can_manage_clinic) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4 text-center">
          <Icon name="admin_panel_settings" className="text-[36px] text-primary" />
          <h1 className="font-headline-md text-headline-md">Your clinic admin handles this</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            In a clinic with several doctors, billing and clinic-wide queue rules are set by the clinic admin.
          </p>
          <Link href={HOME_FOR_ROLE[me.user.role]} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center">
            Back to my screen
          </Link>
        </div>
      </main>
    );
  }

  const clinicName = tenant.display_name ?? tenant.subdomain;
  const nav = navFor(variant, me, !!tenant.is_demo);
  const suiteLabel = variant === 'doctor' ? 'Doctor Suite' : variant === 'manage' ? 'Clinic Admin' : 'Front Desk';
  const deskLabel = variant === 'manage' ? 'Clinic admin' : 'Reception desk';

  return (
    <div className="min-h-screen bg-surface text-on-surface lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="print:hidden hidden lg:flex w-64 shrink-0 flex-col bg-surface-container-lowest border-r border-surface-container min-h-screen sticky top-0 h-screen p-4 gap-4">
        <div className="flex items-center gap-2 px-2">
          <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
            <Icon name="qr_code_2" className="text-[22px]" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm text-primary leading-tight">MedQR</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
              {suiteLabel}
            </span>
          </div>
        </div>

        {doctor ? (
          <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-2.5">
            <DoctorAvatar doctor={doctor} size="w-9 h-9" />
            <div className="min-w-0">
              <p className="font-label-md text-label-md text-on-surface truncate">{doctor.name}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{doctor.cabin_label ?? clinicName}</p>
            </div>
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center">
              <Icon name="local_hospital" className="text-[20px]" />
            </div>
            <div className="min-w-0">
              <p className="font-label-md text-label-md text-on-surface truncate">{clinicName}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{deskLabel}</p>
            </div>
          </div>
        )}

        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            if (item.isCategory) {
              return (
                <div key={`cat-${item.label}`} className="mt-4 mb-1 px-3">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{item.label}</span>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-lg text-label-lg transition-colors ${
                  active === item.href
                    ? 'bg-primary-container text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                <Icon name={item.icon!} className="text-[20px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <div className="px-3 py-2 rounded-xl bg-surface-container-low">
            <p className="font-label-md text-label-md text-on-surface truncate">{me.user.name}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
              @{me.user.username} · {ROLE_LABEL[me.user.role]}{me.user.role === 'doctor' && me.user.is_owner ? ' · Clinic admin' : ''}
            </p>
          </div>
          <Link
            href="/change-password"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-label-md text-label-md"
          >
            <Icon name="lock_reset" className="text-[18px]" />
            Change password
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-label-md text-label-md text-left"
          >
            <Icon name="logout" className="text-[18px]" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="print:hidden sticky top-0 z-30 bg-surface/90 backdrop-blur-xl border-b border-surface-container">
          <div className="px-4 lg:px-6 h-16 flex items-center gap-3">
            <div className="lg:hidden w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center flex-shrink-0">
              <Icon name="qr_code_2" className="text-[22px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-headline-sm text-headline-sm text-on-surface truncate">{clinicName}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {doctor ? `${doctor.name}${doctor.cabin_label ? ` · ${doctor.cabin_label}` : ''}` : deskLabel}
              </p>
            </div>
            <Clock />
            {headerAction}
            <Link
              href="/change-password"
              aria-label="Change password"
              className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low"
            >
              <Icon name="lock_reset" className="text-[20px]" />
            </Link>
            <button
              onClick={logout}
              aria-label="Log out"
              className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low"
            >
              <Icon name="logout" className="text-[20px]" />
            </button>
          </div>
          {nav.length > 1 && (
            <nav className="lg:hidden flex gap-1.5 overflow-x-auto no-scrollbar px-4 pb-2">
              {nav.filter(i => !i.isCategory).map((item) => (
                <Link
                  key={item.href}
                  href={item.href!}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full font-label-md text-label-md ${
                    active === item.href ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </header>

        <main className="flex-1 p-4 lg:p-6 print:p-0">
          {tenant.is_demo ? <DemoBanner /> : <SubscriptionBanner sub={sub} me={me} />}
          {children({ tenant, doctors, doctor, refreshTenant, me })}
        </main>
      </div>
    </div>
  );
}

/** The permanent public demo clinic — always visible so nobody mistakes sample data for a real clinic's. */
function DemoBanner() {
  return (
    <div className="mb-4 rounded-xl bg-primary-container text-white px-4 py-3 flex items-center gap-3 flex-wrap">
      <Icon name="visibility" className="text-[20px] shrink-0 text-white" />
      <p className="font-body-md text-body-md flex-1 min-w-[200px] text-white">
        You&apos;re viewing a live demo with sample patients — everything here is read-only.
      </p>
    </div>
  );
}

/** Decision 18: trial countdown / grace / read-only — shown on every staff screen, not silently. */
function SubscriptionBanner({ sub, me }: { sub: SubscriptionStatus | null; me: Me }) {
  if (!sub || sub.status === 'active') return null;
  const billingHref = !me.user.can_manage_clinic ? null : me.doctor_count <= 1 ? '/doctor/billing' : '/manage/billing';
  const windowEnd = sub.status === 'grace' ? sub.grace_ends_at : sub.trial_ends_at;
  const daysLeft = windowEnd ? Math.ceil((new Date(windowEnd).getTime() - Date.now()) / 86400000) : null;

  if (sub.status === 'read_only') {
    return (
      <div className="mb-4 rounded-xl bg-error-container text-on-error-container px-4 py-3 flex items-center gap-3 flex-wrap">
        <Icon name="lock" className="text-[20px] shrink-0" />
        <p className="font-body-md text-body-md flex-1 min-w-[200px]">
          This clinic&apos;s MedQR subscription payment is overdue — you can view everything, but changes are locked until it&apos;s paid.
        </p>
        {billingHref && (
          <Link href={billingHref} className="h-9 px-4 rounded-full bg-on-error-container text-error-container font-label-md text-label-md flex items-center">
            Fix billing
          </Link>
        )}
      </div>
    );
  }

  const label = sub.status === 'grace' ? 'Payment missed — grace period' : 'Free trial';
  return (
    <div className="mb-4 rounded-xl bg-tertiary-container text-white px-4 py-3 flex items-center gap-3 flex-wrap">
      <Icon name={sub.status === 'grace' ? 'warning' : 'schedule'} className="text-[20px] shrink-0 text-white" />
      <p className="font-body-md text-body-md flex-1 min-w-[200px] text-white">
        {label}
        {daysLeft !== null && ` — ${daysLeft >= 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'ending soon'}`}
        {sub.status === 'trial' && '. Set up autopay any time to keep going without a gap.'}
      </p>
      {billingHref && (
        <Link href={billingHref} className="h-9 px-4 rounded-full bg-white text-tertiary font-label-md text-label-md flex items-center">
          Go to Billing
        </Link>
      )}
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  return (
    <div className="hidden sm:flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-full font-label-md text-label-md text-on-surface">
      <Icon name="schedule" className="text-[18px] text-primary" />
      {now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
    </div>
  );
}
