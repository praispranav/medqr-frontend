'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminDoctor, StaffLogin } from '@/lib/adminApi';
import { ScheduleEditor, type ScheduleApi } from '@/components/schedule/ScheduleEditor';
import { Icon } from '@/components/patient/ui';
import { inr } from '@/components/staff/bits';

// Doctors (+ their planned hours) and staff logins for one clinic. Shared by the platform admin
// (/admin/clinics/[id], via x-admin-key) and the clinic admin (/manage/team, via the owner's
// session — Decision 14). Only the platform admin can grant clinic-admin (owner) access.

export type LoginRole = 'reception' | 'doctor' | 'owner';
type DoctorBody = { name: string; qualification: string; specialty: string; cabin_label: string; bio?: string; is_publicly_listed?: boolean };

export interface TeamApi {
  doctors: () => Promise<AdminDoctor[]>;
  createDoctor: (body: DoctorBody) => Promise<AdminDoctor>;
  updateDoctor: (id: string, body: DoctorBody) => Promise<unknown>;
  deleteDoctor: (id: string) => Promise<unknown>;
  schedule: (doctorId: string) => ScheduleApi;
  users: () => Promise<StaffLogin[]>;
  /** Decision 15: no password field — a random one is generated and returned once, here. */
  createUser: (body: {
    role: LoginRole;
    name: string;
    username: string;
    mobile_number: string;
    doctor_id: string | null;
    is_owner?: boolean;
  }) => Promise<{ generated_password: string }>;
  updateUser: (id: string, body: { name?: string; is_active?: boolean; password?: string; mobile_number?: string | null; is_owner?: boolean }) => Promise<unknown>;
  /** Generates a new password and sends it to the login's own WhatsApp number. */
  resetPassword: (id: string) => Promise<{ sent: boolean; generated_password: string; error?: string }>;
  deleteUser: (id: string) => Promise<unknown>;
  /** Platform admin only: create owner logins and make a doctor the clinic admin. */
  canGrantOwner: boolean;
  /** Clinic admin: their own login can't be changed here. */
  currentUserId?: string;
  /** Decision 14: show "each extra doctor adds ₹499/month" when adding past the included count. */
  pricing?: { included_doctors: number; extra_doctor_price_inr: number };
  /** Platform admin only — the medqr.in/doctors public directory listing fields (bio, "list me"). */
  directoryFields?: boolean;
}

const ROLE_ICON: Record<LoginRole, string> = { reception: 'desk', doctor: 'stethoscope', owner: 'admin_panel_settings' };


type DoctorForm = { name: string; qualification: string; specialty: string; cabin_label: string; bio: string; is_publicly_listed: boolean };
const emptyDoctor: DoctorForm = { name: '', qualification: '', specialty: '', cabin_label: '', bio: '', is_publicly_listed: false };

