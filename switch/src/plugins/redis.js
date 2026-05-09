import fp from "fastify-plugin";
import { config } from "../config.js";
import { createMemoryRedis } from "./memoryRedis.js";

// Decorates `app.redis` with a shared client.
// REDIS_URL=memory:// (or empty) → in-memory shim for sandbox/smoke tests.
// Anything else → real ioredis. We import ioredis lazily so the sandbox can
// boot the service without the native binary being resolvable.
async function redisPlugin(app) {
  const url = config.redisUrl ?? "";
  let client;
  if (!url || url.startsWith("memory:")) {
    app.log.warn("Using in-memory Redis shim (sandbox mode — not for prod)");
    client = createMemoryRedis();
  } else {
    const { default: Redis } = await import("ioredis");
    client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableAutoPipelining: true,
      lazyConnect: false,
    });
    client.on("error", (err) => app.log.error({ err }, "redis error"));
  }
  app.decorate("redis", client);
  app.addHook("onClose", async () => { await client.quit(); });
}

export default fp(redisPlugin, { name: "redis" });
