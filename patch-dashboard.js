const fs = require('fs');
const file = 'src/app/doctor/dashboard/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add expandedId state
code = code.replace(
  `const [callError, setCallError] = useState<string | null>(null);`,
  `const [callError, setCallError] = useState<string | null>(null);\n  const [expandedId, setExpandedId] = useState<string | null>(null);`
);

// 2. Pass props to callable mapped items
code = code.replace(
  `{filter(callable).map((r, i) => (
            <QueueItem key={r.id} row={r} now={now}>`,
  `{filter(callable).map((r, i) => (
            <QueueItem key={r.id} row={r} now={now} doctor={doctor} expanded={expandedId === r.id} onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}>`
);

// 3. Replace QueueItem function completely
const queueItemRegex = /function QueueItem\(\{.*?\n\}/s;
const startIdx = code.indexOf('function QueueItem({');
if (startIdx === -1) {
  console.log('QueueItem not found');
  process.exit(1);
}

const newQueueItem = `function QueueItem({ row, now, muted = false, doctor, expanded = false, onToggle, children }: { row: QueueRow; now: number; muted?: boolean; doctor?: DoctorToday; expanded?: boolean; onToggle?: () => void; children: React.ReactNode }) {
  const waited = minutesSince(row.joined_at, now);
  return (
    <div className={\`flex flex-col p-3 rounded-xl overflow-hidden transition-colors \${muted ? 'bg-surface-container-low opacity-70' : 'bg-surface-container-low hover:bg-surface-container cursor-pointer'}\`} onClick={(e) => {
      if ((e.target as HTMLElement).closest('button, a')) return;
      if (!muted) onToggle?.();
    }}>
      <div className="flex items-center gap-3">
        <span className="font-headline-md text-headline-md text-primary w-14 shrink-0">#{row.token_number}</span>
        <div className="flex-1 min-w-0">
          <p className="font-label-lg text-label-lg text-on-surface truncate">
            {row.patient?.name ?? 'Patient'}
            {row.patient?.age ? <span className="text-on-surface-variant font-normal"> · {row.patient.age}y</span> : null}
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
            {[waited !== null ? \`joined \${waited}m ago\` : null, row.visit?.chief_complaint].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
      
      <div className={\`grid transition-all duration-300 \${expanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}\`}>
        <div className="overflow-hidden flex flex-col gap-3 text-on-surface-variant">
          <div className="h-px bg-surface-container-high w-full" />
          
          <div className="flex flex-col gap-1.5 px-1">
            <p className="font-body-md text-body-md text-on-surface">
              {[row.patient?.age ? \`\${row.patient.age} yrs\` : null, row.patient?.gender, row.patient ? \`+91 \${row.patient.mobile_number}\` : null].filter(Boolean).join(' · ')}
            </p>
            {row.visit?.chief_complaint && (
              <p className="font-body-sm text-body-sm mt-1">
                <span className="text-on-surface-variant">Reason: </span>
                <span className="text-on-surface font-medium">{row.visit.chief_complaint}</span>
              </p>
            )}
            
            {row.visit?.intake_answers && Object.keys(row.visit.intake_answers).length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                {Object.entries(row.visit.intake_answers).map(([key, val]) => {
                  const schema = doctor?.intake_schema?.find((s: any) => s.id === key);
                  const label = schema?.label || key;
                  const valueStr = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : Array.isArray(val) ? val.join(', ') : val;
                  return (
                    <p key={key} className="font-body-sm text-body-sm">
                      <span className="text-on-surface-variant">{label}: </span>
                      <span className="text-on-surface font-medium">{String(valueStr)}</span>
                    </p>
                  );
                })}
              </div>
            )}
            
            {row.visit?.vitals && Object.keys(row.visit.vitals).length > 0 && (
               <div className="mt-2 flex">
                 <VitalsChips vitals={row.visit.vitals} />
               </div>
            )}
            
            <div className="flex items-center justify-between gap-3 mt-3 pt-2">
              <PaidBadge row={row} />
              
              {row.visit && (
                <Link href={\`/doctor/consultation/\${row.visit.id}\`} className="font-label-md text-label-md text-primary flex items-center gap-1 hover:underline px-2 py-1 -mr-2">
                  Open full file <Icon name="arrow_forward" className="text-[16px]" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

const endIdx = code.indexOf('function ReceptionCallsNote() {');
if (endIdx === -1) {
  console.log('ReceptionCallsNote not found');
  process.exit(1);
}

code = code.substring(0, startIdx) + newQueueItem + '\n' + code.substring(endIdx);

fs.writeFileSync(file, code, 'utf8');
console.log('Patched correctly');
