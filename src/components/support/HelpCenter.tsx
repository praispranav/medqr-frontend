'use client';

import { useState } from 'react';
import { FAQS, GUIDES } from './helpContent';

// "How to use" (steps per role) and FAQs. Shared by the public Contact page and the in-app Support page.

export function HelpCenter() {
  const [role, setRole] = useState<(typeof GUIDES)[number]['id']>('doctor');
  const guide = GUIDES.find((g) => g.id === role)!;

  return (
    <div className="flex flex-col gap-10">
      <section id="how-to-use" className="flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">How to use</h2>
        <div className="flex flex-wrap gap-2">
          {GUIDES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setRole(g.id)}
              className={`h-10 px-4 rounded-full font-label-md text-label-md ${role === g.id ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <ol className="flex flex-col gap-3">
          {guide.steps.map((step, i) => (
            <li key={i} className="flex gap-3 bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
              <span className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container font-label-lg text-label-lg flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="font-body-md text-body-md text-on-surface">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="faqs" className="flex flex-col gap-6">
        <h2 className="font-headline-md text-headline-md text-on-surface">Frequently asked questions</h2>
        {FAQS.map((group) => (
          <div key={group.title} className="flex flex-col gap-2">
            <h3 className="font-label-lg text-label-lg text-primary uppercase tracking-wider">{group.title}</h3>
            {group.items.map((item) => (
              <details key={item.q} className="group bg-surface-container-lowest rounded-2xl shadow-sm">
                <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3 font-label-lg text-label-lg text-on-surface">
                  {item.q}
                  <span aria-hidden className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
                </summary>
                <p className="px-4 pb-4 font-body-md text-body-md text-on-surface-variant">{item.a}</p>
              </details>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
