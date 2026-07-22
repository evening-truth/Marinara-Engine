import {
  getFolderManifestConfig,
  normalizeAgentPhaseForType,
  normalizeAgentPhaseValue,
  sanitizeFolderSegment,
} from "@marinara-engine/shared";
import type { ZipFileInput } from "./download-zip";
import { reservePackageFolderSegment } from "./folder-package-transfer";

export type AgentTransferConfig = {
  type: string;
  name: string;
  description: string;
  phase: unknown;
  enabled: unknown;
  connectionId: null;
  imagePath: null;
  promptTemplate: string;
  settings: Record<string, unknown>;
  resultType?: unknown;
};

const TRANSFER_UNSAFE_AGENT_SETTING_KEYS = new Set([
  "spotifyAccessToken",
  "spotifyRefreshToken",
  "spotifyExpiresAt",
  "spotifyScope",
  "youtubeApiKey",
  "sourceLorebookIds",
  "sourceFileIds",
  "writableLorebookId",
  "writableLorebookIds",
  "targetLorebookId",
  "imageConnectionId",
  "lorebookWriteEnabled",
  "customAgentRepositorySource",
]);

const TRANSFER_UNSAFE_ENABLED_TOOLS = new Set(["save_lorebook_entry"]);

export function sanitizeAgentSettingsForTransfer(settings: Record<string, unknown>) {
  const sanitized = { ...settings };
  for (const key of TRANSFER_UNSAFE_AGENT_SETTING_KEYS) {
    delete sanitized[key];
  }

  if (Array.isArray(sanitized.enabledTools)) {
    sanitized.enabledTools = sanitized.enabledTools.filter(
      (tool): tool is string => typeof tool === "string" && !TRANSFER_UNSAFE_ENABLED_TOOLS.has(tool),
    );
  }

  return sanitized;
}

/** Imported agents never receive tool access from the file they came from. */
export function sanitizeAgentSettingsForImport(settings: Record<string, unknown>) {
  const sanitized = sanitizeAgentSettingsForTransfer(settings);
  delete sanitized.enabledTools;
  return sanitized;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseAgentSettings(value: unknown): Record<string, unknown> {
  if (isJsonRecord(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isJsonRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function createImportedAgentType(sourceType: string): string {
  const slug =
    sourceType
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "agent";
  const suffix =
    globalThis.crypto && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `custom-import-${slug}-${suffix}`;
}

export function normalizeAgentImportEntry(entry: unknown, resolveTextFile?: (path: unknown) => string | null) {
  const source = getFolderManifestConfig(entry);
  if (!isJsonRecord(source)) return null;

  const sourceType = typeof source.type === "string" ? source.type.trim() : "";
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const description = typeof source.description === "string" ? source.description : "";
  if (!sourceType || !name) return null;
  const type = createImportedAgentType(sourceType);
  const phase = normalizeAgentPhaseForType(type, normalizeAgentPhaseValue(source.phase));

  const settingsText = resolveTextFile?.(source.settingsPath);
  const settings = sanitizeAgentSettingsForImport(parseAgentSettings(settingsText ?? source.settings));
  if (typeof source.author === "string" && !settings.author) {
    settings.author = source.author;
  }
  if (Array.isArray(source.promptTemplates) && settings.promptTemplates === undefined) {
    settings.promptTemplates = source.promptTemplates;
  }
  if (typeof settings.author !== "string" || !settings.author.trim()) {
    settings.author = "Unknown";
  }
  const resultType = typeof source.resultType === "string" ? source.resultType : settings.resultType;

  return {
    type,
    name,
    description,
    phase,
    enabled: true,
    connectionId: null,
    imagePath: null,
    promptTemplate:
      resolveTextFile?.(source.promptTemplatePath) ??
      (typeof source.promptTemplate === "string" ? source.promptTemplate : ""),
    settings,
    ...(typeof resultType === "string" ? { resultType } : {}),
  };
}

export function createAgentFolderPackageFiles(agents: AgentTransferConfig[]): ZipFileInput[] {
  const usedSegments = new Set<string>();
  const entries = agents.map((agent) => {
    const segment = reservePackageFolderSegment(agent.type || agent.name, "agent", usedSegments);
    const folderPath = `Agents/${segment}`;
    const promptTemplatePath = "prompt.md";
    const settingsPath = "settings.json";
    const config = {
      ...agent,
      promptTemplatePath,
      settingsPath,
    };
    const manifest = {
      kind: "marinara.agent",
      version: 1 as const,
      config,
    };
    return {
      folderPath,
      promptTemplatePath,
      settingsPath,
      entry: {
        path: `${folderPath}/manifest.json`,
        manifest,
      },
      manifest,
      config,
    };
  });
  const envelope = {
    kind: "marinara.agent-folder",
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    folderName: "Agents",
    agents: entries.map(({ entry }) => entry),
  };

  return [
    { path: "marinara-agents.json", content: JSON.stringify(envelope, null, 2) },
    ...entries.flatMap(({ folderPath, promptTemplatePath, settingsPath, manifest, config }) => [
      { path: `${folderPath}/manifest.json`, content: JSON.stringify(manifest, null, 2) },
      { path: `${folderPath}/${promptTemplatePath}`, content: config.promptTemplate },
      { path: `${folderPath}/${settingsPath}`, content: JSON.stringify(config.settings, null, 2) },
    ]),
  ];
}

export function createAgentFolderPackageFilename(name: string, fallback = "marinara-agent") {
  return `${sanitizeFolderSegment(name, fallback)}.agent.zip`;
}
