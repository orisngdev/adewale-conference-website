/**
 * Result of a bulk centre-allocation save.
 *
 * The rest of the admin reports with a `?notice=` redirect, which cannot work
 * here: the centres screen holds its active view in client state, so a redirect
 * would bounce the admin back to the first view and take the message with it.
 * useActionState keeps the answer next to the button that caused it.
 *
 * The answer is a row count, not the word "saved". Pressing Save on this screen
 * is most often a confirmation of choices already displayed, so a no-op is the
 * normal outcome and has to be visibly distinct from work having been done.
 */
export type CentreSaveState = { ok: boolean; message: string } | null;
