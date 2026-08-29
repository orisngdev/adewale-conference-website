/**
 * The published facts about the 2026 Fellows programme.
 *
 * One module because these numbers appear on the landing page, inside the
 * application modal, and in both emails — three places that must never quote
 * different dates to the same applicant.
 *
 * TODO(asc-team): the four values marked PLACEHOLDER are not confirmed yet. The
 * page renders a softer line wherever one is unset, so it is safe to ship, but
 * the recruitment drive should not be publicised until they are real.
 */

/** Examination day. Confirmed. */
export const FELLOWS_EVENT_DATE = "Wednesday, 23 September 2026";
export const FELLOWS_EVENT_HOURS = "6:30am – 4:00pm";

/**
 * Roughly how many Fellows we need, always published as "about N".
 *
 * Approximate on purpose. The programme brief costed 45 across eight centres,
 * with the three smallest needing only three Fellows each; 2026 adds two more
 * small centres, so ~50 is the honest figure until allocation is finalised.
 * Replace with the exact number once centre-by-centre needs are set.
 */
export const FELLOWS_HEADCOUNT: number | null = 50;

/** PLACEHOLDER — shown on the page and in the closing CTA. */
export const FELLOWS_APPLICATIONS_CLOSE: string | null = null;

/** PLACEHOLDER — quoted in the confirmation screen and email. */
export const FELLOWS_SHORTLIST_BY: string | null = null;

/** PLACEHOLDER — the number applicants are told to save for the WhatsApp call. */
export const FELLOWS_WHATSAPP_NUMBER: string | null = null;

export const FELLOWS_CENTRE_COUNT = 10;
