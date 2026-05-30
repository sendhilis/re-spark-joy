# Lipafo Switch — Security Evidence Sheet (Pilot v1.0)

One-pager the Bank Security Officer signs off as part of Section C of
`BANK-QA-ACCEPTANCE.md`. Each row maps 1:1 to an S-criterion and lists
**the exact command to run** plus **what a passing output looks like**.
Attach the captured terminal output (or screenshot) under each row.

> Environment: bank TEST server, drop `lipafo-switch-bank-test-v1.zip`,
> container name `switch` (default from `docker-compose.yml`),
> Redis container name `redis`. Replace if your stack renames them.

---

## Header

| Field | Value |
|---|---|
| Drop / build SHA |  |
| Date (UTC) |  |
| Tested by |  |
| Bank Security Officer |  |
| Host / OS |  |
| `docker --version` |  |

---

## S1 — No bank credentials in source or image

**Command (source tree):**
```bash
unzip -q lipafo-switch-bank-test-v1.zip -d /tmp/lipafo-src
grep -RInE 'CLIENT_SECRET|CLIENT_ID|Bearer [A-Za-z0-9._-]{20,}|BANK_CLIENT' \
  /tmp/lipafo-src --exclude='*.env.example' --exclude-dir=node_modules
```

**Command (built image):**
```bash
docker image save lipafo-switch:latest | tar -xO | \
  grep -aE 'CLIENT_SECRET=|BANK_CLIENT_SECRET=' | head
```

**Pass = no matches** other than the placeholder strings in `.env.example`.

Captured output:
```
<paste here>
```
Result: ☐ PASS ☐ FAIL — Note: ____________________________

---

## S2 — Credentials only sourced from `.env` at runtime

**Command:**
```bash
docker inspect switch --format '{{json .Config.Env}}' | jq .
docker inspect switch --format '{{json .Config.Labels}}' | jq .
```

**Pass =** `BANK_CLIENT_ID` / `BANK_CLIENT_SECRET` appear in the runtime env
(injected via `env_file: .env`), and `docker history lipafo-switch:latest --no-trunc`
shows **no** `ENV BANK_CLIENT_SECRET=` layer.

**Also run:**
```bash
docker history lipafo-switch:latest --no-trunc | grep -iE 'CLIENT_SECRET|CLIENT_ID' || echo "OK: not baked into image"
ls -l /path/to/.env    # file should be 0600 root:root on the host
```

Captured output:
```
<paste here>
```
Result: ☐ PASS ☐ FAIL — Note: ____________________________

---

## S3 — OAuth2 Bearer token never logged

**Command:**
```bash
docker compose logs --no-color switch > /tmp/switch.log
grep -cE 'Bearer [A-Za-z0-9._-]{10,}' /tmp/switch.log
grep -cE '"authorization"' /tmp/switch.log
grep -cE 'access_token' /tmp/switch.log
```

**Pass = all three counts are `0`.** If non-zero, paste the offending lines
(redacted) and file a defect.

Captured output:
```
<paste here>
```
Result: ☐ PASS ☐ FAIL — Note: ____________________________

---

## S4 — Container runs as non-root

**Command:**
```bash
docker exec switch id
docker exec switch sh -c 'echo PID1=$(cat /proc/1/status | grep -E "^Uid:")'
```

**Pass =** `uid=` value is **not 0** (the provided `Dockerfile` runs as the
`node` user, expect `uid=1000(node)`).

Captured output:
```
<paste here>
```
Result: ☐ PASS ☐ FAIL — Note: ____________________________

---

## S5 — Outbound traffic restricted to BANK_BASE_URL + callback URL

**Command (passive — 60s capture during a test run):**
```bash
# host-side; replace eth0 with the bank host's egress NIC
sudo timeout 60 tcpdump -nn -i eth0 'tcp and (port 443 or port 80) and host not 127.0.0.1' \
  -w /tmp/lipafo-egress.pcap
sudo tcpdump -nn -r /tmp/lipafo-egress.pcap | \
  awk '{print $3}' | cut -d. -f1-4 | sort -u
```

**Command (active — DNS that the container actually resolved):**
```bash
docker exec switch sh -c 'cat /proc/net/tcp | awk "{print \$3}" | sort -u'
docker exec switch getent hosts $(echo "$BANK_BASE_URL" | awk -F/ '{print $3}')
```

**Pass =** every destination IP resolves to either:
- the host behind `BANK_BASE_URL` (KCB BUNI sandbox), or
- the host behind `LIPAFO_CALLBACK_URL` (webhook.site or bank-hosted).

Captured output:
```
<paste here>
```
Result: ☐ PASS ☐ FAIL — Note: ____________________________

---

## Summary

| ID | Criterion | Result |
|---|---|---|
| S1 | No credentials in source/image | ☐ PASS ☐ FAIL |
| S2 | Credentials only from `.env` at runtime | ☐ PASS ☐ FAIL |
| S3 | OAuth2 token never logged | ☐ PASS ☐ FAIL |
| S4 | Container runs as non-root | ☐ PASS ☐ FAIL |
| S5 | Outbound restricted to bank + callback | ☐ PASS ☐ FAIL |

**Overall Section C verdict:** ☐ ACCEPTED ☐ REJECTED

---

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Bank Security Officer |  |  |  |
| Bank QA Lead |  |  |  |
| Lipafo Integration Lead |  |  |  |
