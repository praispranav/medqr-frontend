import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { fileUrl as absoluteUrl } from '@/lib/api';
import { CLINIC_TZ } from '@/lib/clinicTime';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Decision 46: fixed English token picture for downloads and WhatsApp confirmations.
// Ported from ClinicQ_Patient_Token_Design_1.html using Satori-compatible flex layouts.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const GREEN = '#006b41';
const MUTED = '#73837b';
const CANVAS = '#f4f8f5';
// Local fonts keep rendering independent of external font services and give Satori
// an actual bold face (its default font only includes regular weight).
const fontFiles = Promise.all([
  readFile(join(process.cwd(), 'src/assets/fonts/manrope-latin-400-normal.woff')),
  readFile(join(process.cwd(), 'src/assets/fonts/manrope-latin-700-normal.woff')),
]);

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

function CalendarIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;
}

function CheckIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>;
}

function DoctorIcon() {
  return <svg width="40" height="40" viewBox="0 0 48 48" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 7H7v12a11 11 0 0 0 22 0V7h-3M10 5v4M26 5v4M18 30v4a9 9 0 0 0 18 0v-7" /><circle cx="36" cy="22" r="5" /></svg>;
}

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  const id = params.tokenId.replace(/\.png$/i, '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response('Not found', { status: 404 });
  const res = await fetch(`${API_BASE}/queue/tokens/${id}`, { cache: 'no-store' });
  if (!res.ok) return new Response('Not found', { status: 404 });
  const v = (await res.json()) as View;

  const verified = v.status === 'waiting_in_clinic' || v.status === 'checked_in_early';
  const noDesk = !v.front_desk;
  const future = v.is_future_booking;
  const arrivalScan = noDesk && v.arrival_scan;
  const closed = ['done', 'cancelled', 'expired', 'no_show'].includes(v.status);
  const consulting = v.status === 'in_consultation';
  const showQr = !closed && !consulting && !verified && !noDesk;
  const status = closed
    ? ({ done: 'Visit completed', cancelled: 'Token cancelled', expired: 'Token expired', no_show: 'Missed turn' }[v.status] ?? 'Visit closed')
    : consulting ? 'Your turn'
    : future ? 'Upcoming visit'
    : verified ? 'Checked in'
    : arrivalScan ? 'Arrival scan needed'
    : noDesk ? 'In the queue' : 'Check in at reception';
  const scanTitle = closed ? status.toUpperCase()
    : consulting ? 'YOUR TURN'
    : future ? 'YOUR VISIT TOKEN'
    : verified ? 'YOU’RE CHECKED IN'
    : arrivalScan ? 'SCAN ON ARRIVAL'
    : noDesk ? 'YOUR QUEUE TOKEN' : 'SCAN AT CLINIC';
  const note = closed ? 'This token is no longer in the live queue.'
    : consulting ? 'Please proceed to the doctor when called.'
    : future ? (noDesk ? 'Keep this token for your visit. Follow the clinic’s arrival instructions on the day.' : 'Keep this token and show it at reception on your visit date.')
    : verified ? 'Your arrival is confirmed. Please wait for your number to be called.'
    : arrivalScan ? 'Scan the clinic’s Arrival QR with your phone when you get there.'
    : noDesk ? 'Please wait for the doctor to call your number.'
    : 'Show this token at reception for a faster check-in.';

  const qualification = [v.doctor.qualification, v.doctor.specialty].filter(Boolean).join(' · ');
  const tokenLabel = String(v.token_number).padStart(2, '0');
  const dateLabel = new Date(`${v.token_date}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: CLINIC_TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  // ImageResponse has no auto-height. Reserve extra rows for long dynamic text; the scan
  // panel fills the remaining space so the footer always sits at the bottom of the ticket.
  const extraRows = Math.max(0, Math.ceil(v.doctor.name.length / 20) - 1)
    + Math.max(0, Math.ceil(qualification.length / 42) - 1)
    + Math.max(0, Math.ceil(v.clinic.name.length / 42) - 1)
    + Math.max(0, Math.ceil((v.doctor.cabin_label?.length ?? 0) / 42) - 1);
  const height = 985 + extraRows * 40;
  const qr = showQr ? await QRCode.toDataURL(id, { width: 240, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#101c15', light: '#ffffff' } }) : null;
  const [regularFont, boldFont] = await fontFiles;

  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: CANVAS, padding: '18px 16px', fontFamily: 'Manrope', color: '#15231b' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#fff', borderRadius: 26, overflow: 'hidden', boxShadow: '0 8px 18px rgba(0,71,43,0.10)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', height: 292, padding: '30px 26px 24px', color: '#fff', backgroundImage: 'linear-gradient(124deg, #008153 0%, #00663f 58%, #004f31 100%)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', position: 'absolute', width: 340, height: 340, borderRadius: 999, right: -210, top: -130, background: 'rgba(96,229,157,0.13)' }} />
          <div style={{ display: 'flex', position: 'absolute', width: 480, height: 260, borderRadius: '50%', left: -170, bottom: -195, background: 'rgba(51,201,124,0.16)' }} />
          <div style={{ display: 'flex', position: 'absolute', right: 24, top: 35, width: 80, height: 80, opacity: 0.22 }}>
            <div style={{ display: 'flex', position: 'absolute', width: 28, height: 80, top: 0, left: 26, borderRadius: 10, background: '#b1ffd4' }} />
            <div style={{ display: 'flex', position: 'absolute', width: 80, height: 28, top: 26, left: 0, borderRadius: 10, background: '#b1ffd4' }} />
          </div>
          <div style={{ display: 'flex', fontSize: 48, fontWeight: 800, letterSpacing: -2, lineHeight: 1.1 }}>Clinic<span style={{ color: '#a4f1c5' }}>Q</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10, fontSize: 10, letterSpacing: 3.8, lineHeight: 1.5, color: '#a8e8c5' }}><span>YOUR HEALTH</span><span>IN GOOD HANDS</span></div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 28, flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: 142, flexShrink: 0, paddingRight: 16, borderRight: '1px solid rgba(255,255,255,0.32)' }}>
              <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, letterSpacing: 1.4, color: '#bbefcf' }}>TOKEN NO.</div>
              <div style={{ display: 'flex', alignItems: 'center', height: 105, fontSize: tokenLabel.length <= 2 ? 104 : tokenLabel.length === 3 ? 70 : Math.min(56, 190 / tokenLabel.length), fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>{tokenLabel}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingLeft: 22 }}>
              <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, letterSpacing: 0.6, color: '#b6e5c9' }}>VISIT DATE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10 }}><CalendarIcon /><div style={{ display: 'flex', flex: 1, fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>{dateLabel}</div></div>
              <div style={{ display: 'flex', fontSize: 11, color: '#bbefcf', marginTop: 12 }}>Live queue token</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '20px 24px 16px' }}>
          <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: GREEN, lineHeight: 1.4, marginBottom: 14, wordBreak: 'break-word' }}>{v.clinic.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.4 }}>DOCTOR</div>
              <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, lineHeight: 1.25, letterSpacing: -0.5, marginTop: 6, wordBreak: 'break-word' }}>{v.doctor.name}</div>
              {qualification && <div style={{ display: 'flex', fontSize: 13, lineHeight: 1.5, color: MUTED, marginTop: 6, wordBreak: 'break-word' }}>{qualification}</div>}
            </div>
            {v.doctor.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={absoluteUrl(v.doctor.photo_url)} width={68} height={68} alt="" style={{ flexShrink: 0, borderRadius: 999, objectFit: 'cover' }} />
            ) : <div style={{ display: 'flex', width: 68, height: 68, flexShrink: 0, borderRadius: 999, background: '#e9f7ee', alignItems: 'center', justifyContent: 'center' }}><DoctorIcon /></div>}
          </div>
          {v.doctor.cabin_label && <div style={{ display: 'flex', marginTop: 12, fontSize: 12, lineHeight: 1.4, color: MUTED, wordBreak: 'break-word' }}>{v.doctor.cabin_label}</div>}
          <div style={{ display: 'flex', marginTop: 18, paddingTop: 16, borderTop: '1px solid #e2ece6' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '50%', paddingRight: 10, gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 32, height: 32, borderRadius: 999, background: '#eaf7ee', color: GREEN }}><CalendarIcon size={17} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><div style={{ display: 'flex', fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: 0.7 }}>VISIT DATE</div><div style={{ display: 'flex', marginTop: 5, fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>{dateLabel}</div></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', width: '50%', paddingLeft: 12, borderLeft: '1px solid #e2ece6', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 32, height: 32, borderRadius: 999, background: '#eaf7ee', color: GREEN }}>{verified ? <CheckIcon size={17} /> : <CalendarIcon size={17} />}</div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><div style={{ display: 'flex', fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: 0.7 }}>STATUS</div><div style={{ display: 'flex', marginTop: 5, fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>{status}</div></div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', position: 'relative', flexShrink: 0, height: 28, alignItems: 'center' }}>
          <div style={{ display: 'flex', position: 'absolute', width: 30, height: 30, borderRadius: 999, background: CANVAS, top: -1, left: -15 }} />
          <div style={{ display: 'flex', position: 'absolute', width: 30, height: 30, borderRadius: 999, background: CANVAS, top: -1, right: -15 }} />
          <div style={{ display: 'flex', flex: 1, margin: '0 24px', borderTop: '2px dashed #d7e1da' }} />
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 300, padding: '8px 20px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', borderRadius: 20, backgroundImage: 'linear-gradient(135deg, #f0faf4, #e8f6ee)', padding: '20px 18px' }}>
            <div style={{ display: 'flex', fontSize: 13, fontWeight: 800, color: GREEN, letterSpacing: 1.8, textAlign: 'center' }}>{scanTitle}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0, width: 180, height: 180, marginTop: 16, color: GREEN }}>
              <div style={{ display: 'flex', position: 'absolute', width: 24, height: 24, top: 0, left: 0, borderTop: '2px solid #006b41', borderLeft: '2px solid #006b41', borderTopLeftRadius: 8 }} />
              <div style={{ display: 'flex', position: 'absolute', width: 24, height: 24, top: 0, right: 0, borderTop: '2px solid #006b41', borderRight: '2px solid #006b41', borderTopRightRadius: 8 }} />
              <div style={{ display: 'flex', position: 'absolute', width: 24, height: 24, bottom: 0, left: 0, borderBottom: '2px solid #006b41', borderLeft: '2px solid #006b41', borderBottomLeftRadius: 8 }} />
              <div style={{ display: 'flex', position: 'absolute', width: 24, height: 24, bottom: 0, right: 0, borderBottom: '2px solid #006b41', borderRight: '2px solid #006b41', borderBottomRightRadius: 8 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 164, height: 164, borderRadius: 12, background: '#fff' }}>
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} width={164} height={164} alt="Token check-in QR" />
                ) : verified || consulting || v.status === 'done' ? <CheckIcon size={90} />
                  : closed ? <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></svg>
                  : future ? <CalendarIcon size={80} />
                  : <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>}
              </div>
            </div>
            <div style={{ display: 'flex', fontSize: 12, lineHeight: 1.5, color: MUTED, marginTop: 14, textAlign: 'center' }}>{note}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', flexShrink: 0, gap: 14, padding: '16px 24px 18px' }}>
          <svg width="110" height="2" viewBox="0 0 110 2"><path d="M0 1H110" stroke="#d6e2d9" /></svg>
          <div style={{ display: 'flex', fontSize: 25, fontWeight: 800, color: '#005734', letterSpacing: -1 }}>ClinicQ</div>
          <svg width="110" height="2" viewBox="0 0 110 2"><path d="M0 1H110" stroke="#d6e2d9" /></svg>
        </div>
      </div>
    </div>,
    { width: 430, height, fonts: [
      { name: 'Manrope', data: regularFont, weight: 400, style: 'normal' },
      { name: 'Manrope', data: boldFont, weight: 700, style: 'normal' },
    ], headers: { 'Cache-Control': 'no-store' } },
  );
}
