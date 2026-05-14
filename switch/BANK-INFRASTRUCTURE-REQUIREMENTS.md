# Bank TEST Infrastructure Requirements — Lipafo Switch Pilot v1.0

This document specifies the server infrastructure the bank must provision on its TEST environment to run and validate the Lipafo Switch. It is intended for the bank's infrastructure / DevOps team.

---

## 1. Compute Profile

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| vCPU | 2 cores | 4 cores | Fastify is single-threaded; 1 core for Node, 1 for Redis. 4 cores recommended for concurrent QA scenarios. |
| RAM | 2 GB | 4 GB | Node process peaks at ~300 MB under load. Redis in-memory dataset is small (< 50 MB for pilot). |
| Disk | 10 GB | 20 GB | Container images + logs. SSD strongly recommended for Redis persistence if enabled later. |

Architecture: **x86_64 (amd64)**. The Docker image is built for `linux/amd64`.
ARM64 (Graviton, Apple Silicon) will require a local rebuild — contact Lipafo if your TEST fleet is ARM-only.

---

## 2. Operating System & Runtime

| Component | Requirement |
|-----------|-------------|
| OS | Ubuntu 22.04 LTS, RHEL 8+, or Debian 11+ |
| Kernel | Linux 5.4+ (cgroups v2 support preferred) |
| Docker Engine | 20.10.17 or newer |
| Docker Compose | v2.10.0 or newer (plugin format: `docker compose`, not `docker-compose`) |

No other runtime (Node.js, npm, PM2) needs to be installed on the host. Docker handles everything.

---

## 3. Network & Connectivity

### 3.1 Inbound (to the switch container)

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 3000 | TCP | Bank QA subnets | Switch API ingress (`/v1/intents`, `/healthz`, `/readyz`) |

The switch does **not** require a public IP. It should sit inside the bank's TEST DMZ or lab network, reachable only by the QA team and any internal test harnesses.

### 3.2 Outbound (from the switch container)

| Destination | Port | Protocol | Purpose |
|-------------|------|----------|---------|
| Bank sandbox gateway (KCB BUNI UAT) | 443 | HTTPS | OAuth2 token + payment initiation |
| Callback / webhook endpoint | 443 | HTTPS | Async transaction confirmation |
| Redis (same host via Docker bridge) | 6379 | TCP | Idempotency + circuit-breaker state |

Firewall rules must allow outbound HTTPS to the bank's sandbox domain and the callback URL.

### 3.3 DNS

- Internal DNS resolution for `redis` (Docker Compose network) — automatic.
- External DNS for `uat.buni.kcbgroup.com` and the callback domain — required.

---

## 4. Storage

No persistent volume is required for the pilot. Redis runs with `appendonly no` and `save ""` — purely in-memory.

If the bank wishes to retain logs across container restarts, mount a host directory:

```yaml
# Optional addition to docker-compose.yml
volumes:
  - /var/log/lipafo-switch:/app/logs
```

---

## 5. Security & Hardening

### 5.1 Container privileges
- The switch image runs as UID 1000 (`USER node` in Dockerfile). **Do not override to root.**
- No `privileged` mode required. No host PID or network namespace access required.

### 5.2 Secrets management
- Bank OAuth2 credentials (`BANK_CLIENT_ID`, `BANK_CLIENT_SECRET`) must be injected via `.env`, never baked into images.
- If the bank uses a secrets manager (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault), inject at runtime via environment variables.

### 5.3 mTLS (future phase)
This pilot drop uses OAuth2 Bearer tokens only. mTLS between switch and bank gateway is **not** enabled yet but will be required for production. No client certificates are needed for TEST.

---

## 6. Monitoring & Observability (optional but recommended)

| Signal | How to capture |
|--------|----------------|
| Container CPU / memory | `docker stats` or host-level Prometheus node-exporter |
| Application logs | `docker compose logs -f switch` — structured JSON, pipe to bank's log aggregator |
| Health probes | Poll `/healthz` (liveness) and `/readyz` (readiness) every 15s |
| Alerting | Alert if `/healthz` returns non-200 for > 60s |

No APM agent is embedded in the pilot image. Distributed trace IDs (`X-Lipafo-Trace-Id`) are propagated for manual correlation.

---

## 7. High-Availability (out of scope for pilot)

This drop is **single-node only**. Redis has no replication or persistence. Do not deploy behind a load balancer for this phase — the idempotency store is local to one Redis instance.

HA topology (Redis Sentinel, switch replicas, shared state) is scheduled for the UAT / production milestone.

---

## 8. Provisioning Checklist

Before the Lipafo integration team hands over the ZIP, the bank infra team should confirm:

- [ ] TEST server provisioned with 2 vCPU / 2 GB RAM minimum
- [ ] Docker Engine 20.10+ and Docker Compose v2+ installed
- [ ] Outbound HTTPS to `uat.buni.kcbgroup.com` allowed on firewall
- [ ] Outbound HTTPS to callback URL allowed on firewall
- [ ] Port 3000 open on bank QA subnet
- [ ] `.env` file created from template with bank-issued credentials
- [ ] Non-root container execution confirmed (no `--user root` overrides)

---

## 9. Quick Validation

Once provisioned, the bank infra team can validate readiness in under 60 seconds:

```bash
# 1. Unzip and enter directory
unzip lipafo-switch-bank-test-v1.zip && cd switch

# 2. Create env from template (edit with bank credentials)
cp .env.example .env

# 3. Start services
docker compose up -d

# 4. Verify health
curl -s http://localhost:3000/healthz | jq
curl -s http://localhost:3000/readyz | jq

# 5. Verify no root execution
docker exec lipafo-switch id   # expect uid=1000(node) gid=1000(node)
```

Expected result: both health endpoints return `{"ok":true}` and the container user is non-root.

---

## 10. Support Escalation

| Issue | Contact |
|-------|---------|
| Infrastructure provisioning | Bank DevOps / Infrastructure team |
| Docker or container runtime errors | Bank DevOps / Lipafo Integration Desk |
| API behaviour or test scenario failures | Lipafo Integration Desk (include `X-Lipafo-Trace-Id`) |
| Firewall or network connectivity | Bank Network Security team |

