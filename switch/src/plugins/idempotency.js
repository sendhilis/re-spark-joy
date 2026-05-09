import fp from "fastify-plugin";
import { config } from "../config.js";

// Idempotency strategy:
//   1. SET NX key=lipafo:idem:<key> value=<traceId> EX=TTL
//   2. If NX fails → an entry exists. GET the cached response and replay.
//   3. After processing, write the final response JSON under the same key (KEEPTTL).
//
// This avoids the classic "double charge on retry" failure mode, and keeps the
// hot path to a single Redis round-trip when the key is new.
async function idempotencyPlugin(app) {
  const ns = "lipafo:idem:";

  app.decorate("idempotency", {
    /** @returns {Promise<{firstSeen: boolean, cached?: any}>} */
    async claim(key, traceId) {
      const ok = await app.redis.set(
        ns + key,
        JSON.stringify({ status: "in_flight", trace_id: traceId, at: Date.now() }),
        "EX", config.idempotencyTtlSeconds, "NX",
      );
      if (ok === "OK") return { firstSeen: true };
      const raw = await app.redis.get(ns + key);
      return { firstSeen: false, cached: raw ? JSON.parse(raw) : null };
    },

    async commit(key, response) {
      // Persist final response so future replays return the same body.
      await app.redis.set(
        ns + key,
        JSON.stringify({ status: "complete", response, at: Date.now() }),
        "KEEPTTL",
      );
    },

    async release(key) {
      // On hard failure we may want to allow client retry; delete the marker.
      await app.redis.del(ns + key);
    },
  });
}

export default fp(idempotencyPlugin, { name: "idempotency", dependencies: ["redis"] });
