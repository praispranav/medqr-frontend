const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/app/reception/page.tsx');
let content = fs.readFileSync(file, 'utf8');

// Insert the download function at the end of the file
const downloadFn = `
function downloadTodayPatientsCsv(rows: QueueRow[]) {
  const cell = (v: unknown) => \`"\${String(v ?? '').replace(/"/g, '""')}"\`;
  const header = ['Token', 'Patient', 'Doctor', 'Age', 'Gender', 'Mobile', 'Status', 'Reason for visit', 'Joined at', 'Called at'];
  const lines = [
    header.map(cell).join(','),
    ...[...rows]
      .sort((a, b) => a.token_number - b.token_number)
      .map((r) =>
        [
          r.token_number,
          r.patient?.name ?? '',
          r.doctor?.name ?? '',
          r.patient?.age ?? '',
          r.patient?.gender ?? '',
          r.patient?.mobile_number ?? '',
          r.status,
          r.visit?.chief_complaint ?? '',
          new Date(r.joined_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
          r.called_at ? new Date(r.called_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '',
        ]
          .map(cell)
          .join(','),
      ),
  ];
  const csv = lines.join('\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = \`Reception_Patients_\${new Date().toISOString().slice(0, 10)}.csv\`;
  a.click();
  URL.revokeObjectURL(url);
}
`;

if (!content.includes('downloadTodayPatientsCsv')) {
  content += downloadFn;
}

// Add the button
content = content.replace(
  /\{unpaidOnly && visible\.length === 0 && rows && rows\.length > 0 && \(\s*<p className="font-body-md text-body-md text-on-surface-variant py-6 text-center">Everyone who owes a fee has paid. 🎉<\/p>\s*\)\}\s*<\/div>\s*<button\s*onClick=\{[^}]+\}\s*className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 mt-auto"\s*>\s*<Icon name="add" className="text-\[22px\]" \/>\s*Walk-in \/ manual entry\s*<\/button>\s*<\/div>\s*<\/section>/,
  `{unpaidOnly && visible.length === 0 && rows && rows.length > 0 && (
              <p className="font-body-md text-body-md text-on-surface-variant py-6 text-center">Everyone who owes a fee has paid. 🎉</p>
            )}
          </div>
          <div className="flex gap-2 mt-auto">
            <button
              onClick={() => downloadTodayPatientsCsv(visible)}
              className="h-12 w-12 rounded-xl bg-surface-container-high text-primary flex items-center justify-center hover:bg-surface-container-highest shrink-0"
              title="Download visible rows to CSV"
            >
              <Icon name="download" className="text-[20px]" />
            </button>
            <button
              onClick={() => setWalkInOpen(true)}
              className="h-12 flex-1 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2"
            >
              <Icon name="add" className="text-[22px]" />
              Walk-in / manual entry
            </button>
          </div>
        </div>
      </section>`
);

fs.writeFileSync(file, content);
