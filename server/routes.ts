import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return httpServer;
}
