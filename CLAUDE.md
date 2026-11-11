# Wedding site: repo rules

## Hard rules

- **Never run `vercel env pull`** (any form, any flags, any target file). It overwrites
  local env files such as `.env.local` and writes production/preview secrets to disk.
  Edit `.env.local` by hand, or ask the user to run it themselves. Do not work around
  this with `vercel env` variants that write secrets to a file.
- Never print, copy or log values from `.env.local` (DB URL, JWT secret, admin hash, Cloudinary keys).
- Do not apply migrations to, seed, or `db:push` against the live database without explicit authorization.
- Never push unless a full `npm run build` has been observed to succeed.
- Commits: conventional commits, no Co-Authored-By attribution.
