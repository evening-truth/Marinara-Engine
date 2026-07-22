import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import type { InstalledExtension } from "../../packages/shared/src/index.js";
import type { DB } from "../../packages/server/src/db/connection.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { installedExtensions } from "../../packages/server/src/db/schema/index.js";
import { serverExtensionRuntime } from "../../packages/server/src/services/extensions/server-extension-runtime.js";
import { createExtensionsStorage } from "../../packages/server/src/services/storage/extensions.storage.js";

const clientThemeSource = readFileSync(
  new URL("../../packages/client/src/components/layout/CustomThemeInjector.tsx", import.meta.url),
  "utf8",
);
const serverRuntimeSource = readFileSync(
  new URL("../../packages/server/src/services/extensions/server-extension-runtime.ts", import.meta.url),
  "utf8",
);
const extensionRoutesSource = readFileSync(
  new URL("../../packages/server/src/routes/extensions.routes.ts", import.meta.url),
  "utf8",
);
const extensionStorageSource = readFileSync(
  new URL("../../packages/server/src/services/storage/extensions.storage.ts", import.meta.url),
  "utf8",
);
const securityHeadersSource = readFileSync(
  new URL("../../packages/server/src/middleware/security-headers.ts", import.meta.url),
  "utf8",
);

const legacyClientExtension: InstalledExtension = {
  id: "legacy-client-extension",
  name: "Legacy client extension",
  description: "Regression fixture",
  enabled: true,
  installedAt: new Date(0).toISOString(),
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};
const blockedClientStatus = serverExtensionRuntime.withRuntimeStatus(legacyClientExtension);
assert.equal(blockedClientStatus.enabled, false);
assert.equal(blockedClientStatus.executionBlocked, true);

assert.match(clientThemeSource, /useThemes/u);
assert.doesNotMatch(
  clientThemeSource,
  /useExtensions|InstalledExtension|ExtensionCssInjector|EXTENSION_STYLE_PREFIX|createObjectURL|@vite-ignore/u,
);
assert.doesNotMatch(serverRuntimeSource, /node:vm|runInContext|new vm\.Script/u);
assert.match(extensionRoutesSource, /EXTENSIONS_DISABLED/u);
assert.match(extensionRoutesSource, /status\(410\)/u);
assert.doesNotMatch(extensionRoutesSource, /["']\/:id\/storage["']/u);
assert.match(extensionStorageSource, /enabled: "false"/u);
assert.doesNotMatch(extensionStorageSource, /row\.(?:css|js|serverJs)/u);
assert.doesNotMatch(securityHeadersSource, /script-src[^"\n]*\bblob:/u);

const storageDir = mkdtempSync(join(tmpdir(), "marinara-extension-security-"));
process.env.FILE_STORAGE_DIR = storageDir;
const fileDb = await createFileNativeDB();
const db = fileDb as unknown as DB;
try {
  const timestamp = new Date(0).toISOString();
  await db.insert(installedExtensions).values({
    id: "persisted-enabled-css-extension",
    name: "Persisted enabled CSS extension",
    description: "Regression fixture",
    runtime: "client",
    css: "#must-never-apply { display: block; }",
    js: null,
    serverJs: null,
    enabled: "true",
    installedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await serverExtensionRuntime.start({} as FastifyInstance, db);
  const persisted = await createExtensionsStorage(db).getById("persisted-enabled-css-extension");
  assert.ok(persisted);
  assert.equal(persisted?.enabled, false, "startup must durably disable every legacy extension");
  assert.equal("css" in persisted, false, "cleanup records must not expose stored CSS payloads");
  assert.equal("js" in persisted, false, "cleanup records must not expose stored browser payloads");
  assert.equal("serverJs" in persisted, false, "cleanup records must not expose stored server payloads");
} finally {
  await fileDb._fileStore.close();
  rmSync(storageDir, { recursive: true, force: true });
}

console.log("Extension removal security regression passed.");
