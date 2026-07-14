import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { capabilityPackageManager } from "../services/capability-packages/package-manager.service.js";

const packageParams = z.object({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80) });

export async function capabilityPackagesRoutes(app: FastifyInstance) {
  app.get("/catalog", async () => capabilityPackageManager.catalog());
  app.get("/installed", async () => capabilityPackageManager.installed());
  app.post<{ Params: { id: string } }>("/:id/install", async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Agent package installation" })) return;
    const { id } = packageParams.parse(request.params);
    return capabilityPackageManager.install(id);
  });
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Agent package removal" })) return;
    const { id } = packageParams.parse(request.params);
    return (await capabilityPackageManager.uninstall(id)) ? reply.status(204).send() : reply.status(404).send({ error: "Package not found" });
  });
}
