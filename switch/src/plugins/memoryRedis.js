// Tiny in-memory shim implementing only the ioredis surface used by this app:
// set(key, val, [mode, ttl, ...flags]), get, del, incr, quit, on.
// Supports EX/PX TTL and NX (set-if-not-exists). Good enough for sandbox smoke
// tests; do NOT use in prod — no persistence, no cluster, no atomicity guards.
export function createMemoryRedis() {
  const store = new Map(); // key -> { val, expiresAt|null }
  const now = () => Date.now();
  const alive = (e) => e && (e.expiresAt == null || e.expiresAt > now());

  const parseOpts = (args) => {
    const o = { ttlMs: null, nx: false, keepttl: false };
    for (let i = 0; i < args.length; i++) {
      const a = String(args[i]).toUpperCase();
      if (a === "EX") { o.ttlMs = Number(args[++i]) * 1000; }
      else if (a === "PX") { o.ttlMs = Number(args[++i]); }
      else if (a === "NX") { o.nx = true; }
      else if (a === "KEEPTTL") { o.keepttl = true; }
    }
    return o;
  };

  return {
    async set(key, val, ...rest) {
      const o = parseOpts(rest);
      const cur = store.get(key);
      if (o.nx && alive(cur)) return null;
      let expiresAt = o.ttlMs ? now() + o.ttlMs : null;
      if (o.keepttl && alive(cur)) expiresAt = cur.expiresAt;
      store.set(key, { val, expiresAt });
      return "OK";
    },
    async get(key) {
      const e = store.get(key);
      if (!alive(e)) { store.delete(key); return null; }
      return e.val;
    },
    async del(key) { return store.delete(key) ? 1 : 0; },
    async incr(key) {
      const e = store.get(key);
      const n = (alive(e) ? Number(e.val) : 0) + 1;
      store.set(key, { val: String(n), expiresAt: alive(e) ? e.expiresAt : null });
      return n;
    },
    async quit() { store.clear(); return "OK"; },
    on() { /* no-op */ },
  };
}
