# Smoke test — Lipafo Admin Console

`scripts/smoke-test.mjs` runs in CI (or locally with Node ≥ 20) against a
deployed admin + backend. It exits non-zero on any failure.

## What it checks

1. **SPA routes load** — `/`, `/auth`, `/admin` each return HTTP 200 with the
   SPA shell.
2. **Auth works** — signs in both a known admin and a non-admin identity.
3. **RLS / role gating** — confirms the non-admin sees **0 rows** on
   `participating_banks`, `lipafo_alias_registry`, `merchant_listing_revenue`,
   `settlement_instructions`; confirms the admin can read them.
4. **Switch endpoint** — `switch-process-intent` accepts a GAB→KCB cross-bank
   intent and returns `state: COMPLETED`.
5. **Masking proof** — the resulting `bank_payload_audit` row has
   `masking_applied=true`, `terminating_payload.payer_msisdn=null`, and a
   `payer_token` starting with `tok_`.
6. **Edge fns reachable** — `bank-simulator`, `switch-seed-demo`,
   `settlement-midnight-run` all respond.

## Required environment

| Var                 | Example                                              |
|---------------------|------------------------------------------------------|
| `ADMIN_URL`         | `https://admin-qa.example.com`                       |
| `SUPABASE_URL`      | `https://<project-ref>.supabase.co`                  |
| `SUPABASE_ANON_KEY` | publishable / anon key                               |
| `ADMIN_EMAIL`       | seeded admin (`user_roles.role='admin'`)             |
| `ADMIN_PASSWORD`    | …                                                    |
| `USER_EMAIL`        | seeded non-admin                                     |
| `USER_PASSWORD`     | …                                                    |

## Run

```bash
ADMIN_URL=https://admin-qa.example.com \
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_ANON_KEY=ey... \
ADMIN_EMAIL=qa-admin@example.com   ADMIN_PASSWORD='...' \
USER_EMAIL=qa-user@example.com     USER_PASSWORD='...' \
npm run smoke
```

## CI

Wire as a post-deploy job. Suggested gate: fail the pipeline if smoke fails
twice in a row, but allow a single retry for cold-start latency on the
`switch-process-intent` function.
