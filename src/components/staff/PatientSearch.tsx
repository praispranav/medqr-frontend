'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { api, type PatientSearchResult, type Tenant, type Visit } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { fileUrl } from '@/lib/api';

export function PatientSearchAction({ onWalkIn }: { onWalkIn?: (p: { name: string; mobile: string }) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search patients"
        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low"
      >
        <Icon name="search" className="text-[20px]" />
      </button>
      {/* Portal to <body>: the staff header uses backdrop-blur, which would trap a `fixed` overlay
          inside the 64px header instead of covering the screen. */}
      {open &&
        createPortal(
          <PatientSearchOverlay onClose={() => setOpen(false)} onWalkIn={(p) => { setOpen(false); onWalkIn?.(p); }} showWalkIn={!!onWalkIn} />,
          document.body,
        )}
    </>
  );
}

function PatientSearchOverlay({ onClose, onWalkIn, showWalkIn }: { onClose: () => void; onWalkIn?: (p: { name: string; mobile: string }) => void; showWalkIn: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [selected, setSelected] = useState<PatientSearchResult | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.patientSearch(q).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 bg-surface/90 flex justify-end backdrop-blur-sm">
      <div className="w-full max-w-[600px] h-full bg-surface-container-lowest shadow-2xl flex flex-col border-l border-surface-container">
        <div className="h-16 px-4 flex items-center gap-3 border-b border-surface-container shrink-0">
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container text-on-surface">
            <Icon name="arrow_back" className="text-[24px]" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-surface-container-low rounded-xl px-3 h-11">
            <Icon name="search" className="text-on-surface-variant text-[20px]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, mobile, or token #"
              className="flex-1 bg-transparent font-body-lg text-body-lg focus:outline-none placeholder:text-outline-variant"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {query.trim().length > 0 && results.length === 0 && (
            <p className="text-center font-body-md text-on-surface-variant mt-10">No patients found.</p>
          )}
          {!selected ? (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="flex items-center justify-between gap-3 p-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-left transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-headline-sm text-headline-sm text-on-surface truncate">{r.name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 truncate">
                    {[r.age ? `${r.age}y` : null, r.gender, `+91 ${r.mobile_number}`].filter(Boolean).join(' · ')}
                  </p>
                  <p className="font-body-sm text-body-sm text-primary mt-1 truncate">
                    {r.visit_count} visit{r.visit_count !== 1 ? 's' : ''} · Last: {new Date(r.last_visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <Icon name="chevron_right" className="text-on-surface-variant text-[24px]" />
              </button>
            ))
          ) : (
            <PatientDetailView patient={selected} onBack={() => setSelected(null)} onWalkIn={showWalkIn ? () => onWalkIn?.({ name: selected.name, mobile: selected.mobile_number }) : undefined} />
          )}
        </div>
      </div>
    </div>
  );
}

function PatientDetailView({ patient, onBack, onWalkIn }: { patient: PatientSearchResult; onBack: () => void; onWalkIn?: () => void }) {
  const [history, setHistory] = useState<Visit[]>([]);
  const [openPast, setOpenPast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPatientHistory(patient.id, '').then(res => {
      setHistory(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [patient.id]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-primary font-label-md">
          <Icon name="arrow_back" className="text-[18px]" /> Back to results
        </button>
        {onWalkIn && (
          <button onClick={onWalkIn} className="h-9 px-3 rounded-lg bg-primary text-on-primary font-label-md text-label-md flex items-center gap-1.5 shadow-sm">
            <Icon name="person_add" className="text-[18px]" /> New token
          </button>
        )}
      </div>

      <section className="bg-surface-container-low rounded-2xl p-5 shadow-sm">
        <h1 className="font-headline-md text-headline-md text-on-surface">{patient.name}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          {[patient.age ? `${patient.age} yrs` : null, patient.gender, `+91 ${patient.mobile_number}`].filter(Boolean).join(' · ')}
        </p>
      </section>

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            <Icon name="history" className="text-[18px]" /> Past visits
          </h2>
          <span className="font-body-sm text-body-sm text-outline">{history.length} records</span>
        </div>
        {loading && <p className="font-body-md text-on-surface-variant">Loading...</p>}
        {!loading && history.length === 0 && <p className="font-body-md text-on-surface-variant">No past visits found.</p>}
        
        <div className="flex flex-col divide-y divide-surface-container">
          {history.map((h) => {
            const open = openPast === h.id;
            return (
              <button key={h.id} onClick={() => setOpenPast(open ? null : h.id)} className="text-left py-3 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-label-lg text-label-lg text-on-surface">
                    {new Date(h.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {h.chief_complaint ? ` · ${h.chief_complaint}` : ''}
                  </p>
                  {h.attachments.length > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant shrink-0">
                      <Icon name="attach_file" className="text-[14px]" />
                      {h.attachments.length}
                    </span>
                  )}
                </div>
                {/* The server only sends the clinical note to doctors (Decision 30) — reception sees none. */}
                {'note' in h && (
                  <p className={`font-body-sm text-body-sm text-on-surface-variant whitespace-pre-wrap ${open ? '' : 'line-clamp-2'}`}>
                    {h.note || 'No note written'}
                  </p>
                )}
                {open && h.attachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-1">
                    {h.attachments.map((a) => (
                      <a
                        key={a.url}
                        href={fileUrl(a.url)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-label-sm text-label-sm text-primary underline"
                      >
                        {a.name ?? 'Attachment'}
                      </a>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
