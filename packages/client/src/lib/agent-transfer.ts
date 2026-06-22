import { sanitizeFolderSegment } from "@marinara-engine/shared";
import type { ZipFileInput } from "./download-zip";
import {
  createCustomToolFolderPackageEntries,
  type CustomToolTransferConfig,
} from "./custom-tool-transfer";
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

export function createAgentFolderPackageFiles(
  agents: AgentTransferConfig[],
  options: { customTools?: CustomToolTransferConfig[] } = {},
): ZipFileInput[] {
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
  const functionEntries =
    options.customTools && options.customTools.length > 0
      ? createCustomToolFolderPackageEntries(options.customTools)
      : [];

  const envelope = {
    kind: "marinara.agent-folder",
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    folderName: "Agents",
    agents: entries.map(({ entry }) => entry),
    ...(functionEntries.length > 0 ? { functions: functionEntries.map(({ entry }) => entry) } : {}),
  };

  return [
    { path: "marinara-agents.json", content: JSON.stringify(envelope, null, 2) },
    ...entries.flatMap(({ folderPath, promptTemplatePath, settingsPath, manifest, config }) => [
      { path: `${folderPath}/manifest.json`, content: JSON.stringify(manifest, null, 2) },
      { path: `${folderPath}/${promptTemplatePath}`, content: config.promptTemplate },
      { path: `${folderPath}/${settingsPath}`, content: JSON.stringify(config.settings, null, 2) },
    ]),
    ...functionEntries.flatMap(({ files }) => files),
  ];
}

export function createAgentFolderPackageFilename(name: string, fallback = "marinara-agent") {
  return `${sanitizeFolderSegment(name, fallback)}.agent.zip`;
}
