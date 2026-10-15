/** Shared by the live token screen and its downloadable image (Decisions 19, 21, 46). */
export function tokenArrivalState(view: {
  status: string;
  front_desk: boolean;
  arrival_scan: boolean;
  is_future_booking: boolean;
}) {
  const verified = view.status === 'waiting_in_clinic' || view.status === 'checked_in_early';
  const noDesk = !view.front_desk;
  // A clinic's arrival QR is scanned on the visit day, not for a future booking.
  const arrivalScan = noDesk && view.arrival_scan && !view.is_future_booking;
  const arrived = verified || (noDesk && !arrivalScan);
  return { verified, noDesk, arrivalScan, arrived };
}
