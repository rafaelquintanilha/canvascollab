import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupCollaborationServer } from "./collaboration";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupCollaborationServer(httpServer);

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return httpServer;
}
