// Plain-language help for the Contact page and the in-app Support page. Keep answers short and true
// to what the app does today — if a screen changes, change the answer here.

export interface Guide {
  id: 'doctor' | 'reception' | 'patient' | 'admin';
  label: string;
  steps: string[];
}

export const GUIDES: Guide[] = [
  {
    id: 'doctor',
    label: 'Doctor',
    steps: [
      'Log in at /login with your clinic code, username and password. On the first login you set your own password.',
      'Open My Queue and tap Start shift when you begin. Nobody can be called until your shift is live. (If your clinic uses automatic hours, your shift starts by itself.)',
      'Tap Call next (or press Enter) to call the next patient. Use Call now on any row to jump a patient ahead.',
      'Open the patient to type one free-text note. You can attach photos of prescriptions or reports.',
      'Need a break? Choose Take a break: now, after this patient, or after the next one. Tap End break when you are back.',
      'Running late? Tap Delay shift 30 mins. Patients see the new time on their phones.',
      'Set your hours in My Hours, and print your QR from QR Standee.',
    ],
  },
  {
    id: 'reception',
    label: 'Reception',
    steps: [
      'Log in at /login with the clinic code and your reception username.',
      'When a patient arrives, tap Scan QR and point the camera at the QR on their phone. Or type their token number, phone or name.',
      'Verified patients move into the waiting queue. Tokens not yet verified stay as Not arrived.',
      'Use Add walk-in to give a token to someone without a phone.',
      'If your clinic lets reception call patients, use Call next for the doctor, or Call on a row.',
      'Mark payments as Paid · Cash or Paid · UPI at counter. Show UPI QR lets the patient pay from their own phone.',
      'To fix a name or number, edit the patient. To send a waiting patient to another doctor, move them.',
    ],
  },
  {
    id: 'patient',
    label: 'Patient',
    steps: [
      'Scan the QR at the clinic with your phone camera. No app is needed.',
      'Choose the doctor (if the clinic has more than one), then type your name and mobile number. Everything else is optional.',
      'You get a token. Keep the page open: it updates by itself and shows how many patients are ahead.',
      'Show the token QR at reception when you arrive, or scan the arrival QR if the clinic has no front desk.',
      'Tap Alert me when it\'s my turn to get a free notification on your phone.',
      'When you are called, the page says It\'s your turn and shows the cabin.',
      'Pay by UPI from the Pay page, or pay at the counter.',
    ],
  },
  {
    id: 'admin',
    label: 'Clinic admin',
    steps: [
      'Log in and open Clinic admin (or Manage) from the menu.',
      'Today shows every doctor live: seen, waiting and money collected.',
      'Doctors & Staff: add doctors, set their hours, and create logins for reception. Each login gets a one-time setup link to share with that person.',
      'Queue Rules: choose who calls the next patient, how late arrivals are handled, and how fees are collected.',
      'Money: see cash and UPI per doctor, the cash handover per staff member, and download a CSV.',
      'Billing & Add-ons: see your plan, set up autopay and top up the WhatsApp wallet.',
    ],
  },
];

export interface FaqGroup {
  title: string;
  items: { q: string; a: string }[];
}

