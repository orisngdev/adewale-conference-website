# NYSC Fellows applications → Google Sheet

How an application submitted on `/fellows` ends up as a row in the team's
spreadsheet, and how to set that up from scratch.

We write through an **Apps Script web app bound to the sheet** rather than the
Sheets API. That keeps the whole Google side to one URL and one shared secret —
no cloud project, no service-account key to rotate, and the script opens from the
sheet itself, so whoever owns the recruitment drive can maintain it without going
through an engineer.

```
/fellows modal → POST /api/fellows → validate + score → Apps Script → row appended
                                                      → confirmation email to applicant
                                                      → notification email to the team
```

## 1. Create the sheet

Name it `ASC 2026 Fellows — Applications` and rename the first tab to
`Applications` — the script looks that tab up by name.

Paste this as row 1. The order matters: it is the order `FELLOW_SHEET_COLUMNS` in
`src/lib/fellows.ts` appends, and the two must match or values land under the
wrong headings.

```
Timestamp	Full name	Phone	Email	Gender	State code	Batch (derived)	PPA	PPA is a secondary school	LGA of PPA	Course of study	Commitment confirmed	Preferred centre	Accepts another centre	Roles	Invigilated before	Scenario 1	Scenario 2	Scenario score	Declaration	Status	Interview score	Assigned centre
```

The last three — **Status**, **Interview score**, **Assigned centre** — are yours.
Nothing ever writes to them; they are there for reviewing.

## 2. Open the script editor

In the sheet: **Extensions → Apps Script**. The project this opens is bound to
that spreadsheet, which is why the code below needs no sheet ID and no
credentials.

## 3. Store the shared secret

In the editor sidebar: **Project Settings** (the gear) → **Script properties** →
**Add script property**.

- Name: `SECRET`
- Value: a long random string (`openssl rand -hex 24` gives a good one)

Keeping it here rather than in the code means the secret is not sitting in the
script body for anyone with edit access on the sheet to read.

## 4. Paste the script

Delete the `myFunction` stub in `Code.gs` and paste this:

```js
const SHEET_NAME = 'Applications';

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(e.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || body.secret !== secret) return json({ ok: false, error: 'unauthorized' });
    if (!Array.isArray(body.row)) return json({ ok: false, error: 'bad payload' });

    // Prefer the named tab, but fall back to the first one. Renaming a tab is a
    // normal thing for someone to do to their own spreadsheet, and it should not
    // silently stop applications from being recorded. When there is genuinely
    // nothing to write to, report the tab names that do exist — otherwise this
    // failure gives no clue what it actually found.
    const spreadsheet = SpreadsheetApp.getActive();
    const sheets = spreadsheet.getSheets();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || sheets[0];
    if (!sheet) {
      const names = sheets.map(function (s) { return '"' + s.getName() + '"'; }).join(', ');
      return json({ ok: false, error: 'no sheet to write to; tabs found: ' + (names || 'none') });
    }

    // A WhatsApp broadcast produces bursts of applications; without the lock two
    // simultaneous appends can target the same row and one is lost.
    lock.waitLock(20000);
    sheet.appendRow(body.row);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
```

If the tab is not called `Applications` **and** it is not the first tab, the write
fails with `Cannot read properties of null (reading 'appendRow')`. Either rename
the tab or move it first.

Save.

## 5. Deploy it

**Deploy → New deployment →** the gear icon **→ Web app**.

| Field | Value |
|---|---|
| Description | `ASC Fellows intake` |
| Execute as | **Me** |
| Who has access | **Anyone** |

"Anyone" means anyone holding the URL. That is required — our server calls this
with no Google login — and it is exactly why the shared secret exists.

Click **Deploy**, then authorise: choose your account, click **Advanced**, then
**Go to … (unsafe)**, then **Allow**. That warning is Google's standard notice for
a script you wrote yourself that has not been through their review.

Copy the web app URL. It looks like
`https://script.google.com/macros/s/AKfy…/exec`.

## 6. Set the environment variables

In `.env` locally, and in the Netlify environment for the live site (see
`docs/environments-and-deploy.md`):

```
FELLOWS_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/AKfy…/exec
FELLOWS_SHEET_SECRET=<the same string you set as the SECRET script property>
```

If either is missing, `/api/fellows` returns 503 and tells the applicant
applications are not open — it never accepts an application it cannot store.

## Editing the script later

**Editing the code does not change what the live URL runs.** After any edit:

**Deploy → Manage deployments →** the pencil icon **→ Version: New version →
Deploy**

Editing the *existing* deployment that way keeps the same URL. Creating a
brand-new deployment issues a different URL, which means updating the env var in
both `.env` and Netlify.

## Rotating the secret

Change the `SECRET` script property and `FELLOWS_SHEET_SECRET` together, then
redeploy the site. Between the two changes every application is rejected, so do it
outside a recruitment push.

## Two Apps Script behaviours the code works around

Both are handled in `src/lib/fellows-sheet.ts`, and both will bite anyone
modifying it:

- **It answers with a 302** to `script.googleusercontent.com`. The fetch has to
  follow redirects; the JSON body arrives from the redirect target.
- **It returns HTTP 200 even when it fails.** `response.ok` is not a success
  signal. Success is `ok === true` in the parsed body — trusting the status code
  would tell an applicant they had succeeded while the row was rejected.

A non-JSON response (an HTML page) means the deployment is missing, not public, or
still demanding a Google login.

## Reviewing applications

Duplicates are expected and intentional: the form accepts every submission rather
than risk blocking a genuine applicant over a mistyped state code, and a failed
sheet write asks the applicant to send it again. **De-duplicate on State Code**
before shortlisting, keeping the most recent row.

Add a `COUNTIF` on the **Preferred centre** column to track applications per
centre. Ayetoro, Ilaro and Imeko are the hardest places to recruit — watch those
counts daily, not weekly.

**Scenario score** is out of 2, computed on our server from the two judgement
questions. Applicants never see it, and never see which answers were right.
