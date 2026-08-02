/**
 * Every real-world identifier the four policy pages need, in one place.
 *
 * ⚠️ THE FIVE VALUES MARKED `TODO` MUST BE FILLED IN BEFORE LAUNCH.
 * A policy that names the wrong legal person is worse than no policy:
 * it is unenforceable against customers and it will fail Razorpay's
 * merchant review, which cross-checks these against your KYC record.
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
  tradeName: 'Fresh & Petals',

  /**
   * TODO: the proprietor's full legal name as it appears on PAN/Aadhaar.
   * A sole proprietorship has no separate legal personality — the
   * proprietor is the contracting party, so this name is what actually
   * binds. Example shape: 'Ram Kishore Verma'.
   */
  proprietorName: 'TODO_PROPRIETOR_FULL_LEGAL_NAME',

  /**
   * TODO: full principal place of business including PIN code. Required
   * verbatim by CP(E-Commerce) Rules 2020 r.5(3)(b). Example shape:
   * 'Shop 4, Hazratganj, Lucknow, Uttar Pradesh 226001'.
   */
  registeredAddress: 'TODO_FULL_BUSINESS_ADDRESS_WITH_PIN',

  /** TODO: monitored support inbox, e.g. 'hello@freshnpetals.in'. */
  supportEmail: 'TODO_SUPPORT_EMAIL',

  /** TODO: support phone in +91 XXXXX XXXXX form. */
  supportPhone: 'TODO_SUPPORT_PHONE',

  /**
   * TODO: GSTIN if registered, or null. Set to null and the pages simply
   * omit every GST sentence rather than printing a blank — below the
   * ₹40 lakh threshold there is nothing to disclose and claiming a
   * registration you don't hold is its own problem.
   */
  gstin: null as string | null,

  /** Cities served. Fee and slots vary by city; see the shipping page. */
  serviceCities: ['Lucknow'],

  /** Courts with exclusive jurisdiction — the proprietor's home forum. */
  jurisdictionCity: 'Lucknow',
  jurisdictionState: 'Uttar Pradesh',

  /** Support hours, as published on the old contact page. */
  supportHours: '9:00 AM – 8:00 PM, all days',

  /** Delivery pricing, mirroring what checkout actually charges. */
  deliveryBaseFee: 50,
  deliveryBaseKm: 5,
  deliveryPerKmFee: 5,
  sameDayCutoff: '6:00 PM',
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

/** "Fresh & Petals, a sole proprietorship of <name>" — used in clause 1. */
export const LEGAL_OPERATOR = `${BUSINESS.tradeName}, a sole proprietorship of ${BUSINESS.proprietorName}`;

/** Human list: "Lucknow", or "Lucknow and Kanpur", or "A, B and C". */
export function serviceCityList(): string {
  const cities = [...BUSINESS.serviceCities];
  if (cities.length === 1) return cities[0]!;
  const last = cities.pop()!;
  return `${cities.join(', ')} and ${last}`;
}
