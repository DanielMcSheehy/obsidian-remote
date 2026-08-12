import type { FastifyInstance } from "fastify";
import { config } from "../lib/config.js";
import { requireAppPassword } from "../lib/auth.js";

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login with {password} -> returns token (= password) if correct
  app.post("/api/auth/login", async (req, reply) => {
    const { password } = (req.body as { password?: string }) ?? {};
    if (!config.appPassword) {
      // no password configured — open mode
      return { token: "", ok: true, hint: "APP_PASSWORD not set — auth disabled" };
    }
    if (password !== config.appPassword) return reply.code(401).send({ error: "wrong password" });
    return { token: config.appPassword, ok: true };
  });

  app.get("/api/auth/me", { preHandler: [requireAppPassword] }, async () => ({ ok: true }));
}