export function DoctorsTab({ api }: { api: TeamApi }) {
  const [doctors, setDoctors] = useState<AdminDoctor[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const list = await api.doctors();
    setDoctors(list);
    setSelectedId((cur) => (cur && list.some((d) => d.id === cur) ? cur : (list[0]?.id ?? null)));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  if (!doctors) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;
  const selected = doctors.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6">
      <section className="flex flex-col gap-3">
        {doctors.map((d) =>
          editingId === d.id ? (
            <DoctorEditor
              key={d.id}
              initial={{
                name: d.name,
                qualification: d.qualification ?? '',
                specialty: d.specialty ?? '',
                cabin_label: d.cabin_label ?? '',
                bio: d.bio ?? '',
                is_publicly_listed: d.is_publicly_listed,
              }}
              directoryFields={api.directoryFields}
              submitLabel="Save"
              onCancel={() => setEditingId(null)}
              onSubmit={async (f) => {
                await api.updateDoctor(d.id, f);
                setEditingId(null);
                await load();
              }}
            />
          ) : (
            <div
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`rounded-2xl p-4 cursor-pointer flex items-start gap-3 ${d.id === selectedId ? 'bg-primary-fixed/20 ring-2 ring-primary' : 'bg-surface-container-lowest shadow-sm'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-label-lg text-label-lg truncate">{d.name}</p>
                  {api.directoryFields && d.is_publicly_listed && (
                    <span className="px-2 py-0.5 rounded-full bg-tertiary-container text-white font-label-sm text-label-sm shrink-0">Listed</span>
                  )}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {[d.qualification, d.specialty, d.cabin_label].filter(Boolean).join(' · ') || 'No details yet'}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(d.id);
                }}
                aria-label={`Edit ${d.name}`}
                className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <Icon name="edit" className="text-[18px]" />
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!window.confirm(`Remove ${d.name} and their schedule? Past visits are kept.`)) return;
                  await api.deleteDoctor(d.id);
                  await load();
                }}
                aria-label={`Remove ${d.name}`}
                className="w-9 h-9 rounded-lg hover:bg-error-container hover:text-error flex items-center justify-center text-on-surface-variant"
              >
                <Icon name="delete" className="text-[18px]" />
              </button>
            </div>
          ),
        )}
        {doctors.length === 0 && !adding && (
          <p className="font-body-md text-body-md text-on-surface-variant">No doctors yet. Patients can&apos;t check in until you add one with a session today.</p>
        )}
        {api.pricing && doctors.length >= api.pricing.included_doctors && (
          <p className="font-body-sm text-body-sm text-on-surface-variant flex items-start gap-1.5">
            <Icon name="info" className="text-[16px] mt-0.5" />
            Your plan includes {api.pricing.included_doctors} doctor. Each extra doctor adds {inr(api.pricing.extra_doctor_price_inr)}/month.
          </p>
        )}
        {adding ? (
          <DoctorEditor
            initial={emptyDoctor}
            directoryFields={api.directoryFields}
            submitLabel="Add doctor"
            onCancel={() => setAdding(false)}
            onSubmit={async (f) => {
              const d = await api.createDoctor(f);
              setAdding(false);
              await load();
              setSelectedId(d.id);
            }}
          />
        ) : (
          <button onClick={() => setAdding(true)} className="h-12 rounded-xl border border-dashed border-outline-variant text-primary font-label-lg text-label-lg flex items-center justify-center gap-2 hover:bg-surface-container-low">
            <Icon name="person_add" className="text-[20px]" /> Add doctor
          </button>
        )}
      </section>

      {selected ? (
        <ScheduleEditor
          key={selected.id}
          title={selected.name}
          api={api.schedule(selected.id)}
        />
      ) : (
        <section className="bg-surface-container-low rounded-2xl p-8 text-center font-body-md text-body-md text-on-surface-variant">
          Add a doctor to set their consulting hours.
        </section>
      )}
    </div>
  );
}

function DoctorEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  directoryFields = false,
}: {
  initial: DoctorForm;
  submitLabel: string;
  onSubmit: (f: DoctorForm) => Promise<void>;
  onCancel: () => void;
  directoryFields?: boolean;
}) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (k: 'name' | 'qualification' | 'specialty' | 'cabin_label', label: string, ph: string) => (
    <label className="flex flex-col gap-1">
      <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
      <input
        value={f[k]}
        placeholder={ph}
        onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))}
        className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSubmit(f);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
      className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-3"
    >
      {field('name', 'Name *', 'Dr. Meera Sharma')}
      <div className="grid grid-cols-2 gap-2">
        {field('qualification', 'Qualification', 'MBBS, MD')}
        {field('cabin_label', 'Cabin', 'Cabin 2')}
      </div>
      {field('specialty', 'Specialty', 'Pediatrician')}
      {directoryFields && (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Public bio (shown on medqr.in/doctors)</span>
            <textarea
              value={f.bio}
              placeholder="A short line about this doctor for patients searching online…"
              rows={2}
              onChange={(e) => setF((x) => ({ ...x, bio: e.target.value }))}
              className="rounded-lg bg-surface-container-low px-3 py-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={f.is_publicly_listed}
              onChange={(e) => setF((x) => ({ ...x, is_publicly_listed: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="font-label-md text-label-md">List this doctor in the public directory</span>
          </label>
        </>
      )}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy || !f.name.trim()} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-40">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg font-label-md text-label-md text-on-surface-variant">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------- Staff logins ----------------

export function LoginsTab({ api, clinicCode }: { api: TeamApi; clinicCode: string }) {
  const [logins, setLogins] = useState<StaffLogin[] | null>(null);
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [role, setRole] = useState<LoginRole>('reception');
  const [makeOwner, setMakeOwner] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const [u, d] = await Promise.all([api.users(), api.doctors()]);
    setLogins(u);
    setDoctors(d);
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const doctorName = (id: string | null) => doctors.find((d) => d.id === id)?.name ?? '—';
  const doctorsWithoutLogin = doctors.filter((d) => !logins?.some((l) => l.doctor_id === d.id));

  const act = async <T,>(fn: () => Promise<T>, ok: string | ((result: T) => string)) => {
    setMsg(null);
    try {
      const result = await fn();
      await load();
      setMsg({ kind: 'ok', text: typeof ok === 'function' ? ok(result) : ok });
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  };

  const create = () =>
    act(
      async () => {
        const res = await api.createUser({
          role,
          name,
          username,
          mobile_number: mobile,
          doctor_id: role === 'doctor' ? doctorId : null,
          ...(api.canGrantOwner && role === 'doctor' && makeOwner ? { is_owner: true } : {}),
        });
        setMakeOwner(false);
        setName('');
        setUsername('');
        setMobile('');
        setDoctorId('');
        return res;
      },
      (res) =>
        `Login “${username}” created. Temporary password: ${res.generated_password} — share the clinic code “${clinicCode}” and this password with them now. (Or use “Reset password” below any time to generate a fresh one and send it to their WhatsApp instead.) They must change it on first login.`,
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden self-start">
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-headline-sm text-headline-sm">Who can log in</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Reception, doctors and the clinic admin have separate logins. Everyone signs in at <strong>/login</strong> with clinic code{' '}
            <strong>{clinicCode}</strong>.
          </p>
        </div>
        {logins === null && <p className="px-5 pb-5 font-body-md text-body-md text-on-surface-variant">Loading…</p>}
        {logins?.length === 0 && <p className="px-5 pb-5 font-body-md text-body-md text-on-surface-variant">No logins yet — create one on the right.</p>}
        {logins?.map((l) => (
          <div key={l.id} className={`px-5 py-4 border-t border-surface-container flex items-center gap-3 flex-wrap ${l.is_active ? '' : 'opacity-60'}`}>
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${l.role === 'reception' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-primary-fixed/50 text-primary'}`}>
              <Icon name={ROLE_ICON[l.role]} className="text-[22px]" />
            </span>
            <div className="flex-1 min-w-[160px]">
              <p className="font-label-lg text-label-lg">
                {l.name} <span className="font-body-sm text-body-sm text-on-surface-variant">@{l.username}</span>
                {l.is_owner && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm align-middle">Clinic admin</span>
                )}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {l.role === 'doctor' ? `Doctor · ${doctorName(l.doctor_id)}` : l.role === 'owner' ? 'Clinic admin (not a doctor)' : 'Reception'}
                {' · '}
                {l.is_active ? (l.last_login_at ? `last login ${new Date(l.last_login_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'never logged in') : 'deactivated'}
                {l.must_change_password && ' · password not yet set by them'}
              </p>
              {(api.canGrantOwner || (!l.is_owner && l.id !== api.currentUserId)) ? (
                <button
                  onClick={() => {
                    const num = window.prompt(`Mobile number for @${l.username} (used to send WhatsApp password resets):`, l.mobile_number ?? '');
                    if (num !== null) act(() => api.updateUser(l.id, { mobile_number: num.trim() || null }), `Mobile number updated for @${l.username}.`);
                  }}
                  className="font-body-sm text-body-sm text-primary text-left"
                >
                  {l.mobile_number ?? 'Add mobile number'}
                </button>
              ) : (
                l.mobile_number && <p className="font-body-sm text-body-sm text-on-surface-variant">{l.mobile_number}</p>
              )}
            </div>
            {api.canGrantOwner && l.role === 'doctor' && (
              <button
                onClick={() =>
                  act(
                    () => api.updateUser(l.id, { is_owner: !l.is_owner }),
                    l.is_owner ? `${l.name} is no longer clinic admin.` : `${l.name} is now clinic admin — they see Manage after logging in again.`,
                  )
                }
                className="h-9 px-3 rounded-lg bg-surface-container-low font-label-md text-label-md text-primary"
              >
                {l.is_owner ? 'Remove admin' : 'Make clinic admin'}
              </button>
            )}
            {(api.canGrantOwner || (!l.is_owner && l.id !== api.currentUserId)) && (<>
            <button
              onClick={() => {
                if (!window.confirm(`Generate a new password for @${l.username} and send it to their WhatsApp? They will be signed out everywhere.`)) return;
                act(
                  () => api.resetPassword(l.id),
                  (res) =>
                    res.sent
                      ? `New password sent to @${l.username}’s WhatsApp. (Shown here too until WhatsApp is live: ${res.generated_password})`
                      : `Couldn’t send via WhatsApp (${res.error ?? 'unknown error'}). New password for @${l.username}: ${res.generated_password}`,
                );
              }}
              className="h-9 px-3 rounded-lg bg-surface-container-low font-label-md text-label-md text-primary"
            >
              Reset password
            </button>
            <button
              onClick={() => act(() => api.updateUser(l.id, { is_active: !l.is_active }), l.is_active ? `@${l.username} can no longer log in.` : `@${l.username} can log in again.`)}
              className="h-9 px-3 rounded-lg bg-surface-container-low font-label-md text-label-md text-on-surface-variant"
            >
              {l.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete the login @${l.username}? This can't be undone.`)) act(() => api.deleteUser(l.id), `Deleted @${l.username}.`);
              }}
              aria-label={`Delete login ${l.username}`}
              className="w-9 h-9 rounded-lg hover:bg-error-container hover:text-error flex items-center justify-center text-on-surface-variant"
            >
              <Icon name="delete" className="text-[18px]" />
            </button>
            </>)}
          </div>
        ))}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
        className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3 self-start"
      >
        <h2 className="font-headline-sm text-headline-sm">New login</h2>
        <div className={`grid gap-2 ${api.canGrantOwner ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {(api.canGrantOwner ? (['reception', 'doctor', 'owner'] as const) : (['reception', 'doctor'] as const)).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className={`h-11 px-1.5 rounded-xl font-label-md text-label-md flex items-center justify-center gap-1 overflow-hidden ${role === r ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}
            >
              <Icon name={ROLE_ICON[r]} className="text-[14px] shrink-0" />
              {r === 'doctor' ? 'Doctor' : r === 'owner' ? 'Admin' : 'Reception'}
            </button>
          ))}
        </div>
        {role === 'doctor' && (
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Which doctor</span>
            <select
              value={doctorId}
              onChange={(e) => {
                setDoctorId(e.target.value);
                const d = doctors.find((x) => x.id === e.target.value);
                if (d && !name) setName(d.name);
              }}
              className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md"
            >
              <option value="">Select…</option>
              {doctorsWithoutLogin.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {doctorsWithoutLogin.length === 0 && (
              <span className="font-body-sm text-body-sm text-on-surface-variant">Every doctor already has a login. Add doctors first.</span>
            )}
          </label>
        )}
        {api.canGrantOwner && role === 'doctor' && (
          <label className="flex items-center gap-2 font-body-md text-body-md">
            <input type="checkbox" checked={makeOwner} onChange={(e) => setMakeOwner(e.target.checked)} className="w-4 h-4 accent-primary" />
            This doctor is also the clinic admin
          </label>
        )}
        {role === 'owner' && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            For a clinic or hospital owner/manager who isn&apos;t one of the doctors. They see every doctor&apos;s payments and activity and
            manage doctors and logins — never clinical notes.
          </p>
        )}
        {(
          [
            ['Name', name, setName, role === 'doctor' ? 'Dr. Meera Sharma' : role === 'owner' ? 'Rajesh (owner)' : 'Sunita (front desk)', 'text'],
            ['Username', username, (v: string) => setUsername(v.toLowerCase().replace(/[^a-z0-9._-]/g, '')), role === 'doctor' ? 'meera' : role === 'owner' ? 'owner' : 'frontdesk', 'text'],
            ['Mobile number', mobile, (v: string) => setMobile(v.replace(/[^\d+]/g, '')), '9876543210', 'tel'],
          ] as const
        ).map(([label, value, set, ph, type]) => (
          <label key={label} className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
            <input
              type={type}
              value={value}
              placeholder={ph}
              autoComplete="off"
              onChange={(e) => set(e.target.value)}
              className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        ))}
        <p className="font-body-sm text-body-sm text-on-surface-variant -mt-1">
          A password is generated for them automatically — they&apos;ll set their own on first login. Their mobile number is where password resets are sent, via WhatsApp.
        </p>
        <button
          disabled={!name.trim() || !username || mobile.replace(/\D/g, '').length < 10 || (role === 'doctor' && !doctorId)}
          className="h-11 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-40"
        >
          Create login
        </button>
        {msg && <p className={`font-body-sm text-body-sm ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
      </form>
    </div>
  );
}
