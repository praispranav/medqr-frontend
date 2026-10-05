import { HomeScreenBridge } from '@/components/patient/AddToHomeScreen';

// Every patient page: catches Chrome's install prompt early and, on the Home Screen app's first
// launch, redeems the hand-off code that carries the patient's saved check-ins over (iPhone).
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HomeScreenBridge />
      {children}
    </>
  );
}
