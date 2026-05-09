import fp from "fastify-plugin";
import Redis from "ioredis";
import { config } from "../config.js";

// Decorates `app.redis` with a shared ioredis client.
// Use a single connection; ioredis pipelines internally.
async function redisPlugin(app) {
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 2,
    enableAutoPipelining: true,
    lazyConnect: false,
  });
  client.on("error", (err) => app.log.error({ err }, "redis error"));
  app.decorate("redis", client);
  app.addHook("onClose", async () => { await client.quit(); });
}

export default fp(redisPlugin, { name: "redis" });
