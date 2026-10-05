# Commonwealth dashboard integration

These changes keep the existing website and dashboard. They allow framing only from Commonwealth and the existing Majestic owner desk, and preserve verified owner/staff sign-in.

## Activation

1. Deploy this branch after review. Sign in directly and confirm normal roles, then test sign-in in an iframe from https://mpcommonwealth.site. Browser restrictions may require opening the original dashboard.
2. Run supabase/commonwealth-owner-access.sql against the Lead Generator database, after confirming the owner email list. Set ADMIN_EMAILS to the same verified staff emails. Anonymous access must be denied on leads, sales, transactions, and app_settings.
3. Set COMMONWEALTH_EMBED_CLOSER=enabled in Commonwealth only after those checks pass.

No dashboard is removed, and no business/financial records are merged. Stripe payments are integrated separately in Commonwealth Books.

## Required checks before production activation

- Signed-out iframe, embed query, forged desk headers/cookies, and unapproved users cannot access owner data or write endpoints.
- Verified owner can sign in and use the original website and the embedded dashboard.
- Refresh/sign-out work inside Commonwealth. Browser cookie restrictions show a direct-site fallback.

## Single login handoff

Configure server-only COMMONWEALTH_SSO_SECRET (same value as COMMONWEALTH_SSO_CLOSER in Commonwealth), and COMMONWEALTH_OWNER_USER_ID=8ae592ef-530d-46c3-97b6-5f569ae276f2. The account must already exist, have a verified email, and retain owner/staff authorization. SUPABASE_SERVICE_ROLE_KEY is required server-side. Codes expire after 60 seconds, are bound to the originating Commonwealth session and destination business, and are consumed once. The server mints a one-time Supabase login token for the existing authorized owner without sending email. Accounts with verified MFA factors use the original sign-in instead.
