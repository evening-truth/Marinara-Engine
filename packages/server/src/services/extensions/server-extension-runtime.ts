// ──────────────────────────────────────────────
// Server Extension Runtime (disabled)
// ──────────────────────────────────────────────
// Extension payloads must not run inside Marinara. Legacy records remain
// visible for identification and removal, but are always forced disabled.
import type { FastifyInstance } from "fastify";
import type { InstalledExtension } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createExtensionsStorage } from "../storage/extensions.storage.js";

class DisabledServerExtensionRuntime {
  async start(_app: FastifyInstance, db: DB): Promise<void> {
    const storage = createExtensionsStorage(db);
    const enabledExtensions = (await storage.list()).filter((extension) => extension.enabled);
    for (const extension of enabledExtensions) {
      await storage.disable(extension.id);
    }
    if (enabledExtensions.length > 0) {
      await db._fileStore.flush();
      logger.warn(
        "[extensions] Extension execution is removed; disabled %d persisted extension(s)",
        enabledExtensions.length,
      );
    }
  }

  async stop(): Promise<void> {}

  withRuntimeStatus(extension: InstalledExtension): InstalledExtension {
    return {
      ...extension,
      enabled: false,
      executionBlocked: true,
    };
  }
}

export const serverExtensionRuntime = new DisabledServerExtensionRuntime();
