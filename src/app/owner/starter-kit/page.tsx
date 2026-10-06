'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminApi, type AdminTenant, type AdminDoctor } from '@/lib/adminApi';
import { type QrCodeView } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { AdminShell } from '@/components/admin/AdminShell';

export default function StarterKitPage() {
  return <AdminShell active="/owner/starter-kit">{(api) => <StarterKit api={api} />}</AdminShell>;
}

function StarterKit({ api }: { api: any }) {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  
  const [tenantId, setTenantId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  
  const [generating, setGenerating] = useState(false);
  const [kit, setKit] = useState<{
    clinicCode: QrCodeView;
    doctorCode: QrCodeView;
    unassigned1: QrCodeView;
    unassigned2: QrCodeView;
  } | null>(null);

  useEffect(() => {
    api.clinics().then(setTenants).catch(console.error);
  }, [api]);

  useEffect(() => {
    setDoctorId('');
    setDoctors([]);
    if (tenantId) api.doctors(tenantId).then(setDoctors).catch(console.error);
  }, [api, tenantId]);

  const generateKit = async () => {
    if (!tenantId || !doctorId) return;
    setGenerating(true);
    try {
      const clinicCodes = await api.createQrCodes(1, 'Starter Kit (Clinic)', { tenant_id: tenantId, doctor_id: null });
      const doctorCodes = await api.createQrCodes(1, 'Starter Kit (Doctor)', { tenant_id: tenantId, doctor_id: doctorId });
      const unassignedCodes = await api.createQrCodes(2, 'Starter Kit (Spare)', { tenant_id: null, doctor_id: null });
      
      setKit({ 
        clinicCode: clinicCodes[0], 
        doctorCode: doctorCodes[0], 
        unassigned1: unassignedCodes[0], 
        unassigned2: unassignedCodes[1] 
      });
    } catch (e) {
      console.error(e);
      alert('Failed to generate starter kit');
    } finally {
      setGenerating(false);
    }
  };

  const getUrl = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://medqr.in';
    return `${origin}/q/${code}`;
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-surface-container-lowest print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; background: white; }
          .no-print { display: none !important; }
          .print-only { display: grid !important; }
        }
      ` }} />

      <div className="max-w-2xl mx-auto flex flex-col gap-6 no-print">
        <h1 className="font-headline-lg text-headline-lg">Starter Kit Generator</h1>
        <p className="font-body-md text-on-surface-variant">Select a clinic and a doctor to generate an A4 sheet with 4 QRs: 1 Clinic, 1 Doctor, and 2 Unassigned spares.</p>
        
        <div className="flex flex-col gap-4 bg-surface-container p-6 rounded-2xl">
          <label className="flex flex-col gap-1">
            <span className="font-label-md">Select Clinic</span>
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="h-12 rounded-lg px-3">
              <option value="">-- Choose Clinic --</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.display_name ?? t.subdomain}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md">Select Doctor</span>
            <select value={doctorId} disabled={!tenantId} onChange={(e) => setDoctorId(e.target.value)} className="h-12 rounded-lg px-3">
              <option value="">-- Choose Doctor --</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          
          <button 
            disabled={!tenantId || !doctorId || generating} 
            onClick={generateKit}
            className="h-12 bg-primary text-on-primary rounded-xl font-label-lg mt-2 disabled:opacity-50"
          >
            {generating ? 'Generating QRs...' : 'Generate A4 Kit'}
          </button>
        </div>

        {kit && (
          <div className="flex flex-col gap-4 items-center">
            <button onClick={() => window.print()} className="h-12 px-8 bg-tertiary text-on-tertiary rounded-xl font-label-lg">
              Print A4 Sheet
            </button>
            <p className="text-on-surface-variant font-body-sm text-center">Make sure to enable <b>Background Graphics</b> in print settings and set margins to <b>None</b>.</p>
          </div>
        )}
      </div>

      {kit && (
        <div className="hidden print:grid grid-cols-2 grid-rows-2 w-[210mm] h-[297mm] bg-white overflow-hidden" style={{ boxSizing: 'border-box' }}>
          <QrCell 
            title={tenants.find(t => t.id === tenantId)?.display_name ?? 'Whole Clinic'} 
            subtitle="Reception / Clinic-wide QR"
            code={kit.clinicCode.code} 
            url={getUrl(kit.clinicCode.code)} 
            type="Clinic"
          />
          <QrCell 
            title={doctors.find(d => d.id === doctorId)?.name ?? 'Doctor'} 
            subtitle="Direct Doctor Check-in"
            code={kit.doctorCode.code} 
            url={getUrl(kit.doctorCode.code)} 
            type="Doctor"
          />
          <QrCell 
            title="Scan to Setup" 
            subtitle="Unassigned Spare QR"
            code={kit.unassigned1.code} 
            url={getUrl(kit.unassigned1.code)} 
            type="Spare"
          />
          <QrCell 
            title="Scan to Setup" 
            subtitle="Unassigned Spare QR"
            code={kit.unassigned2.code} 
            url={getUrl(kit.unassigned2.code)} 
            type="Spare"
          />
        </div>
      )}
    </div>
  );
}

function QrCell({ title, subtitle, code, url, type }: { title: string; subtitle: string; code: string; url: string; type: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 border-b border-r border-gray-200" style={{ width: '105mm', height: '148.5mm', boxSizing: 'border-box' }}>
      <div className="w-full flex-1 flex flex-col items-center justify-center border-[3px] border-black rounded-[18px] p-6 text-center" style={{ overflow: 'hidden' }}>
        <div className="bg-black text-white w-full py-4 -mx-6 -mt-6 px-4">
          <h2 className="text-2xl font-black leading-tight truncate">{title}</h2>
          <p className="text-[13px] font-bold mt-1 text-gray-200">{subtitle}</p>
        </div>
        
        <p className="text-[28px] font-black leading-[1.05] mt-6">SCAN FOR<br />YOUR TOKEN</p>
        <p className="text-[13px] font-bold mt-1.5">Any phone camera · no app needed</p>
        
        <div className="mt-4 mb-2">
          <QRCodeSVG value={url} size={220} level="Q" marginSize={2} />
        </div>
        
        <p className="text-xl font-black mt-2">MQ-{code}</p>
        <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">{type}</p>
      </div>
    </div>
  );
}
