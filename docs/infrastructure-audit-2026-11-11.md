# Infrastructure audit, 2026-11-11

## Verified

- Existing database is reachable using READ ONLY transactions.
- All existing application tables and columns match the current Drizzle schema.
  The only missing column is the newly introduced wedding_config.site_presentation.
- Unique email indexes exist for rsvps and guest_list.
- DATABASE_URL, ADMIN_PASSWORD_HASH and JWT_SECRET are present locally.
  Bcrypt format and minimum secret length checks passed; values were not printed.
- 15 isolated RSVP production-handler regression tests passed. No real guest
  records were queried or written by those tests.
- Current public config contains Luis/Bee, February 27, 2027, 3 PM ceremony,
  6 PM reception, open RSVP mode, and TBA venue/location placeholders.
- Hero video and story/countdown/details background fields are configured.
  Remaining section background fields are empty.

## Outstanding deployment readiness

- Apply the reviewed additive site_presentation migration to the intended
  database, after authorization. It has only been prepared and read-checked.
- Local Cloudinary upload configuration is missing all four required variables.
  Existing image display and successful builds do not verify upload functionality.
- Confirm hosting environment, branch, and production environment variables
  separately. No push or deployment was performed by the infrastructure audit.
- Full application build/browser results belong to the integration validation,
  not these isolated server tests.

No database mutations, test RSVP submissions, upload credential changes or secret
values were included in the audit.
