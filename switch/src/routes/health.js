export default async function healthRoutes(app) {
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/readyz", async (_req, reply) => {
    try {
      const pong = await app.redis.ping();
      return { ok: pong === "PONG" };
    } catch (err) {
      reply.code(503);
      return { ok: false, error: err.message };
    }
  });
}
