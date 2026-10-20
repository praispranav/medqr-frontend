'use client';

import { SOCIAL_PLATFORMS, publicWebLink } from '@/lib/publicLinks';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LANDING_TEMPLATES } from '@/lib/landingTemplates';
import { api, ApiError, type LandingTemplate, type Tenant } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// Clinic address / city / phone + the clinic-wide clinicq.fit listing switch. Lives on Public Profile
// (doctor portal) and Clinic Profile (clinic admin) — not in Queue Rules. Editable by whoever can
// manage the clinic (solo doctor or clinic admin, Decision 14); read-only for other doctors.

type ClinicDetailsPatch = {
  is_publicly_listed: boolean;
  city: string | null;
  address: string | null;
  public_phone: string | null;
  emergency_phone?: string | null;
  is_open_24x7?: boolean;
  operating_hours?: string | null;
  website_url?: string | null;
  social_links?: Record<string, string>;
  maps_url: string | null;
  landing_template: LandingTemplate;
  landing_tagline: string | null;
  landing_about: string | null;
  landing_highlights: string[];
};

type Draft = { tagline: string; about: string; highlights: string[] };

export function ClinicDetails({
  tenant,
  onSaved,
  canEdit,
  save: saveFn = (patch) => api.updateTenantPublicProfile(tenant.id, patch),
  aiDraft = () => api.landingClinicDraft(),
}: {
  tenant: Tenant;
  onSaved: () => Promise<void>;
  canEdit: boolean;
  /** Platform admin passes its own save. */
  save?: (patch: ClinicDetailsPatch) => Promise<unknown>;
  /** "Write with AI" — the platform admin passes its own (Decision 50). */
  aiDraft?: () => Promise<Draft>;
}) {
  const [listed, setListed] = useState(!!tenant.is_publicly_listed);
  const [city, setCity] = useState(tenant.city ?? '');
  const [address, setAddress] = useState(tenant.address ?? '');
  const [phone, setPhone] = useState(tenant.public_phone ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(tenant.emergency_phone ?? '');
  const [isOpen24x7, setIsOpen24x7] = useState(!!tenant.is_open_24x7);
  const [operatingHours, setOperatingHours] = useState(tenant.operating_hours ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(tenant.website_url ?? '');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(tenant.social_links ?? {});
  const savedSocialLinks = JSON.stringify(tenant.social_links ?? {});
  useEffect(() => setSocialLinks(JSON.parse(savedSocialLinks)), [savedSocialLinks]);
  useEffect(() => setWebsiteUrl(tenant.website_url ?? ''), [tenant.website_url]);
  const [mapsUrl, setMapsUrl] = useState(tenant.maps_url ?? '');
  // Decision 50 — the public landing page
  const [template, setTemplate] = useState<LandingTemplate>(tenant.landing_template ?? 'editorial');
  const [tagline, setTagline] = useState(tenant.landing_tagline ?? '');
  const [about, setAbout] = useState(tenant.landing_about ?? '');
  const [highlights, setHighlights] = useState((tenant.landing_highlights ?? []).join(', '));
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const dirty =
    listed !== !!tenant.is_publicly_listed ||
    city !== (tenant.city ?? '') ||
    address !== (tenant.address ?? '') ||
    phone !== (tenant.public_phone ?? '') ||
    emergencyPhone !== (tenant.emergency_phone ?? '') ||
    isOpen24x7 !== !!tenant.is_open_24x7 ||
    operatingHours !== (tenant.operating_hours ?? '') ||
    websiteUrl !== (tenant.website_url ?? '') ||
    JSON.stringify(Object.fromEntries(Object.entries(socialLinks).filter(([, value]) => value.trim()))) !== savedSocialLinks ||
    mapsUrl !== (tenant.maps_url ?? '') ||
    template !== (tenant.landing_template ?? 'editorial') ||
    tagline !== (tenant.landing_tagline ?? '') ||
    about !== (tenant.landing_about ?? '') ||
    highlights !== (tenant.landing_highlights ?? []).join(', ');

  const highlightList = highlights.split(',').map((h) => h.trim()).filter(Boolean).slice(0, 4);
  // What the public page needs from the clinic itself (doctor photo / bio / years live in each doctor's Public Profile).
  const needed = [
    { label: 'City', ok: !!city.trim() },
    { label: 'Address', ok: !!address.trim() },
    { label: 'Clinic phone', ok: !!phone.trim() },
    { label: 'Google Maps link', ok: !!mapsUrl.trim() },
    { label: 'Tagline', ok: !!tagline.trim() },
    { label: 'About the clinic', ok: !!about.trim() },
    { label: 'A few highlights', ok: highlightList.length > 0 },
  ];
  const readyCount = needed.filter((n) => n.ok).length;

  const writeWithAi = async () => {
    setAiBusy(true);
    setAiNote(null);
    try {
      const d = await aiDraft();
      if (d.tagline) setTagline(d.tagline);
      if (d.about) setAbout(d.about);
      if (d.highlights?.length) setHighlights(d.highlights.join(', '));
      setAiNote('Draft written — read it, change anything that is not right, then save.');
    } catch (e) {
      setAiNote(e instanceof ApiError ? e.message : 'Could not write a draft right now.');
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      const result = (await saveFn({
        is_publicly_listed: listed,
        city: city || null,
        address: address || null,
        public_phone: phone || null,
        emergency_phone: emergencyPhone || null,
        is_open_24x7: isOpen24x7,
        operating_hours: operatingHours.trim() || null,
        website_url: websiteUrl.trim() || null,
        social_links: Object.fromEntries(Object.entries(socialLinks).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value)),
        maps_url: mapsUrl.trim() || null,
        landing_template: template,
        landing_tagline: tagline.trim() || null,
        landing_about: about.trim() || null,
        landing_highlights: highlightList,
      }));
      // Decision 67: a doubtful edit is held for ClinicQ instead of going live.
      const pending = (result as { review_pending?: string } | null)?.review_pending;
      setReviewNote(pending ? `Sent to ClinicQ for a quick check: ${pending}` : null);
      const saved = result as Partial<Tenant> | null;
      if (!pending && saved) {
        if (saved.website_url !== undefined) setWebsiteUrl(saved.website_url ?? '');
        if (saved.social_links !== undefined) setSocialLinks(saved.social_links ?? {});
      }
      await onSaved();
      setState('saved');
    } catch (e) {
      setState('error');
      setError(e instanceof ApiError ? e.message : 'Could not save right now.');
    }
  };

  if (!canEdit) {
    // Other doctors in a multi-doctor clinic see the clinic's details; the clinic admin edits them (Decision 14).
    return (
      <Section title="Clinic details" subtitle="Set by your clinic admin.">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-body-md text-body-md">
          <dt className="text-on-surface-variant">Address</dt>
          <dd>{tenant.address || '—'}</dd>
          <dt className="text-on-surface-variant">City</dt>
          <dd>{tenant.city || '—'}</dd>
          <dt className="text-on-surface-variant">Phone</dt>
          <dd>{tenant.public_phone || '—'}</dd>
          <dt className="text-on-surface-variant">Emergency</dt>
          <dd>{tenant.emergency_phone || '—'}</dd>
          <dt className="text-on-surface-variant">Website</dt>
          <dd>{tenant.website_url ? <a href={publicWebLink(tenant.website_url) ?? undefined} target="_blank" rel="noreferrer" className="text-primary underline">{tenant.website_url}</a> : '—'}</dd>
          {Object.entries(tenant.social_links ?? {}).some(([, url]) => publicWebLink(url)) && <><dt className="text-on-surface-variant">Social links</dt><dd className="min-w-0 flex flex-wrap gap-x-4 gap-y-2">{Object.entries(tenant.social_links ?? {}).map(([key, url]) => publicWebLink(url) && <a key={key} href={publicWebLink(url)!} target="_blank" rel="noopener noreferrer" className="text-primary underline">{SOCIAL_PLATFORMS.find(p => p.key === key)?.label ?? key}</a>)}</dd></>}
          <dt className="text-on-surface-variant">Timing</dt>
          <dd>{tenant.is_open_24x7 ? 'Open 24/7 (All the time)' : (tenant.operating_hours || 'OPD hours')}</dd>
          <dt className="text-on-surface-variant">Map pin</dt>
          <dd>{tenant.maps_url ? 'Set' : '—'}</dd>
          <dt className="text-on-surface-variant">Listed online</dt>
          <dd>{tenant.is_publicly_listed ? 'Yes' : 'No'}</dd>
        </dl>
      </Section>
    );
  }

  return (
    <>
      <BillingEmail tenant={tenant} onSaved={onSaved} />
      <Section title="Clinic details" subtitle="Your clinic's address and phone, and whether it's listed on clinicq.fit/doctors for patients searching online.">
      <div className="flex flex-col gap-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="font-label-lg text-label-lg">List this clinic publicly</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Each doctor also needs their own listing switched on, from their Public Profile page.</p>
          </div>
          <button
            role="switch"
            aria-checked={listed}
            onClick={() => setListed((v) => !v)}
            className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${listed ? 'bg-primary' : 'bg-surface-container-high'}`}
          >
            <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${listed ? 'translate-x-6' : ''}`} />
          </button>
        </label>
        <p className="text-body-sm text-on-surface-variant">Save to apply listing privacy. When off, the clinic and its doctors are hidden from public directory search. Direct clinic and patient links continue to work. Demo clinics never appear in directory search.</p>
        {/* Contact Numbers */}
        <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="call" className="text-[20px] text-primary" />
            <h4 className="font-label-lg text-label-lg text-on-surface">Clinic Contact &amp; Phone Numbers</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface">Clinic Phone / Reception</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="080 1234 5678 or 98765 43210"
                className="h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-[12px] text-on-surface-variant">Shown on your public page. Patients tap &quot;Call the clinic&quot; to reach reception.</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface">24/7 Helpline / Emergency (Optional)</span>
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="e.g. 98765 00000 or ambulance"
                className="h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-[12px] text-on-surface-variant">Shown as an urgent emergency call button on your page.</span>
            </label>

          </div>
        </div>

        <section className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-3" aria-label="Website and social links">
          <h3 className="font-label-lg text-label-lg">Website &amp; social links</h3>
          <p className="text-body-sm text-on-surface-variant">Optional. Saved links appear in “Visit the clinic” on your public clinic and doctor pages. Clear a field to remove its link.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="font-label-sm text-label-sm text-on-surface">Website (optional)</span>
              <div className="flex items-center rounded-lg bg-surface-container-lowest border border-surface-container-high focus-within:ring-2 focus-within:ring-primary/30 px-3">
                <Icon name="language" className="text-[18px] text-on-surface-variant mr-2" />
                <input
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={2048}
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.yourclinic.com"
                  className="h-11 w-full bg-transparent font-body-md text-body-md focus:outline-none"
                />
              </div>
              <span className="text-[12px] text-on-surface-variant">Use your clinic or hospital’s official website.</span>
            </label>
            {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
              <label key={key} className="flex min-w-0 flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface">{label}</span>
                <input type="url" inputMode="url" maxLength={2048} autoCapitalize="none" spellCheck={false} value={socialLinks[key] ?? ''} onChange={e => setSocialLinks(links => ({ ...links, [key]: e.target.value }))} placeholder={placeholder} className="h-11 w-full min-w-0 rounded-lg bg-surface-container-lowest px-3 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
            ))}
          </div>
        </section>

        {/* Operating Hours & 24/7 Status */}
        <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="schedule" className="text-[20px] text-primary" />
            <h4 className="font-label-lg text-label-lg text-on-surface">Facility Timings &amp; 24/7 Operations</h4>
          </div>
          <label className="flex items-center justify-between gap-3 bg-surface-container-lowest p-3 rounded-xl border border-surface-container-high cursor-pointer">
            <div>
              <p className="font-label-md text-label-md text-on-surface flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Clinic is Open 24 Hours / All The Time (24x7)
              </p>
              <p className="text-[12px] text-on-surface-variant mt-0.5">
                Turn this on if your clinic, hospital, emergency ward, or pharmacy is open round the clock. Adds an &quot;Open 24/7&quot; badge to your page and directory search.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isOpen24x7}
              onClick={() => {
                setIsOpen24x7((v) => {
                  const next = !v;
                  if (next && !operatingHours) setOperatingHours('Open 24 Hours, 7 Days a Week');
                  return next;
                });
              }}
              className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 ${isOpen24x7 ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${isOpen24x7 ? 'translate-x-5' : ''}`} />
            </button>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface">Facility Operating Hours Summary</span>
            <input
              value={operatingHours}
              onChange={(e) => setOperatingHours(e.target.value)}
              placeholder='e.g. "Open 24 Hours, 7 Days a Week" or "Mon-Sat: 8 AM - 9 PM"'
              className="h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-[12px] text-on-surface-variant">General facility hours. Doctor OPD consulting hours are configured separately in My Hours.</span>
          </label>
        </div>

        {/* Location & Map Pin */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Trivandrum" className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Address</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="2nd Floor, MG Road" className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Google Maps link (optional)</span>
          <input
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            placeholder="Paste the link from Google Maps' Share button"
            className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            On your phone: open the clinic in Google Maps → Share → Copy link. Patients get a &quot;Get Directions&quot; button straight
            to your exact pin — the link itself is never shown to them.
          </span>
        </label>

        {/* ---------- Decision 50: the public landing page ---------- */}
        <div className="border-t border-surface-container pt-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-label-lg text-label-lg">Your public page</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">What patients see at your clinic&apos;s link. Pick a look and fill in the details below.</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-md text-label-md">Page details {readyCount}/{needed.length}</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {LANDING_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTemplate(t.key)}
                aria-pressed={template === t.key}
                className={`rounded-2xl p-3 text-left border-2 transition-colors ${template === t.key ? 'border-primary bg-primary-fixed/20' : 'border-surface-container-high bg-surface-container-lowest'}`}
              >
                <div className="h-20 rounded-xl mb-2 p-2 flex flex-col gap-1.5 border border-black/5" style={{ background: t.bg }}>
                  <div className={`h-3 w-2/3 ${t.round}`} style={{ background: t.bar }} />
                  <div className="flex gap-1.5 flex-1">
                    <div className={`flex-1 ${t.round}`} style={{ background: t.tile }} />
                    <div className={`flex-1 ${t.round}`} style={{ background: t.tile }} />
                    <div className={`flex-1 ${t.round}`} style={{ background: t.accent }} />
                  </div>
                </div>
                <p className="font-label-lg text-label-lg">{t.name}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{t.hint}</p>
              </button>
            ))}
          </div>

          {tenant.public_slug && listed && (
            <p className="font-body-sm text-body-sm text-on-surface-variant -mt-2">
              Preview:{' '}
              {LANDING_TEMPLATES.map((t, i) => (
                <span key={t.key}>
                  {i > 0 && ' · '}
                  <Link href={`/clinics/${tenant.public_slug}?preview=${t.key}`} target="_blank" className="text-primary underline underline-offset-4">{t.name}</Link>
                </span>
              ))}
              {' '}(shows your saved details)
            </p>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="font-label-md text-label-md text-on-surface">Words for your page</p>
            <button type="button" onClick={writeWithAi} disabled={aiBusy} className="h-9 px-3 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-60">
              <Icon name={aiBusy ? 'progress_activity' : 'auto_awesome'} className={`text-[18px] ${aiBusy ? 'animate-spin' : ''}`} />
              {aiBusy ? 'Writing…' : 'Write with AI'}
            </button>
          </div>
          {aiNote && <p className="font-body-sm text-body-sm text-on-surface-variant -mt-2">{aiNote}</p>}

          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Tagline <span className="font-normal">({tagline.length}/120)</span></span>
            <input value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} placeholder="Your neighbourhood family clinic" className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">About the clinic <span className="font-normal">({about.length}/600)</span></span>
            <textarea value={about} maxLength={600} rows={3} onChange={(e) => setAbout(e.target.value)} placeholder="Two or three sentences about your clinic and how you care for patients." className="rounded-lg bg-surface-container-low px-3 py-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Highlights — up to 4, separated by commas</span>
            <input value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder="Child specialist, Token on your phone, No app to download" className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>

          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {needed.map((n) => (
              <li key={n.label} className={`flex items-center gap-1.5 font-body-sm text-body-sm ${n.ok ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                <Icon name={n.ok ? 'check_circle' : 'radio_button_unchecked'} fill={n.ok} className={`text-[18px] ${n.ok ? 'text-tertiary' : 'text-outline'}`} />
                {n.label}
              </li>
            ))}
          </ul>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Each doctor adds a photo, qualification, short bio and years in practice on their own <em>Public Profile</em> page. Fee and hours come from what they have already set.
          </p>
        </div>

        {tenant.public_slug && listed && (
          <div className="flex flex-col gap-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Your clinic&apos;s shareable link</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-0 h-11 rounded-lg bg-surface-container-low px-3 flex items-center">
                <span className="font-body-sm text-body-sm text-on-surface truncate">{origin || '…'}/clinics/{tenant.public_slug}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${origin}/clinics/${tenant.public_slug}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* clipboard blocked — the text is still right there to select */
                  }
                }}
                className="h-11 px-4 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5 shrink-0"
              >
                <Icon name={copied ? 'check' : 'content_copy'} className="text-[18px]" /> {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Book a digital queue token at ${tenant.display_name ?? 'our clinic'} on ClinicQ: ${origin}/clinics/${tenant.public_slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-4 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5 shrink-0"
              >
                <Icon name="share" className="text-[18px]" /> Share
              </a>
              <Link href={`/clinics/${tenant.public_slug}`} target="_blank" className="font-label-md text-label-md text-primary flex items-center gap-1.5">
                <Icon name="open_in_new" className="text-[18px]" /> View
              </Link>
            </div>
          </div>
        )}
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            disabled={!dirty || state === 'saving'}
            onClick={save}
            className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-40 self-start"
          >
            <Icon name="save" className="text-[20px]" />
            {state === 'saving' ? 'Saving…' : 'Save clinic details'}
          </button>
          {state === 'saved' && !dirty && (reviewNote ? <p className="font-body-sm text-body-sm text-on-surface-variant">{reviewNote}</p> : <p className="font-body-sm text-body-sm text-tertiary">Saved ✓</p>)}
        </div>
      </div>
      </Section>
    </>
  );
}

