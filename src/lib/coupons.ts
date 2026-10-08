import type { Coupon } from '@/lib/adminApi';

/** Decision 36: "2 free months, then 40% off for 12 months". */
export function describeCoupon(c: Pick<Coupon, 'percent_off' | 'discount_months' | 'free_months'>) {
  return [
    c.free_months ? `${c.free_months} free month${c.free_months > 1 ? 's' : ''}` : null,
    c.percent_off ? `${c.percent_off}% off for ${c.discount_months} month${c.discount_months > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(', then ');
}
