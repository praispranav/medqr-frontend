'use client';

import { useEffect, useState } from 'react';
import type { AdminApi, ModuleRequest, AdminTenant } from '@/lib/adminApi';
import { AdminShell } from '@/components/admin/AdminShell';

export default function AdminModuleRequestsPage() {
  return <AdminShell active="/owner/module-requests">{(api) => <ModuleRequests api={api} />}</AdminShell>;
}

const STATUS_LABEL: Record<ModuleRequest['status'], { text: string; className: string }> = {
  pending: { text: 'Pending', className: 'bg-primary-container text-on-primary-container' },
  approved: { text: 'Approved', className: 'bg-tertiary-container text-white' },
  denied: { text: 'Denied', className: 'bg-surface-container text-on-surface-variant' },
};

function ModuleRequests({ api }: { api: AdminApi }) {
  const [requests, setRequests] = useState<ModuleRequest[] | null>(null);
  const [tenants, setTenants] = useState<Record<string, AdminTenant>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [reqs, tList] = await Promise.all([api.moduleRequests(), api.tenants()]);
      setRequests(reqs);
      setTenants(Object.fromEntries(tList.map((t) => [t.id, t])));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const setStatus = async (id: string, status: ModuleRequest['status']) => {
    setBusyId(id);
    try {
      const updated = await api.setModuleRequestStatus(id, status);
      setRequests((prev) => prev?.map((r) => (r.id === id ? updated : r)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-headline-lg text-headline-lg">Module Requests</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Clinic admins requesting billing add-ons (Decision 19). Approving a request doesn't automatically charge them—it just means you've handled it out-of-band and should manually enable the module for their clinic.
        </p>
      </div>

      {error && <p className="font-body-md text-body-md text-error">{error}</p>}
      {requests === null && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {requests?.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">No module requests yet.</p>}

      <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        {requests?.map((req) => (
          <div key={req.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-surface-container last:border-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-label-lg text-label-lg">{tenants[req.tenant_id]?.display_name || req.tenant_id}</p>
                <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${STATUS_LABEL[req.status].className}`}>{STATUS_LABEL[req.status].text}</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Requested: <span className="font-medium text-on-surface">{req.module_key}</span> {req.requested_by ? `by ${req.requested_by}` : ''}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{new Date(req.created_at).toLocaleString('en-IN')}</p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              {(['approved', 'denied'] as const)
                .filter((s) => s !== req.status && req.status === 'pending')
                .map((s) => (
                  <button
                    key={s}
                    disabled={busyId === req.id}
                    onClick={() => setStatus(req.id, s)}
                    className="h-9 px-3 rounded-full bg-surface-container-low text-on-surface font-label-sm text-label-sm disabled:opacity-60"
                  >
                    Mark {STATUS_LABEL[s].text.toLowerCase()}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
