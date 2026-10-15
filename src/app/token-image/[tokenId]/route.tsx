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

export async function GET(req: Request, { params }: { params: { tokenId: string } }) {
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

  const svg = await QRCode.toString(id, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#101c15', light: '#ffffff' } });
  const qr = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const qualification = [v.doctor.qualification, v.doctor.specialty].filter(Boolean).join(' · ');
  const tokenLabel = String(v.token_number).padStart(2, '0');
  const dateLabel = new Date(`${v.token_date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  // The perforation notches cut into the ticket's sides — plain canvas-coloured circles, each
  // pinned by only top + one side (never both left and right, which over-constrains the box).
  const notchLeft = <div style={{ position: 'absolute', width: 28, height: 28, borderRadius: 999, background: '#f4f8f5', top: -1, left: -14 }} />;
  const notchRight = <div style={{ position: 'absolute', width: 28, height: 28, borderRadius: 999, background: '#f4f8f5', top: -1, right: -14 }} />;

  // One bracket corner for the QR frame — each is pinned by exactly two position props (never all
  // four, which over-constrains an absolutely positioned box) plus its two visible border sides.
  const qrTL = <div style={{ position: 'absolute', width: 20, height: 20, top: 0, left: 0, borderTop: '2px solid #006b41', borderLeft: '2px solid #006b41' }} />;
  const qrTR = <div style={{ position: 'absolute', width: 20, height: 20, top: 0, right: 0, borderTop: '2px solid #006b41', borderRight: '2px solid #006b41' }} />;
  const qrBL = <div style={{ position: 'absolute', width: 20, height: 20, bottom: 0, left: 0, borderBottom: '2px solid #006b41', borderLeft: '2px solid #006b41' }} />;
  const qrBR = <div style={{ position: 'absolute', width: 20, height: 20, bottom: 0, right: 0, borderBottom: '2px solid #006b41', borderRight: '2px solid #006b41' }} />;

  const icon = (d: string) => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
  const calendarIcon = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#f4f8f5', padding: '18px 12px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', background: '#fff', borderRadius: 24, overflow: 'hidden' }}>
          {/* ---- Hero: brand + token number + visit date, on a green gradient ---- */}
          <div
            style={{
              display: 'flex', flexDirection: 'column', position: 'relative', padding: '34px 30px 24px',
              backgroundImage: 'linear-gradient(124deg, #008153 0%, #00663f 58%, #004f31 100%)', color: '#fff', overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', position: 'absolute', width: 340, height: 340, borderRadius: 999, right: -170, top: -150, background: 'rgba(96,229,157,0.14)' }} />
            <div style={{ display: 'flex', position: 'absolute', width: 420, height: 420, borderRadius: 999, left: -220, bottom: -260, background: 'rgba(51,201,124,0.18)' }} />

            {/* Decorative plus mark, top-right */}
            <div style={{ display: 'flex', position: 'absolute', right: 26, top: 14, opacity: 0.2 }}>
              <div style={{ display: 'flex', position: 'absolute', width: 26, height: 72, left: 23, background: '#b1ffd4', borderRadius: 10 }} />
              <div style={{ display: 'flex', position: 'absolute', width: 72, height: 26, top: 23, background: '#b1ffd4', borderRadius: 10 }} />
            </div>

            <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, letterSpacing: -2, ...({ WebkitTextStroke: '1px #fff' }) }}>
              Clinic<span style={{ color: '#a4f1c5' }}>Q</span>
            </div>
            <div style={{ display: 'flex', fontSize: 11, letterSpacing: 4, color: '#a8e8c5', marginTop: 8 }}>YOUR HEALTH IN GOOD HANDS</div>

            <div style={{ display: 'flex', alignItems: 'center', marginTop: 34 }}>
              <div style={{ display: 'flex', flexDirection: 'column', width: '42%', paddingRight: 14, borderRight: '1px solid rgba(255,255,255,0.36)' }}>
                <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: '#bbefcf', letterSpacing: 1.4 }}>TOKEN NO.</div>
                <div style={{ display: 'flex', fontSize: 108, fontWeight: 800, lineHeight: 1, marginTop: 6, ...({ WebkitTextStroke: '1.5px #fff' }) }}>{tokenLabel}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', width: '58%', paddingLeft: 22 }}>
                <div style={{ display: 'flex', fontSize: 12, fontWeight: 800, color: '#b6e5c9', letterSpacing: 0.6 }}>VISIT DATE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 19, fontWeight: 700, marginTop: 8 }}>
                  {calendarIcon}
                  {dateLabel}
                </div>
              </div>
            </div>
          </div>

          {/* ---- Doctor panel ---- */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '26px 28px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 11, fontWeight: 700, color: '#73837b', letterSpacing: 1.25 }}>DOCTOR</div>
                <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: '#161b18', marginTop: 6, letterSpacing: -0.5 }}>{v.doctor.name}</div>
                {qualification && <div style={{ display: 'flex', fontSize: 14, color: '#68786d', marginTop: 6 }}>{qualification}</div>}
              </div>
              {v.doctor.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={absoluteUrl(v.doctor.photo_url)} width={74} height={74} alt="" style={{ borderRadius: 999, objectFit: 'cover' }} />
              ) : (
                <div style={{ display: 'flex', width: 74, height: 74, borderRadius: 999, background: '#e9f7ee', color: '#006b41', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700 }}>
                  {initialsOf(v.doctor.name)}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid #e2ece6', marginTop: 24, paddingTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '50%', paddingRight: 12 }}>
                <div style={{ display: 'flex', width: 35, height: 35, borderRadius: 999, background: '#eaf7ee', color: '#006b41', alignItems: 'center', justifyContent: 'center' }}>
                  {calendarIcon}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 9 }}>
                  <div style={{ display: 'flex', fontSize: 9, fontWeight: 700, color: '#73837b', letterSpacing: 1 }}>VISIT DATE</div>
                  <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: '#15231b', marginTop: 4 }}>{dateLabel}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', width: '50%', paddingLeft: 12, borderLeft: '1px solid #e2ece6' }}>
                <div style={{ display: 'flex', width: 35, height: 35, borderRadius: 999, background: '#eaf7ee', color: '#006b41', alignItems: 'center', justifyContent: 'center' }}>
                  {icon('M3 10.5L8 15.5L17 5')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 9 }}>
                  <div style={{ display: 'flex', fontSize: 9, fontWeight: 700, color: '#73837b', letterSpacing: 1 }}>STATUS</div>
                  <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: '#15231b', marginTop: 4 }}>{caption}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Perforation ---- */}
          <div style={{ display: 'flex', position: 'relative', height: 25, alignItems: 'center' }}>
            {notchLeft}
            {notchRight}
            <div style={{ display: 'flex', flex: 1, height: 0, margin: '0 22px', borderTop: '2px dashed #cedbd2' }} />
          </div>

          {/* ---- QR ---- */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 24px 10px' }}>
            <div
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', borderRadius: 18,
                backgroundImage: 'linear-gradient(135deg, #effbf3, #e7f6ed)', padding: '18px 14px',
              }}
            >
              <div style={{ display: 'flex', fontSize: 13, fontWeight: 800, color: '#006b41', letterSpacing: 2.2 }}>SCAN AT CLINIC</div>
              <div style={{ display: 'flex', position: 'relative', marginTop: 14, padding: 8, background: '#fff', borderRadius: 10 }}>
                {qrTL}
                {qrTR}
                {qrBL}
                {qrBR}
                {arrived ? (
                  <div style={{ display: 'flex', width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="90" height="90" viewBox="0 0 20 20" fill="none">
                      <path d="M3 10.5L8 15.5L17 5" stroke="#006b41" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} width={150} height={150} alt="" />
                )}
              </div>
              <div style={{ display: 'flex', fontSize: 12, lineHeight: 1.5, color: '#71877a', marginTop: 12, textAlign: 'center' }}>
                Show this token at the reception for a faster check-in.
              </div>
            </div>
          </div>

          {/* ---- Footer ---- */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '12px 24px 26px' }}>
            <div style={{ display: 'flex', height: 1, flex: 1, background: '#d6e2d9' }} />
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, color: '#005734', letterSpacing: -1 }}>ClinicQ</div>
            <div style={{ display: 'flex', height: 1, flex: 1, background: '#d6e2d9' }} />
          </div>
        </div>
      </div>
    ),
    { width: 430, height: 985, headers: { 'Cache-Control': 'no-store' } },
  );
}
