/**
 * Every real-world identifier the four policy pages need, in one place.
 *
 * Keep these accurate. A policy that names the wrong legal person is
 * worse than no policy: it is unenforceable against customers and it
 * will fail Razorpay's merchant review, which cross-checks these
 * against the KYC record. Anything changed here — a new outlet city, a
 * changed support number — updates all four policy pages at once.
 *
 * Legal basis this set is sized against:
 *  - Digital Personal Data Protection Act 2023 (grievance officer and
 *    contact details are mandatory disclosures)
 *  - Consumer Protection (E-Commerce) Rules 2020, rule 5(3) — a seller
 *    must publish its legal name, principal geographic address, and
 *    customer-care contact
 *  - Information Technology (Intermediary Guidelines) Rules 2021, rule
 *    3(1)(b) — grievance officer name and contact published on the site
 */
export const BUSINESS = {
  /** Customer-facing brand. Safe as-is. */
  tradeName: 'Fresh N Petals',

  /**
   * The proprietor's full legal name. A sole proprietorship has no
   * separate legal personality — the proprietor is the contracting
   * party, so this name is what actually binds.
   */
  proprietorName: 'Ram Kishore',

  /**
   * Principal place of business including PIN code. Required verbatim by
   * CP(E-Commerce) Rules 2020 r.5(3)(b).
   */
  registeredAddress:
    'C-4, L.D.A Complex, Vivek Khand-2, Gomti Nagar, Lucknow, Uttar Pradesh 226010',

  supportEmail: 'ramk65726@gmail.com',

  supportPhone: '+91 79854 30389',

  /**
   * Verified: 15 characters, state code 09 (Uttar Pradesh), embedded PAN
   * IXEPK3008R whose 4th character `P` denotes an individual/proprietor
   * — consistent with the sole proprietorship above — and the check
   * digit computes to `V` as given.
   */
  gstin: '09IXEPK3008R1ZV' as string | null,

  /** Cities served. Fee and slots vary by city; see the shipping page. */
  serviceCities: ['Lucknow'],

  /** Courts with exclusive jurisdiction — the proprietor's home forum. */
  jurisdictionCity: 'Lucknow',
  jurisdictionState: 'Uttar Pradesh',

  /** Shop hours, matching `outlets.working_hours` and both Google
   *  Business Profiles. */
  supportHours: '8:00 AM – 10:00 PM, all days',

  /**
   * Delivery pricing, mirroring what checkout actually charges.
   *
   * "Mirroring" was aspirational: this said ₹5 per additional kilometre
   * while `system_settings.delivery_per_km_fee_inr` — the number
   * checkout actually bills — has been ₹10. A published delivery charge
   * that undercuts the one taken at the till is the kind of discrepancy
   * the Consumer Protection (E-Commerce) Rules exist about, so it is the
   * policy that was wrong, not the price.
   */
  deliveryBaseFee: 50,
  deliveryBaseKm: 5,
  deliveryPerKmFee: 10,
  /** An hour before the last slot (10 PM – 12 AM) opens. */
  sameDayCutoff: '9:00 PM',
  /** Surcharge on the late slot, and the hour it starts from. */
  nightChargeFee: 250,
  nightChargeAfterTime: '10:00 PM',
} as const;

/**
 * True once every TODO above has been replaced. The policy pages render
 * a visible warning banner while this is false, so a half-filled policy
 * can never quietly go live looking authoritative.
 */
export const BUSINESS_DETAILS_COMPLETE = ![
  BUSINESS.proprietorName,
  BUSINESS.registeredAddress,
  BUSINESS.supportEmail,
  BUSINESS.supportPhone,
].some((value) => value.startsWith('TODO_'));

/** "Fresh N Petals, a sole proprietorship of <name>" — used in clause 1. */
export const LEGAL_OPERATOR = `${BUSINESS.tradeName}, a sole proprietorship of ${BUSINESS.proprietorName}`;

/** Human list: "Lucknow", or "Lucknow and Kanpur", or "A, B and C". */
export function serviceCityList(): string {
  const cities = [...BUSINESS.serviceCities];
  if (cities.length === 1) return cities[0]!;
  const last = cities.pop()!;
  return `${cities.join(', ')} and ${last}`;
}
