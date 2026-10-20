'use client';
import { useEffect, useState } from 'react';
import type { AdminApi, ClinicEmailDraft, ClinicEmailState } from '@/lib/adminApi';
import { Icon } from '@/components/patient/ui';

type EmailApi = Pick<AdminApi, 'clinicEmail' | 'saveClinicEmail' | 'previewClinicEmail' | 'sendClinicEmail'>;
export function ClinicEmailPanel({api,tenantId,clinicName}:{api:EmailApi;tenantId:string;clinicName:string}) {
  const [state,setState]=useState<ClinicEmailState|null>(null);
  const [email,setEmail]=useState('');
  const [draft,setDraft]=useState<ClinicEmailDraft>({template:'listed',subject:'',message:''});
  const [html,setHtml]=useState('');
  const [previewing,setPreviewing]=useState(false);
  const [previewError,setPreviewError]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [busy,setBusy]=useState<'save'|'send'|null>(null);
  const [reload,setReload]=useState(0);
  const [clock,setClock]=useState(Date.now());
  useEffect(()=>{
    let live=true;
    api.clinicEmail(tenantId).then(data=>{if(!live)return;setState(data);setEmail(data.email??'');const initial=data.templates.find(t=>t.template===(data.listing_url?'listed':'custom'));if(initial)setDraft({template:initial.template,subject:initial.subject,message:initial.message});setError(null);}).catch(e=>{if(live)setError((e as Error).message);});
    return()=>{live=false;};
  },[api,tenantId,reload]);
  useEffect(()=>{
    let live=true; setHtml('');setPreviewError(null);
    if (!draft.subject.trim() || !draft.message.trim()) {setPreviewing(false);return;}
    setPreviewing(true);
    const timer=setTimeout(()=>{api.previewClinicEmail(tenantId,draft).then(r=>{if(live)setHtml(r.html);}).catch(e=>{if(live)setPreviewError((e as Error).message);}).finally(()=>{if(live)setPreviewing(false);});},800);
    return()=>{live=false;clearTimeout(timer);};
  },[api,tenantId,draft]);
  const waitUntil=Math.max(state?.last_sent_at?new Date(state.last_sent_at).getTime()+60_000:0,state?.sending_until?new Date(state.sending_until).getTime():0);
  const waiting=waitUntil>clock;
  useEffect(()=>{if(!waiting)return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[waiting]);
  const dirty=email.trim()!==(state?.email??'');
  const choose=(template:ClinicEmailDraft['template'])=>{
    const t=state?.templates.find(item=>item.template===template);if(t)setDraft({template:t.template,subject:t.subject,message:t.message});setNotice(null);setError(null);
  };
  const save=async()=>{
    setBusy('save');setError(null);setNotice(null);
    try{const data=await api.saveClinicEmail(tenantId,email.trim()||null);setState(data);setEmail(data.email??'');setNotice(data.email?'Clinic owner email saved.':'Clinic owner email removed.');}catch(e){setError((e as Error).message);}finally{setBusy(null);}
  };
  const send=async()=>{
    if(busy||dirty||!state?.email||state.is_demo||waiting||!html||previewing)return;
    setBusy('send');setError(null);setNotice(null);
    try{const data=await api.sendClinicEmail(tenantId,draft);setState(data);setClock(Date.now());setNotice(`Email accepted for sending to ${data.last_sent_to}.`);}catch(e){setError((e as Error).message);}finally{setBusy(null);}
  };
  if(!state)return <div className="rounded-2xl bg-surface-container-lowest p-5">{error?<p role="alert" className="text-error">{error} <button className="min-h-11 underline" onClick={()=>setReload(v=>v+1)}>Try again</button></p>:<p className="text-on-surface-variant">Loading clinic email…</p>}</div>;
  const input='w-full min-w-0 rounded-xl bg-surface-container-low px-3 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30';
  return <section aria-label="Email clinic owner" className="flex flex-col gap-5 pb-8">
    <div><h2 className="font-headline-sm text-headline-sm">Email clinic owner</h2><p className="mt-1 text-body-md text-on-surface-variant">Write to the owner of {clinicName}. Choose a template or write your own message.</p></div>
    <div className="rounded-2xl bg-surface-container-lowest p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2"><label className="flex min-w-0 flex-1 flex-col gap-1"><span className="font-label-md text-label-md">Clinic owner email (private)</span><input type="email" value={email} onChange={e=>{setEmail(e.target.value);setNotice(null);}} placeholder="owner@clinic.com" maxLength={254} autoCapitalize="none" spellCheck={false} disabled={!!busy} className={`${input} h-11`}/></label><button onClick={save} disabled={!dirty||!!busy} className="h-11 rounded-xl bg-surface-container-low px-4 text-label-md text-primary disabled:opacity-40">{busy==='save'?'Saving…':'Save email'}</button></div>
      <p className="text-body-sm text-on-surface-variant">Used only for correspondence from Owner. This is separate from billing email and is never shown on the public listing.</p>
      {dirty&&<p className="text-body-sm text-on-surface-variant">Save this recipient before sending.</p>}
      {state.last_sent_at&&<p className="text-body-sm text-on-surface-variant">Last sent to {state.last_sent_to} · {new Date(state.last_sent_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})}<br/>{state.last_subject}</p>}
      {state.last_error&&<p className="text-body-sm text-error">{state.last_error}</p>}
    </div>
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <div className="rounded-2xl bg-surface-container-lowest p-5 flex min-w-0 flex-col gap-4">
        <label className="flex flex-col gap-1"><span className="font-label-md text-label-md">Template</span><select value={draft.template} onChange={e=>choose(e.target.value as ClinicEmailDraft['template'])} disabled={!!busy} className={`${input} h-11`}>{state.templates.map(t=><option key={t.template} value={t.template} disabled={!state.listing_url&&t.template!=='custom'}>{t.label}</option>)}</select></label>
        {!state.listing_url&&<p className="text-body-sm text-on-surface-variant">Listing templates are available once the clinic and a doctor are publicly listed. You can still write a custom email.</p>}
        <label className="flex flex-col gap-1"><span className="font-label-md text-label-md">Subject</span><input value={draft.subject} onChange={e=>{setDraft(d=>({...d,subject:e.target.value}));setNotice(null);}} maxLength={180} disabled={!!busy} className={`${input} h-11`}/></label>
        <label className="flex flex-col gap-1"><span className="font-label-md text-label-md">Message</span><textarea rows={15} value={draft.message} onChange={e=>{setDraft(d=>({...d,message:e.target.value}));setNotice(null);}} maxLength={6000} disabled={!!busy} className={`${input} py-3 leading-relaxed`}/></label>
        <p className="text-body-sm text-on-surface-variant">All templates are editable. ClinicQ branding and the available listing, claim and removal links are added automatically.</p>
        {state.is_demo&&<p className="text-body-sm text-on-surface-variant">Sending is disabled for demo clinics.</p>}
        {(error||previewError)&&<p role="alert" className="text-body-sm text-error">{error||previewError}</p>}
        {notice&&<p role="status" className="text-body-sm text-primary">{notice}</p>}
        <div className="flex flex-wrap items-center gap-3"><button onClick={send} disabled={!!busy||dirty||!state.email||state.is_demo||waiting||!html||previewing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-label-lg text-on-primary disabled:opacity-40"><Icon name="send" className="text-[18px]"/>{busy==='send'?'Sending…':'Send email'}</button>{waiting&&<span className="text-body-sm text-on-surface-variant">{state.sending_until&&new Date(state.sending_until).getTime()>clock?'A send may still be in progress. Refresh to check its status.':`You can send again in ${Math.ceil((waitUntil-clock)/1000)}s.`}</span>}</div>
      </div>
      <div className="rounded-2xl bg-surface-container-lowest p-4 flex min-w-0 flex-col gap-3"><h3 className="font-label-lg text-label-lg">Email preview</h3>{state.email&&<p className="text-body-sm text-on-surface-variant break-all">To: {state.email}</p>}{previewing?<p role="status" className="text-body-sm text-on-surface-variant">Updating preview…</p>:html?<iframe title="Clinic email preview" srcDoc={html} sandbox="" className="w-full min-w-0 h-[720px] rounded-xl bg-surface-container-low"/>:<p className="text-body-sm text-on-surface-variant">Add a subject and message to see the branded email.</p>}{state.listing_url&&<a href={state.listing_url} target="_blank" rel="noopener noreferrer" className="text-body-sm text-primary underline">Open clinic listing</a>}</div>
    </div>
  </section>;
}
