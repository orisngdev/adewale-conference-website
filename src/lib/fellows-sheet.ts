import "server-only";

/**
 * Appends a Fellows application to the team's Google Sheet.
 *
 * The sheet is written through an Apps Script web app bound to the spreadsheet
 * (see `docs/fellows-sheet-setup.md`) rather than the Sheets API, which keeps the
 * whole Google side to one URL and one shared secret — no cloud project, no
 * service-account key to rotate, and the ops team can open the script from the
 * sheet itself.
 *
 * Two Apps Script behaviours shape this module:
 *  - the secret travels in the JSON body, because a web app cannot read custom
 *    request headers;
 *  - it answers 200 even when it rejects the request, so success is `ok === true`
 *    in the parsed body and never `response.ok`.
 */

const REQUEST_TIMEOUT_MS = 10_000;

function getWebhookUrl() {
  const url = process.env.FELLOWS_SHEET_WEBHOOK_URL;
  if (!url) {
    throw new Error("FELLOWS_SHEET_WEBHOOK_URL is not configured.");
  }
  return url;
}

function getSecret() {
  const secret = process.env.FELLOWS_SHEET_SECRET;
  if (!secret) {
    throw new Error("FELLOWS_SHEET_SECRET is not configured.");
  }
  return secret;
}

/** Whether the sheet can be written at all — lets a caller fail loudly at the
 *  top of a request instead of halfway through one. */
export function isFellowsSheetConfigured() {
  return Boolean(
    process.env.FELLOWS_SHEET_WEBHOOK_URL && process.env.FELLOWS_SHEET_SECRET,
  );
}

export async function appendFellowRow(row: string[]): Promise<void> {
  const response = await fetch(getWebhookUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: getSecret(), row }),
    // Apps Script answers with a 302 to script.googleusercontent.com; the default
    // redirect handling follows it, and the JSON body arrives from there.
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const raw = await response.text();

  let payload: { ok?: boolean; error?: string } | null = null;
  try {
    payload = JSON.parse(raw) as { ok?: boolean; error?: string };
  } catch {
    // A deployment that is missing, unauthorised, or still asking for a Google
    // login answers with an HTML page rather than JSON.
    throw new Error(
      `Sheet webhook returned a non-JSON response (HTTP ${response.status}). Check the Apps Script deployment is live and set to "Anyone".`,
    );
  }

  if (!payload?.ok) {
    const reason = payload?.error ?? "unknown error";

    // The single most common misconfiguration, and one whose message gives no
    // hint about the actual cause. Worth naming explicitly: it costs a round trip
    // through the logs otherwise.
    if (reason.includes("appendRow")) {
      throw new Error(
        `Sheet webhook rejected the row: ${reason}. The script could not find its tab — check the tab name matches SHEET_NAME, and remember a saved script only goes live after Deploy → Manage deployments → pencil → Version: New version → Deploy.`,
      );
    }

    throw new Error(`Sheet webhook rejected the row: ${reason}`);
  }
}
