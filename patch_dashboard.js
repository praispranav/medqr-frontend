const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/app/doctor/dashboard/page.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\{filter\(notArrived\)\.length > 0 && \(\s*<p className="font-label-sm text-label-sm text-on-surface-variant uppercase mt-3">Booked · not arrived yet<\/p>\s*\)\}\s*\{filter\(notArrived\)\.map\(\(r\) => \(\s*<QueueItem key=\{r\.id\} row=\{r\} now=\{now\} muted>\s*<StatusPill status=\{r\.status\} \/>\s*<\/QueueItem>\s*\)\)\}/,
  `{tenant.queue_settings.front_desk_verifies_arrivals !== false && filter(notArrived).length > 0 && (
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mt-3">Booked · not arrived yet</p>
          )}
          {tenant.queue_settings.front_desk_verifies_arrivals !== false && filter(notArrived).map((r) => (
            <QueueItem key={r.id} row={r} now={now} muted>
              <div className="flex items-center gap-3">
                <StatusPill status={r.status} />
                <button
                  disabled={busy || !live || breakDue}
                  onClick={() => {
                    if (confirm("This patient hasn't been confirmed as arrived — call anyway?")) {
                      run(() => api.callToken(r.id));
                    }
                  }}
                  title="Override — call this patient now"
                  className="h-9 px-3 rounded-lg bg-surface-container text-primary font-label-md text-label-md flex items-center gap-1 hover:bg-surface-container-high disabled:opacity-60"
                >
                  <Icon name="arrow_upward" className="text-[16px]" /> Call now
                </button>
              </div>
            </QueueItem>
          ))}`
);

// We need to also update the `callable` logic if `front_desk_verifies_arrivals === false`, we merge booked into callable.
// Wait, if it is false, `notArrived` bucket is hidden, but the rows need to appear somewhere! They should be in `callable`.
content = content.replace(
  /const callable = useMemo\(\(\) => \(rows \?\? \[\]\)\.filter\(\(r\) => CALLABLE\.has\(r\.status\)\), \[rows\]\);/,
  `const callable = useMemo(() => {
    if (tenant.queue_settings.front_desk_verifies_arrivals === false) {
      return (rows ?? []).filter((r) => CALLABLE.has(r.status) || r.status === 'booked');
    }
    return (rows ?? []).filter((r) => CALLABLE.has(r.status));
  }, [rows, tenant.queue_settings.front_desk_verifies_arrivals]);`
);

fs.writeFileSync(file, content);
