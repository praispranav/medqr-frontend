import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { fileUrl as absoluteUrl } from '@/lib/api';

// The patient's token as a picture (PNG) — used by the "Download my token" button (works on iPhone, where drawing the
// page into an image is unreliable) and as the header image of the WhatsApp token confirmation. Public like the
// token page itself: the unguessable token id is the only key. English only (it is a fixed card).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

interface View {
  token_number: number;
  status: string;
  doctor: { name: string; cabin_label: string | null; qualification: string | null; specialty: string | null; photo_url: string | null };
  clinic: { name: string };
  front_desk: boolean;
  arrival_scan: boolean;
  is_future_booking: boolean;
  booking_date: string | null;
  token_date: string;
}

const initialsOf = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'Dr';

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  const id = params.tokenId.replace(/\.png$/i, '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  const res = await fetch(`${API_BASE}/queue/tokens/${id}`, { cache: 'no-store' });
  if (!res.ok) return new Response('Not found', { status: 404 });
  const v = (await res.json()) as View;

  // Same rules as the token page's card: a QR to scan until the patient is checked in.
  const verified = v.status === 'waiting_in_clinic' || v.status === 'checked_in_early';
  const noDesk = !v.front_desk;
  const arrivalScan = noDesk && v.arrival_scan && !v.is_future_booking;
  const arrived = verified || (noDesk && !arrivalScan);
  const caption = v.is_future_booking && v.booking_date
    ? `Booked for ${new Date(`${v.booking_date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`
    : arrivalScan && !verified
      ? 'Scan the clinic’s Arrival QR when you get there'
      : noDesk
        ? 'Wait for the doctor to call your number'
        : verified
          ? 'Verified at reception'
          : 'Show this QR at reception';

  const svg = await QRCode.toString(id, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#00201d', light: '#ffffff' } });
  const qr = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const specialty = [v.doctor.qualification, v.doctor.specialty].filter(Boolean).join(' · ');
  const dateLabel = new Date(`${v.token_date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const stroke = { WebkitTextStroke: '5px #005c55' } as const; // the bundled font has no bold: thicken the big number

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ffffff' }}>
        <div style={{ display: 'flex', width: '100%', height: 96, background: '#0f766e', color: '#ffffff', alignItems: 'center', justifyContent: 'center', fontSize: 38, letterSpacing: 2 }}>
          ClinicQ
        </div>
        {/* Doctor first — their photo and name is what the patient recognises; the clinic is the subtitle. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 60px 0', textAlign: 'center' }}>
          {v.doctor.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={absoluteUrl(v.doctor.photo_url)} width={140} height={140} alt="" style={{ borderRadius: '50%', objectFit: 'cover', border: '4px solid #cfe9e5' }} />
          ) : (
            <div
              style={{
                display: 'flex', width: 140, height: 140, borderRadius: '50%', background: '#f0fdfa', color: '#0f766e',
                alignItems: 'center', justifyContent: 'center', fontSize: 52, border: '4px solid #cfe9e5',
              }}
            >
              {initialsOf(v.doctor.name)}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 44, color: '#131b2e', marginTop: 20, ...({ WebkitTextStroke: '1.5px #131b2e' }) }}>{v.doctor.name}</div>
          {specialty && <div style={{ display: 'flex', fontSize: 24, color: '#3e4947', marginTop: 6 }}>{specialty}</div>}
          <div style={{ display: 'flex', fontSize: 26, color: '#3e4947', marginTop: 10 }}>
            {[v.clinic.name, v.doctor.cabin_label].filter(Boolean).join(' · ')}
          </div>
          <div
            style={{
              display: 'flex', marginTop: 16, padding: '6px 18px', borderRadius: 999, background: '#f0fdfa',
              color: '#0f766e', fontSize: 20, fontWeight: 700,
            }}
          >
            {dateLabel}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#0f766e', letterSpacing: 4, marginTop: 36 }}>YOUR TOKEN</div>
        <div style={{ display: 'flex', fontSize: 210, color: '#005c55', lineHeight: 1, marginTop: 4, ...stroke }}>{`#${v.token_number}`}</div>
        <div style={{ display: 'flex', marginTop: 40, padding: 22, border: '4px solid #cfe9e5', borderRadius: 28 }}>
          {arrived ? (
            <div style={{ display: 'flex', width: 280, height: 280, alignItems: 'center', justifyContent: 'center', fontSize: 210, color: '#0f766e' }}>✓</div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} width={280} height={280} alt="" />
          )}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#0f766e', marginTop: 34, padding: '0 70px', textAlign: 'center' }}>{caption}</div>
        <div style={{ display: 'flex', fontSize: 20, color: '#6f7977', marginTop: 18 }}>{`ID: ${id.split('-')[0].toUpperCase()}`}</div>
      </div>
    ),
    { width: 900, height: 1220, headers: { 'Cache-Control': 'no-store' } },
  );
}
