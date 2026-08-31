# The Permit Closer — Lead Generator, Sales & Finances

Internal web app for The Permit Closer (a division of Majestic Permits LLC):
a lead generator with a tab per audience/goal (homeowners with expired
permits, plus realtor/broker, property manager, and title company referral
partners), each with its own letter template and lead tracking, sharing one
CRM pipeline — plus a sales dashboard and full income/expense finances.

## What's in this app

- **Lead Generator** (`/`) — one tab per audience:
  - **Homeowners** — the original expired-permit notice flow: escalating
    First / Second / Final notices addressed to the property owner, branded
    as The Permit Closer.
  - **Realtors & Brokers**, **Property Managers**, **Title Companies** —
    partnership/introduction letters positioning The Permit Closer as their
    go-to permit-resolution resource, with copy tailored to that audience's
    specific pain point (closings falling through, portfolio-wide
    compliance, clean-title risk).
  - **Contractors — Permit AIO** — pitches the Permit AIO software (permit
    + HOA tracking, automatic permit package assembly, reporting) to window,
    door, and roofing companies. **The domain (permitaio.com) is a
    placeholder** in `lib/partnerLetters.js` — send the real Permit AIO
    page/URL and this gets corrected, along with pulling in any copy from
    the actual site.
  - **Contractors — Majestic Permits** — pitches Majestic Permits' done-for-
    you permit expediting service to the same contractor audience. Domain
    (majesticpermits.com) is the real one, pulled from the existing site.

  The four partner/contractor tabs use a lighter-touch 3-step sequence
  (Introduction → Follow-up → Staying in Touch) instead of escalating
  urgency — appropriate for a referral/sales relationship, not a notice —
  and each is branded correctly (banner wordmark, sign-off, phone, and
  website all switch per tab; Permit AIO and Majestic Permits letters don't
  say "The Permit Closer").

  Every tab shares the same mechanics: manual entry, bulk CSV/Excel upload,
  or paste a table copied from a source appropriate to that audience (a
  building department portal for homeowners; a spreadsheet, CRM export, or
  directory listing for partners/contractors) — up to 100 rows, columns
  matched automatically regardless of how the source names them. Rows
  already in that audience's leads (by permit number or address) are
  flagged as duplicates and skipped. Imported leads can be saved for a
  later, controlled mailing batch ("Save Leads Only") or mailed
  immediately, with automatic follow-up flags once a lead crosses the
  configured number of days since its last touch. Switching tabs switches
  the whole leads list, stats, and letter template — each audience is a
  separate pipeline.

  **Email Template panel** — every tab also has an email version of its
  current touch (Introduction/Follow-up/Staying-in-touch), using Mailchimp
  merge tags (`*|FNAME|*` and the custom `*|ADDR|*`/`*|PERMIT|*`/`*|PTYPE|*`
  fields). This is **not a sending integration** — no email account or API
  key is wired up. The workflow: copy the template into a new Mailchimp
  campaign, then use **Export for Mailchimp (CSV)** on the Leads panel to
  download that tab's contacts (only rows with an email filled in) in a
  Mailchimp-importable format, import them into a Mailchimp audience, map
  the CSV columns to the merge fields (create the custom ones once under
  Audience → Settings → Merge fields), and send from Mailchimp.
- **Sales** (`/sales`) — leads (from any audience tab) you've converted into
  real jobs, job value, status (in progress / completed / lost), and a
  "Log Payment" action per job.
- **Finances** (`/finances`) — full income/expense ledger, plus an
  auto-calculated postage estimate across every letter sent from every tab
  (letters sent per month × your postage rate, which you can edit any time).

Follow-up reminders are **in-app only** (a "Follow-up Due" badge on the
Leads table) — no email or text is sent automatically.

## 1. Create the Supabase project

1. Go to supabase.com → **New project** → give it a name, set a database
   password (save it somewhere), pick a region near South Florida.
2. Once it's created: **SQL Editor** → **New query** → paste the entire
   contents of `supabase/schema.sql` from this project → **Run**.
3. **Project Settings** → **API** (sometimes labeled "Data API") → copy the
   **Project URL**.
4. **Project Settings** → **API Keys** → copy the `sb_publishable_...` key
   (or the older `anon` `public` key if that's what you see). **Never** use
   the `sb_secret_...` / `service_role` key in this app.
5. **Authentication** → **Users** → **Add user** → create one login
   (email + password) for yourself and each staff member who needs access.
   There's no public sign-up page by design.

## 2. Add the code to GitHub

1. Create a new GitHub repository (or reuse one you already have for this).
2. Upload every file from this project into it, keeping the exact same
   folder structure (`app/`, `lib/`, `supabase/`, etc.).
3. Commit.

## 3. Deploy on Vercel

1. Go to vercel.com → **New Project** → import the GitHub repo you just made.
2. Before deploying, add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL from step 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the publishable/anon key from step 1
   - (Settings → Environments → Production row → Environment Variables, if
     you're adding these after the first deploy instead of during setup.)
3. Deploy. If the build fails, check **Settings → Build and Deployment →
   Framework Preset** is set to **Next.js** — this is the most common fix.

## 4. Connect your domain (optional)

1. Vercel → **Settings** → **Domains** → add your domain.
2. Vercel will show you exact DNS records to add (usually an A record on
   `@` and a CNAME on `www`).
3. Add those at your domain registrar's DNS management page.
4. Wait for propagation (minutes to hours) — Vercel's Domains page shows a
   green "Valid Configuration" checkmark when it's ready.

## 5. Verify everything works

1. Visit your site — it should land on the login page.
2. Log in with a staff account from step 1.
3. On the **Homeowners** tab: add one test lead manually, print it, confirm
   the PDF looks right (address in the envelope window, QR code scans to
   thepermitcloser.com).
4. Switch to one of the partner tabs (e.g. **Realtors & Brokers**): add a
   test lead, print it, confirm the letter reads correctly for that audience.
5. Upload a small test spreadsheet (2-3 rows) on any tab, print the batch.
6. Convert a lead to a sale, log a payment against it.
7. Add one manual transaction on the Finances page.
8. Delete the test data once you've confirmed everything works.

## Notes

- **Pulling leads from a county portal is a paste/upload workflow, not live
  automation.** Palm Beach and Broward's permit search portals (and most
  others) require a manual search and don't publish owner-mailing data via
  a public API, and are typically login/CAPTCHA-gated — so an automated
  scraper would be fragile and likely violate the portal's terms of use.
  Instead: search the portal, select/copy the results, and either paste
  them straight into the Import panel or export to CSV/Excel first — the
  importer matches columns automatically no matter how the county names
  them. If a specific county ever publishes an open-data API with permit +
  owner-mailing info, that would be a legitimate case for a real connector.
- No public sign-up — accounts are only created via the Supabase dashboard.
- The postage rate defaults to $0.78/letter (2026 USPS First-Class rate) —
  editable any time on the Finances page.
- If a Vercel build fails, check the build logs first — it's almost always
  a missing environment variable, the wrong Framework Preset, or a typo in
  the Supabase URL/key.
- To make a future change to a page, you (or Claude) will hand you the
  *entire* updated file to replace the old one with on GitHub — not a diff
  to hand-edit. Delete the old file → Add file → Upload files → commit.
