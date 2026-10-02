const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/app/reception/page.tsx');
let content = fs.readFileSync(file, 'utf8');

// Patch the list item
content = content.replace(
  /<button\s+key=\{r\.id\}\s+onClick=\{[^}]+\}\s+className=\{`flex items-center gap-3 p-3 rounded-xl text-left transition-colors \$\{[^}]+\}`\}\s*>\s*<span className="font-headline-md text-headline-md text-primary w-14 shrink-0">#\{r\.token_number\}<\/span>\s*<span className="flex-1 min-w-0">\s*<span className="block font-label-lg text-label-lg text-on-surface truncate">\{r\.patient\?\.name \?\? 'Patient'\}<\/span>\s*<span className="block font-body-sm text-body-sm text-on-surface-variant truncate">\s*\{multiDoctor \? `\$\{r\.doctor\.name\} · ` : ''\}\s*\{r\.visit\?\.chief_complaint \|\| `joined \$\{minutesSince\(r\.joined_at\)\}m ago`\}\s*<\/span>\s*<\/span>\s*<span className="flex flex-col items-end gap-1 shrink-0">\s*<StatusPill status=\{r\.status\} \/>\s*<PaidBadge row=\{r\} showDue=\{owes\(r, tenant\)\} \/>\s*<\/span>\s*<\/button>/g,
  `
              <div
                key={r.id}
                className={\`flex items-center gap-3 p-3 rounded-xl transition-colors \${
                  r.id === selectedId
                    ? 'bg-primary-fixed/30 ring-2 ring-primary'
                    : r.status === 'done' || r.status === 'no_show'
                      ? 'bg-surface-container-low opacity-60'
                      : 'bg-surface-container-low hover:bg-surface-container'
                }\`}
              >
                <div
                  className="flex flex-1 min-w-0 cursor-pointer items-center gap-3"
                  onClick={() => {
                    setSelectedId(r.id);
                    setFlash(null);
                  }}
                >
                  <span className="font-headline-md text-headline-md text-primary w-14 shrink-0">#{r.token_number}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-label-lg text-label-lg text-on-surface truncate">{r.patient?.name ?? 'Patient'}</span>
                    <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">
                      {multiDoctor ? \`\${r.doctor.name} · \` : ''}
                      {r.visit?.chief_complaint || \`joined \${minutesSince(r.joined_at)}m ago\`}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 shrink-0">
                    <StatusPill status={r.status} />
                    <PaidBadge row={r} showDue={owes(r, tenant)} />
                  </span>
                </div>
                {['waiting_in_clinic', 'checked_in_early', 'booked'].includes(r.status) && (
                  <button
                    onClick={async () => {
                      if (r.status === 'booked' && tenant.queue_settings.front_desk_verifies_arrivals !== false) {
                        if (!confirm("This patient hasn't been confirmed as arrived — call anyway?")) return;
                      }
                      await api.callToken(r.id);
                      setFlash('called');
                    }}
                    title="Call now"
                    className="h-10 px-3 shrink-0 rounded-lg bg-surface-container-high text-primary font-label-md text-label-md flex items-center gap-1 hover:bg-surface-container-highest"
                  >
                    <Icon name="arrow_upward" className="text-[16px]" /> Call
                  </button>
                )}
              </div>`
);

fs.writeFileSync(file, content);
