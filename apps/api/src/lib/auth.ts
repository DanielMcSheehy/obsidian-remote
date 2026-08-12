import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "./config.js";

export function requireAppPassword(req: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (!config.appPassword) {
    done();
    return;
  }
  const header = (req.headers.authorization || "").trim();
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const xToken = (req.headers["x-auth-token"] as string | undefined) || "";
  const provided = token || xToken || (req.query as Record<string, string> | undefined)?.token || "";
  if (provided !== config.appPassword) {
    reply.code(401).send({ error: "unauthorized", hint: "Set Authorization: Bearer <APP_PASSWORD> or X-Auth-Token" });
    return;
  }
  done();
}
