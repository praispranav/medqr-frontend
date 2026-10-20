import Link from 'next/link';

/**
 * Decision 60 — shown on a listed clinic's page instead of "Get my token" when the clinic doesn't take
 * online tokens (free plan / not on ClinicQ yet). Points the clinic itself at ClinicQ for clinics.
 */
export function ClaimBox({ code }: { code: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-[#0F766E]/40 bg-white p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex-1">
        <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F2A24]">Is this your clinic?</h2>
        <p className="mt-1 font-body-md text-body-md text-[#0F2A24]/70">
          Let patients take a token from their phone and wait from home. Claim this page to correct its details, or switch on online tokens by joining ClinicQ.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        {/* Decision 64: claim with documents; ClinicQ checks them before anything changes. */}
        <Link href={`/claim/${code}`} className="h-12 px-6 rounded-xl bg-[#0F766E] text-white font-label-lg text-label-lg flex items-center justify-center gap-2">
          Claim this clinic <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </Link>
        <Link href="/for-clinics" className="h-12 px-5 rounded-xl border border-[#0F766E]/30 text-[#0F766E] font-label-lg text-label-lg flex items-center justify-center">
          ClinicQ for clinics
        </Link>
      </div>
    </section>
  );
}
