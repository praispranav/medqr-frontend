const fs = require('fs');
const file = 'src/app/doctor/dashboard/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `{filter(notArrived).map((r) => (
            <QueueItem key={r.id} row={r} now={now} muted>`,
  `{filter(notArrived).map((r) => (
            <QueueItem key={r.id} row={r} now={now} muted doctor={doctor} expanded={expandedId === r.id} onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}>`
);

code = code.replace(
  `{filter(finished).map((r) => (
            <QueueItem key={r.id} row={r} now={now} muted>`,
  `{filter(finished).map((r) => (
            <QueueItem key={r.id} row={r} now={now} muted doctor={doctor} expanded={expandedId === r.id} onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}>`
);

fs.writeFileSync(file, code, 'utf8');
