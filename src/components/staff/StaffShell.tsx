'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type DoctorToday, type Me, type Tenant } from '@/lib/api';
import { HOME_FOR_ROLE } from '@/lib/staffRoutes';
import { DoctorAvatar, Icon, LoadingPage } from '@/components/patient/ui';

// Shared chrome for the staff screens (Reception #4, Doctor Suite #5/#6/#9/#10 + QR poster),
// following the sidebar layout the Stitch staff screens share.
//
// Access comes from the staff login (/login): reception and doctor accounts are separate, and the
// server enforces the role on every staff API. A logged-in reception account opening a doctor
// screen (or vice versa) gets a clear "wrong login" page instead of the screen.

export interface StaffContext {
  tenant: Tenant;
  doctors: DoctorToday[];
  /** Only set in the doctor suite. */
  doctor: DoctorToday | null;
  refreshTenant: () => Promise<void>;
}

type Variant = 'reception' | 'doctor';

const NAV: Record<Variant, { href: string; label: string; icon: string }[]> = {
  doctor: [
    { href: '/doctor/dashboard', label: 'Queue Command Center', icon: 'space_dashboard' },
    { href: '/doctor/hours', label: 'My Hours', icon: 'schedule' },
    { href: '/doctor/payments', label: 'Payments', icon: 'currency_rupee' },
    { href: '/doctor/settings', label: 'Queue Rules', icon: 'tune' },
    { href: '/doctor/qr-poster', label: 'QR Standee', icon: 'qr_code_2' },
    { href: '/doctor/billing', label: 'Billing & Add-ons', icon: 'account_balance_wallet' },
  ],
  reception: [
    { href: '/reception', label: 'Queue Verifier', icon: 'qr_code_scanner' },
    { href: '/reception/payments', label: 'Payments', icon: 'currency_rupee' },
  ],
};

export function StaffShell({
  variant,
  active,
  children,
}: {
  variant: Variant;
  active: string;
  children: (ctx: StaffContext) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [doctors, setDoctors] = useState<DoctorToday[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const who = await api.me();
    const [t, ds] = await Promise.all([api.getMyTenant(), api.getDoctorsToday(who.tenant.id)]);
    setMe(who);
    setTenant(t);
    setDoctors(ds);
  }, []);

  useEffect(() => {
    load().catch((e) => {
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

  if (me.user.role !== variant) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4 text-center">
          <Icon name="lock" className="text-[36px] text-primary" />
          <h1 className="font-headline-md text-headline-md">
            This screen is for {variant === 'doctor' ? 'doctors' : 'reception'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            You&apos;re logged in as <strong>{me.user.name}</strong> ({me.user.role}).
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

  const clinicName = tenant.display_name ?? tenant.subdomain;

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
              {variant === 'doctor' ? 'Doctor Suite' : 'Front Desk'}
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
              <p className="font-body-sm text-body-sm text-on-surface-variant">Reception desk</p>
            </div>
          </div>
        )}

        <nav className="flex flex-col gap-1">
          {NAV[variant].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-lg text-label-lg transition-colors ${
                active === item.href
                  ? 'bg-primary-container text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              <Icon name={item.icon} className="text-[20px]" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <div className="px-3 py-2 rounded-xl bg-surface-container-low">
            <p className="font-label-md text-label-md text-on-surface truncate">{me.user.name}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
              @{me.user.username} · {me.user.role === 'doctor' ? 'Doctor' : 'Reception'}
            </p>
          </div>
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
                {doctor ? `${doctor.name}${doctor.cabin_label ? ` · ${doctor.cabin_label}` : ''}` : 'Reception desk'}
              </p>
            </div>
            <Clock />
            <button
              onClick={logout}
              aria-label="Log out"
              className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low"
            >
              <Icon name="logout" className="text-[20px]" />
            </button>
          </div>
          {NAV[variant].length > 1 && (
            <nav className="lg:hidden flex gap-1.5 overflow-x-auto no-scrollbar px-4 pb-2">
              {NAV[variant].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
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

        <main className="flex-1 p-4 lg:p-6 print:p-0">{children({ tenant, doctors, doctor, refreshTenant })}</main>
      </div>
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
