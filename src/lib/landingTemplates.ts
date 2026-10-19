// Decision 71 — the looks a clinic can pick for its public page. Add a look = one entry here + its component in
// components/landing + the key in backend LANDING_TEMPLATES (tenant.entity.ts). All looks stay GREEN (Decision 50).
export const LANDING_TEMPLATES = [
  { key: 'editorial', name: 'Editorial', hint: 'Calm, paper-toned, serif headlines', bg: '#FBFAF7', bar: '#1E293B', tile: '#F4F1EA', accent: '#0F766E', round: 'rounded-lg' },
  { key: 'playful', name: 'Playful', hint: 'Bright, rounded, friendly tiles', bg: '#F4FBF6', bar: '#0F766E', tile: '#DCFCE7', accent: '#0F766E', round: 'rounded-2xl' },
  { key: 'classic', name: 'Classic', hint: 'Clean white, one simple column, easy to read', bg: '#FFFFFF', bar: '#166534', tile: '#F3F4F6', accent: '#166534', round: 'rounded-md' },
  { key: 'bold', name: 'Bold', hint: 'Deep green header, big buttons, phone-first', bg: '#ECFDF5', bar: '#064E3B', tile: '#FFFFFF', accent: '#047857', round: 'rounded-xl' },
] as const;

export type LandingTemplateKey = (typeof LANDING_TEMPLATES)[number]['key'];
