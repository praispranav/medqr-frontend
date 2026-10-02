const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/clinic/QueueRules.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<Section title="Patient check-in" subtitle="Controls for when patients join via the public link or QR code.">/,
  `<Section title="Arrival & Queue Order" subtitle="How patients enter the waiting list at the clinic.">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="font-label-lg text-label-lg text-on-surface">Front desk verifies arrivals</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              When ON (default), patients who book online must check in with reception before the doctor can call them. When OFF, online bookings go straight to the active queue.
            </p>
          </div>
          <Toggle checked={s.front_desk_verifies_arrivals !== false} onChange={(v) => set('front_desk_verifies_arrivals', v)} />
        </label>
      </Section>

      <Section title="Patient check-in" subtitle="Controls for when patients join via the public link or QR code.">`
);

fs.writeFileSync(file, content);
