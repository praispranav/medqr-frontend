'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

// Decision 75 — reviews at the bottom of a clinic's page. Anyone can post after a WhatsApp code (one review per
// mobile per clinic; posting again replaces it). Names show as "Ravi K."; the number is never shown. Clean
// reviews appear at once; the AI check holds abuse/spam for ClinicQ.

type Data = Awaited<ReturnType<typeof api.clinicReviews>>;

function Stars({ value, size = 18, onPick }: { value: number; size?: number; onPick?: (n: number) => void }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(n)}
          aria-label={onPick ? `${n} star${n > 1 ? 's' : ''}` : undefined}
          className={`material-symbols-outlined ${onPick ? 'cursor-pointer' : 'cursor-default'} ${n <= Math.round(value) ? 'text-[#F2A900]' : 'text-[#0F2A24]/20'}`}
          style={{ fontSize: size, fontVariationSettings: "'FILL' 1" }}
        >
          star
        </button>
      ))}
    </span>
  );
}

export function ClinicReviews({ code, doctors }: { code: string; doctors: { id: string; name: string }[] }) {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => api.clinicReviews(code).then(setData).catch(() => setData({ average: null, count: 0, reviews: [] }));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const more = async () => {
    if (!data) return;
    const next = await api.clinicReviews(code, data.reviews.length).catch(() => null);
    if (next) setData({ ...data, reviews: [...data.reviews, ...next.reviews.filter((r) => !data.reviews.some((x) => x.id === r.id))] });
  };

  return (
    <section className="rounded-3xl bg-white border border-[#0F766E]/15 p-6 md:p-8 flex flex-col gap-5" aria-labelledby="reviews-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="reviews-title" className="font-headline-sm text-headline-sm font-bold text-[#0F2A24] flex-1">Patient reviews</h2>
        {data && data.count > 0 && (
          <span className="flex items-center gap-2 text-[#0F2A24]">
            <strong className="text-[22px]">{data.average?.toFixed(1)}</strong>
            <Stars value={data.average ?? 0} />
            <span className="font-body-sm text-body-sm text-[#0F2A24]/60">({data.count})</span>
          </span>
        )}
        {!open && (
          <button onClick={() => setOpen(true)} className="h-11 px-5 rounded-xl bg-[#0F766E] text-white font-label-lg text-label-lg">
            Write a review
          </button>
        )}
      </div>

      {open && <ReviewForm code={code} doctors={doctors} onDone={() => { setOpen(false); load(); }} onCancel={() => setOpen(false)} />}

      {data && data.count === 0 && !open && <p className="font-body-md text-body-md text-[#0F2A24]/60">No reviews yet. Visited this clinic? Be the first to share how it went.</p>}
      <ul className="flex flex-col divide-y divide-[#0F2A24]/10">
        {data?.reviews.map((r) => (
          <li key={r.id} className="py-4 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={r.rating} size={16} />
              <span className="font-label-md text-label-md text-[#0F2A24]">{r.name}</span>
              {r.doctor_name && <span className="font-body-sm text-body-sm text-[#0F2A24]/60">· saw {r.doctor_name}</span>}
              <span className="ml-auto font-body-sm text-body-sm text-[#0F2A24]/50">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            {r.text && <p className="font-body-md text-body-md text-[#0F2A24]/80 whitespace-pre-wrap break-words">{r.text}</p>}
          </li>
        ))}
      </ul>
      {data && data.reviews.length < data.count && (
        <button onClick={more} className="self-start font-label-md text-label-md text-[#0F766E]">Show more reviews</button>
      )}
      <p className="font-body-sm text-body-sm text-[#0F2A24]/50">Reviews are from people who verified their mobile number on WhatsApp. ClinicQ removes abusive or fake reviews.</p>
    </section>
  );
}

function ReviewForm({ code, doctors, onDone, onCancel }: { code: string; doctors: { id: string; name: string }[]; onDone: () => void; onCancel: () => void }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [mobile, setMobile] = useState('');
  const [code6, setCode6] = useState('');
  const [step, setStep] = useState<'write' | 'code' | 'done'>('write');
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = 'h-11 w-full rounded-xl bg-[#F4F1EA] px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach ClinicQ. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="rounded-2xl bg-[#E6F4EA] text-[#137333] p-4 font-body-md text-body-md flex items-center justify-between gap-3">
        <span>{held ? "Thanks! Your review will appear after a quick check." : 'Thanks! Your review is live.'}</span>
        <button onClick={onDone} className="font-label-md text-label-md underline">Close</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#FBFAF7] border border-[#0F2A24]/10 p-4 flex flex-col gap-3">
      {step === 'write' ? (
        <>
          <div className="flex items-center gap-3">
            <span className="font-label-md text-label-md text-[#0F2A24]">Your rating</span>
            <Stars value={rating} size={30} onPick={setRating} />
          </div>
          {doctors.length > 1 && (
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={field}>
              <option value="">Which doctor did you see? (optional)</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 600))} rows={3} placeholder="How was your visit? Waiting time, staff, doctor… (optional)" className="rounded-xl bg-[#F4F1EA] p-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (shown as first name + initial)" className={field} />
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" placeholder="Mobile (never shown)" className={field} />
          </div>
          {error && <p className="font-body-sm text-body-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy || !rating || !name.trim() || mobile.replace(/\D/g, '').length < 10}
              onClick={() => run(async () => { const r = await api.accountStart(mobile); if (r.dev_code) setCode6(r.dev_code); setStep('code'); })}
              className="h-11 px-5 rounded-xl bg-[#0F766E] text-white font-label-lg text-label-lg disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Verify on WhatsApp'}
            </button>
            <button onClick={onCancel} className="h-11 px-4 font-label-md text-label-md text-[#0F2A24]/70">Cancel</button>
          </div>
        </>
      ) : (
        <>
          <p className="font-body-md text-body-md text-[#0F2A24]">Enter the code we sent on WhatsApp to {mobile}.</p>
          <input value={code6} onChange={(e) => setCode6(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits" className={field} />
          {error && <p className="font-body-sm text-body-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy || code6.length !== 6}
              onClick={() =>
                run(async () => {
                  const { ticket } = await api.accountVerify(mobile, code6);
                  const r = await api.submitReview({ ticket, clinic_code: code, doctor_id: doctorId || undefined, name, rating, text: text.trim() || undefined });
                  setHeld(r.status === 'held');
                  setStep('done');
                })
              }
              className="h-11 px-5 rounded-xl bg-[#0F766E] text-white font-label-lg text-label-lg disabled:opacity-40"
            >
              {busy ? 'Posting…' : 'Post review'}
            </button>
            <button onClick={() => setStep('write')} className="h-11 px-4 font-label-md text-label-md text-[#0F2A24]/70">Back</button>
          </div>
        </>
      )}
    </div>
  );
}
