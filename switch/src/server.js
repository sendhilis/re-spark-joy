import Fastify from "fastify";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import redisPlugin from "./plugins/redis.js";
import idempotencyPlugin from "./plugins/idempotency.js";
import healthRoutes from "./routes/health.js";
import intentRoutes from "./routes/intents.js";

const app = Fastify({
  logger: {
    level: config.logLevel,
    transport: process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { translateTime: "HH:MM:ss.l", ignore: "pid,hostname" } },
  },
  // Generate / propagate trace ids
  genReqId: (req) => req.headers["x-trace-id"]?.toString() ??
    crypto.randomUUID().replace(/-/g, "").slice(0, 16),
  disableRequestLogging: false,
  trustProxy: true,
});

await app.register(sensible);
await app.register(rateLimit, {
  max: 2000,
  timeWindow: "1 minute",
  // Per-payer rate-limit; tweak for prod.
  keyGenerator: (req) => req.body?.payer_identifier ?? req.ip,
});
await app.register(redisPlugin);
await app.register(idempotencyPlugin);
await app.register(healthRoutes);
await app.register(intentRoutes, { prefix: "/v1" });

// Graceful shutdown
const shutdown = async (signal) => {
  app.log.info({ signal }, "shutdown signal");
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err, "shutdown error");
    process.exit(1);
  }
};
["SIGINT", "SIGTERM"].forEach((s) => process.on(s, () => shutdown(s)));

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
