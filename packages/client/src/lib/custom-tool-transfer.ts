import {
  getFolderManifestConfig,
  isJsonRecord,
  sanitizeFolderSegment,
} from "@marinara-engine/shared";
import type { CustomToolRow } from "../hooks/use-custom-tools";
import type { ZipFileInput } from "./download-zip";
import {
  reservePackageFolderSegment,
  resolvePackageTextPaths,
  type FolderPackageImportEntry,
} from "./folder-package-transfer";

type JsonRecord = Record<string, unknown>;

export type CustomToolTransferConfig = {
  name: string;
  description: string;
  parametersSchema: JsonRecord;
  executionType: "webhook" | "static" | "script";
  webhookUrl: string | null;
  staticResult: string | null;
  scriptBody: string | null;
  includeHiddenContext: boolean;
  enabled: boolean;
};

export type CustomToolFolderPackageEntry = {
  entry: {
    path: string;
    manifest: {
      kind: "marinara.function";
      version: 1;
      config: Record<string, unknown>;
    };
  };
  files: ZipFileInput[];
};

function parseBooleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  return fallback;
}

function parseToolParametersSchema(value: unknown): JsonRecord {
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

function parseToolParametersSchemaFile(resolveTextFile: ((path: unknown) => string | null) | undefined, value: unknown) {
  const text = resolvePackageTextPaths(resolveTextFile ?? (() => null), value);
  return text ? parseToolParametersSchema(text) : null;
}

export function serializeCustomToolForTransfer(tool: CustomToolRow): CustomToolTransferConfig {
  const executionType =
    tool.executionType === "webhook" || tool.executionType === "script" || tool.executionType === "static"
      ? tool.executionType
      : "static";
  return {
    name: tool.name,
    description: tool.description,
    parametersSchema: parseToolParametersSchema(tool.parametersSchema),
    executionType,
    webhookUrl: executionType === "webhook" ? tool.webhookUrl : null,
    staticResult: executionType === "static" ? tool.staticResult : null,
    scriptBody: executionType === "script" ? tool.scriptBody : null,
    includeHiddenContext: parseBooleanValue(tool.includeHiddenContext, false),
    enabled: parseBooleanValue(tool.enabled),
  };
}

export function normalizeCustomToolImportEntry(
  entry: unknown,
  resolveTextFile?: (path: unknown) => string | null,
): CustomToolTransferConfig | null {
  const source = getFolderManifestConfig(entry);
  if (!isJsonRecord(source)) return null;
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const description = typeof source.description === "string" ? source.description.trim() : "";
  if (!name || !description) return null;
  const executionType =
    source.executionType === "webhook" || source.executionType === "script" || source.executionType === "static"
      ? source.executionType
      : "static";
  const parametersSchema =
    parseToolParametersSchemaFile(resolveTextFile, source.parametersSchemaPath ?? source.parametersPath) ??
    parseToolParametersSchema(source.parametersSchema ?? source.parameters);
  const staticResultFromFile = resolvePackageTextPaths(resolveTextFile ?? (() => null), source.staticResultPath);
  const scriptBodyFromFile = resolvePackageTextPaths(
    resolveTextFile ?? (() => null),
    source.scriptBodyPath ?? source.scriptPath ?? source.scriptPaths,
  );

  return {
    name,
    description,
    parametersSchema,
    executionType,
    webhookUrl: executionType === "webhook" && typeof source.webhookUrl === "string" ? source.webhookUrl : null,
    staticResult:
      executionType === "static"
        ? staticResultFromFile ?? (typeof source.staticResult === "string" ? source.staticResult : null)
        : null,
    scriptBody:
      executionType === "script"
        ? scriptBodyFromFile ?? (typeof source.scriptBody === "string" ? source.scriptBody : null)
        : null,
    includeHiddenContext: parseBooleanValue(source.includeHiddenContext, false),
    enabled: parseBooleanValue(source.enabled),
  };
}

export function createCustomToolFolderPackageEntries(
  tools: CustomToolTransferConfig[],
  folderName = "Function Calls",
): CustomToolFolderPackageEntry[] {
  const usedSegments = new Set<string>();
  return tools.map((tool) => {
    const segment = reservePackageFolderSegment(tool.name, "function", usedSegments);
    const folderPath = `${folderName}/${segment}`;
    const parametersSchemaPath = "parameters.schema.json";
    const config: Record<string, unknown> = {
      name: tool.name,
      description: tool.description,
      parametersSchemaPath,
      executionType: tool.executionType,
      webhookUrl: tool.executionType === "webhook" ? tool.webhookUrl : null,
      staticResult: tool.executionType === "static" ? tool.staticResult : null,
      includeHiddenContext: tool.includeHiddenContext,
      enabled: tool.enabled,
    };
    const files: ZipFileInput[] = [
      { path: `${folderPath}/${parametersSchemaPath}`, content: JSON.stringify(tool.parametersSchema, null, 2) },
    ];

    if (tool.executionType === "script" && tool.scriptBody) {
      config.scriptBodyPath = "script.js";
      files.push({ path: `${folderPath}/script.js`, content: tool.scriptBody });
    } else {
      config.scriptBody = tool.executionType === "script" ? tool.scriptBody : null;
    }

    if (tool.executionType === "static" && tool.staticResult && tool.staticResult.length > 2000) {
      config.staticResultPath = "static-result.txt";
      config.staticResult = null;
      files.push({ path: `${folderPath}/static-result.txt`, content: tool.staticResult });
    }

    const manifest = {
      kind: "marinara.function" as const,
      version: 1 as const,
      config,
    };

    return {
      entry: {
        path: `${folderPath}/manifest.json`,
        manifest,
      },
      files: [{ path: `${folderPath}/manifest.json`, content: JSON.stringify(manifest, null, 2) }, ...files],
    };
  });
}

export function createCustomToolFolderPackageFiles(tools: CustomToolTransferConfig[]): ZipFileInput[] {
  const entries = createCustomToolFolderPackageEntries(tools);
  return [
    {
      path: "marinara-functions.json",
      content: JSON.stringify(
        {
          kind: "marinara.function-folder",
          version: 1,
          exportedAt: new Date().toISOString(),
          folderName: "Function Calls",
          functions: entries.map(({ entry }) => entry),
        },
        null,
        2,
      ),
    },
    ...entries.flatMap(({ files }) => files),
  ];
}

export function createCustomToolFolderPackageFilename(name: string, fallback = "marinara-functions") {
  return `${sanitizeFolderSegment(name, fallback)}.functions.zip`;
}

export async function importCustomToolEntries(
  entries: FolderPackageImportEntry[],
  createCustomTool: { mutateAsync: (data: Record<string, unknown>) => Promise<unknown> },
) {
  let imported = 0;
  const failed: string[] = [];
  for (const entry of entries) {
    const normalized = normalizeCustomToolImportEntry(entry.raw, entry.resolveTextFile);
    if (!normalized) continue;
    try {
      await createCustomTool.mutateAsync(normalized);
      imported++;
    } catch (error) {
      failed.push(error instanceof Error ? error.message : `Failed to import ${normalized.name}`);
    }
  }
  return { imported, failed };
}