export const FAQS: FaqGroup[] = [
  {
    title: 'Getting started',
    items: [
      { q: 'What is this product?', a: 'It is a digital token queue for clinics. Patients scan a QR code, get a token on their phone and follow their turn live. Reception and the doctor run the queue from one screen.' },
      { q: 'Do patients need to install an app?', a: 'No. The QR opens a page in the phone browser. Only a name and mobile number are needed; everything else is optional.' },
      { q: 'How do I get my QR poster?', a: 'Doctors open QR Standee in the menu and download it as a PDF or PNG. Clinic admins find QR Standees under Manage. You can print an A5 standee, a table tent card, or a black-and-white copy.' },
      { q: 'How do I start the free trial?', a: 'Use the Start free trial form on the home page, or the Contact form below. We set up your clinic, your doctors and your logins, and send you the login details.' },
      { q: 'I forgot my password. What do I do?', a: 'Ask your clinic admin (or us) to reset it. They will share a new setup link with you, and the old password stops working straight away.' },
    ],
  },
  {
    title: 'Queue and calling',
    items: [
      { q: 'Why can I not call a patient?', a: 'Calling only works while the doctor\'s shift is live. The doctor taps Start shift (or the clinic uses automatic hours). If the shift is on a break, end the break first.' },
      { q: 'What is the difference between Call next and Call now?', a: 'Call next calls the next patient in order. Call now on a row calls that patient straight away, even if others are ahead.' },
      { q: 'Who can call the next patient?', a: 'Your clinic chooses in Queue Rules: the doctor, reception, or both.' },
      { q: 'A patient has not arrived yet. What happens to their token?', a: 'It stays as Not arrived and is skipped when you call next. It is not marked a no-show. When the patient arrives and is verified, they are placed in the queue by the clinic\'s late-arrival rule (by default, after the next 5 waiting patients).' },
      { q: 'Can a patient join before the doctor starts?', a: 'Yes. They get an early token number, and the page shows the doctor has not started yet.' },
      { q: 'What happens to tokens at the end of the day?', a: 'A token is valid only on its day. Anything left over expires at the end of the day, so tomorrow starts clean.' },
      { q: 'How do I remove a patient or send them to another doctor?', a: 'Reception or the doctor can remove a patient who has not been called yet. Reception can also move a waiting patient to another doctor; they go to the end of that doctor\'s queue.' },
    ],
  },
  {
    title: 'Payments',
    items: [
      { q: 'How do patients pay?', a: 'On their own phone they choose Pay online (UPI) or Pay at the counter. Reception can also mark a visit paid by cash or UPI at the counter.' },
      { q: 'Can I undo a payment I marked by mistake?', a: 'Yes, but you must give a reason. Every payment action is recorded with who did it and when.' },
      { q: 'What if a patient pays twice?', a: 'The duplicate is flagged in the payment log so it can be refunded. Refunds are done manually from the payment gateway dashboard.' },
      { q: 'The online payment QR expired.', a: 'The patient can start online payment again, or simply pay at the counter. A payment problem never stops a patient from being seen.' },
      { q: 'Where do I see the day\'s money?', a: 'Doctors: Payments in the menu. Reception: Payments. Clinic admins: Money under Manage, with a CSV download.' },
    ],
  },
  {
    title: 'Notifications and WhatsApp',
    items: [
      { q: 'How are patients told it is their turn?', a: 'The token page updates live. Patients can also tap Alert me when it\'s my turn for a free push notification. WhatsApp messages are optional.' },
      { q: 'Does WhatsApp cost anything?', a: 'WhatsApp messages are charged per message from your prepaid wallet. You can top it up under Billing & Add-ons. Push notifications are free.' },
      { q: 'Patients say they did not get a WhatsApp message.', a: 'Check that the wallet has a balance, that the patient ticked the WhatsApp option, and that the mobile number is correct.' },
    ],
  },
  {
    title: 'Billing and account',
    items: [
      { q: 'How does the free trial work?', a: 'Your clinic starts on a free trial. Before it ends, set up autopay on the Billing page to continue without a gap.' },
      { q: 'What happens if a payment is missed?', a: 'You get a grace period with full access. If it ends unpaid, the clinic becomes read-only: you can view everything but cannot make changes until it is paid. You can still contact support from this page.' },
      { q: 'How do I add another doctor?', a: 'A clinic admin opens Doctors & Staff and adds the doctor, their hours and a login. Each extra doctor is added to the monthly bill.' },
      { q: 'How do I ask for a new module or setting?', a: 'Open Billing & Add-ons and tap Request this module, or raise a request from the Support page.' },
    ],
  },
  {
    title: 'Something is not working',
    items: [
      { q: 'The QR says "not set up yet" or "inactive".', a: 'That standee is not linked to a doctor or clinic yet, or it was switched off. Ask your clinic admin to link it, or contact us.' },
      { q: 'A patient\'s token page says it has expired.', a: 'Tokens only last for their day. Add the patient as a walk-in for a new token.' },
      { q: 'The camera will not scan.', a: 'Allow camera access for the site in your browser settings. Meanwhile, type the token number, phone or name instead.' },
      { q: 'The page looks stuck or out of date.', a: 'Reload the page. The live queue reconnects by itself, and if it keeps happening please send us a request with what you saw.' },
    ],
  },
];
