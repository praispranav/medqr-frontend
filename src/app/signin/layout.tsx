import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in or list your clinic | ClinicQ',
  description: 'One sign-in for patients, doctors and clinics. List your clinic free on ClinicQ.',
  alternates: { canonical: '/signin' },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
