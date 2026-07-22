// ──────────────────────────────────────────────
// Storage: Installed Extensions
// ──────────────────────────────────────────────
import { desc, eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { installedExtensions } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";
import type { InstalledExtension } from "@marinara-engine/shared";

type ExtensionRow = typeof installedExtensions.$inferSelect;

function mapExtension(row: ExtensionRow): InstalledExtension {
  return {
    id: row.id,
    name: row.name,
    version: row.version ?? null,
    description: row.description,
    enabled: row.enabled === "true",
    installedAt: row.installedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createExtensionsStorage(db: DB) {
  const getById = async (id: string) => {
    const rows = await db.select().from(installedExtensions).where(eq(installedExtensions.id, id));
    const row = rows[0];
    return row ? mapExtension(row) : null;
  };

  return {
    async list() {
      const rows = await db.select().from(installedExtensions).orderBy(desc(installedExtensions.installedAt));
      return rows.map(mapExtension);
    },

    getById,

    async disable(id: string) {
      await db
        .update(installedExtensions)
        .set({ enabled: "false", updatedAt: now() })
        .where(eq(installedExtensions.id, id));
      return getById(id);
    },

    async remove(id: string) {
      await db.delete(installedExtensions).where(eq(installedExtensions.id, id));
    },
  };
}
