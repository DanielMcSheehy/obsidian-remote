import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "./config.js";

export const VIEW_COOKIE = "vault_view";

export function readCookie(req: FastifyRequest, name: string): string {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return rest.join("=");
      }
    }
  }
  return "";
}

export function requireAppPassword(req: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (!config.appPassword) {
    done();
    return;
  }
  const header = (req.headers.authorization || "").trim();
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const xToken = (req.headers["x-auth-token"] as string | undefined) || "";
  const qToken = (req.query as Record<string, string> | undefined)?.token || "";
  const cookie = readCookie(req, VIEW_COOKIE);
  const provided = token || xToken || qToken || cookie || "";
  if (provided !== config.appPassword) {
    reply.code(401).send({ error: "unauthorized", hint: "Set Authorization: Bearer <APP_PASSWORD> or X-Auth-Token" });
    return;
  }
  done();
}
