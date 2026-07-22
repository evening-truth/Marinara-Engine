// ──────────────────────────────────────────────
// Routes: Retired Extensions
// ──────────────────────────────────────────────
// The extension feature is removed. The API exposes only a payload-free list
// and deletion so users can clean up records created by older versions.
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import { EXTENSIONS_DISABLED_MESSAGE, type InstalledExtension } from "@marinara-engine/shared";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { createExtensionsStorage } from "../services/storage/extensions.storage.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { serverExtensionRuntime } from "../services/extensions/server-extension-runtime.js";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function rejectExtensionMutation(reply: FastifyReply) {
  return reply.status(410).send({
    code: "EXTENSIONS_DISABLED",
    error: EXTENSIONS_DISABLED_MESSAGE,
  });
}

function toCleanupRecord(extension: InstalledExtension): InstalledExtension {
  return serverExtensionRuntime.withRuntimeStatus(extension);
}

export async function extensionsRoutes(app: FastifyInstance) {
  const storage = createExtensionsStorage(app.db);
  const appSettings = createAppSettingsStorage(app.db);

  app.get("/", async () => (await storage.list()).map(toCleanupRecord));

  app.post("/", async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Extension installation" })) return;
    return rejectExtensionMutation(reply);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Extension updates" })) return;
    return rejectExtensionMutation(reply);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Legacy extension removal" })) return;
    if (!ID_PATTERN.test(request.params.id)) {
      return reply.status(404).send({ error: "Extension record not found" });
    }
    const existing = await storage.getById(request.params.id);
    if (!existing) return reply.status(404).send({ error: "Extension record not found" });
    await appSettings.remove(`extension-storage:${existing.id}`);
    await storage.remove(existing.id);
    return reply.status(204).send();
  });
}