/**
 * Billing/transactional email (invoices, payment confirmations, billing-due reminders, verification
 * mail) — a separate small form with its own private endpoint, deliberately NOT bundled into the
 * public-profile save above: this address is never shown publicly and must never go through content
 * moderation (which exists only to check public-facing listing text).
 */
function BillingEmail({ tenant, onSaved }: { tenant: Tenant; onSaved: () => Promise<void> }) {
  const [email, setEmail] = useState(tenant.contact_email ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const dirty = email !== (tenant.contact_email ?? '');

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      await api.updateTenantContactEmail(tenant.id, email.trim() || null);
      await onSaved();
      setState('saved');
    } catch (e) {
      setState('error');
      setError(e instanceof ApiError ? e.message : 'Could not save right now.');
    }
  };

  return (
    <Section title="Billing email" subtitle="Where invoices, payment confirmations, and billing-due reminders go. Private — never shown to patients.">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 max-w-sm">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="clinic@example.com"
            className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            disabled={!dirty || state === 'saving'}
            onClick={save}
            className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center gap-2 disabled:opacity-40 self-start"
          >
            <Icon name="save" className="text-[18px]" />
            {state === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {state === 'saved' && !dirty && <p className="font-body-sm text-body-sm text-tertiary">Saved ✓</p>}
        </div>
      </div>
    </Section>
  );
}


function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">{subtitle}</p>
      {children}
    </section>
  );
}
