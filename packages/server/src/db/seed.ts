// ──────────────────────────────────────────────
// Seed: Marinara's Universal Prompt Preset
// Creates or refreshes Marinara's bundled universal roleplay preset.
// Reads the exported preset JSON and imports it via the standard importer.
// ──────────────────────────────────────────────
import { logger } from "../lib/logger.js";
import type { DB } from "./connection.js";
import { createPromptsStorage } from "../services/storage/prompts.storage.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { importMarinara } from "../services/import/marinara.importer.js";
import { choiceBlocks, promptGroups, promptSections } from "./schema/index.js";
import { DEFAULT_CONVERSATION_PROMPT, DEFAULT_GAME_SYSTEM_PROMPT } from "@marinara-engine/shared";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LEGACY_MARINARA_PRESET_NAME = "Default";
const MARINARA_PRESET_NAME = "Marinara's Universal Preset";
const MARINARA_PRESET_DESCRIPTION = "Marinara's universal roleplay preset. Serves as a good base.";
const MARINARA_PRESET_AUTHOR = "Marinara";
const MARINARA_PRESET_SEED_HASH_KEY = "seed:marinara-universal-preset:sha256";

type BundledPresetEnvelope = {
  type: "marinara_preset";
  version: 1;
  exportedAt: string;
  data: {
    preset: Record<string, unknown>;
    groups?: Record<string, unknown>[];
    sections?: Record<string, unknown>[];
    choiceBlocks?: Record<string, unknown>[];
  };
};

function readBundledDefaultPreset(): { hash: string; envelope: BundledPresetEnvelope } {
  const jsonPath = join(__dirname, "default-preset.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const envelope = JSON.parse(raw) as BundledPresetEnvelope;
  return {
    hash: createHash("sha256").update(raw).digest("hex"),
    envelope,
  };
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function numberField(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function bundledPresetDescription(envelope: BundledPresetEnvelope): string {
  return String(envelope.data.preset.description ?? MARINARA_PRESET_DESCRIPTION);
}

function bundledConversationPrompt(preset: Record<string, unknown>): string {
  return String(preset.conversationPrompt ?? preset.conversation_prompt ?? DEFAULT_CONVERSATION_PROMPT);
}

function bundledGamePrompt(preset: Record<string, unknown>): string {
  return String(preset.gamePrompt ?? preset.game_prompt ?? DEFAULT_GAME_SYSTEM_PROMPT);
}

async function applyBundledPresetToExisting(
  db: DB,
  storage: ReturnType<typeof createPromptsStorage>,
  presetId: string,
  envelope: BundledPresetEnvelope,
) {
  const bundled = envelope.data;
  const preset = bundled.preset;

  await storage.update(presetId, {
    name: String(preset.name ?? MARINARA_PRESET_NAME),
    description: String(preset.description ?? MARINARA_PRESET_DESCRIPTION),
    conversationPrompt: bundledConversationPrompt(preset),
    gamePrompt: bundledGamePrompt(preset),
    variableGroups: parseJsonField(preset.variableGroups, []),
    variableValues: parseJsonField(preset.variableValues, {}),
    parameters: parseJsonField(preset.parameters, {}),
    wrapFormat: (preset.wrapFormat as "xml" | "markdown" | "none" | undefined) ?? "xml",
    author: String(preset.author ?? MARINARA_PRESET_AUTHOR),
    defaultChoices: parseJsonField(preset.defaultChoices, {}),
  });

  await db.delete(choiceBlocks).where(eq(choiceBlocks.presetId, presetId));
  await db.delete(promptSections).where(eq(promptSections.presetId, presetId));
  await db.delete(promptGroups).where(eq(promptGroups.presetId, presetId));

  const groupMap = new Map<string, string>();
  for (const group of bundled.groups ?? []) {
    const newGroup = await storage.createGroup({
      presetId,
      name: String(group.name ?? ""),
      parentGroupId: null,
      order: numberField(group.order, 100),
      enabled: group.enabled === true || group.enabled === "true",
    });
    if (newGroup) groupMap.set(String(group.id), newGroup.id);
  }

  for (const group of bundled.groups ?? []) {
    if (!group.parentGroupId || !groupMap.has(String(group.parentGroupId))) continue;
    const newGroupId = groupMap.get(String(group.id));
    if (!newGroupId) continue;
    await storage.updateGroup(newGroupId, {
      parentGroupId: groupMap.get(String(group.parentGroupId))!,
    });
  }

  const sectionMap = new Map<string, string>();
  for (const section of bundled.sections ?? []) {
    const newSection = await storage.createSection({
      presetId,
      identifier: String(section.identifier ?? ""),
      name: String(section.name ?? ""),
      content: String(section.content ?? ""),
      role: (section.role as "system" | "user" | "assistant" | undefined) ?? "system",
      enabled: section.enabled === true || section.enabled === "true",
      isMarker: section.isMarker === true || section.isMarker === "true",
      groupId: section.groupId ? (groupMap.get(String(section.groupId)) ?? null) : null,
      markerConfig: section.markerConfig ? parseJsonField(section.markerConfig, null) : null,
      injectionPosition: (section.injectionPosition as "ordered" | "depth" | undefined) ?? "ordered",
      injectionDepth: numberField(section.injectionDepth, 0),
      injectionOrder: numberField(section.injectionOrder, 100),
      forbidOverrides: section.forbidOverrides === true || section.forbidOverrides === "true",
    });
    if (newSection) sectionMap.set(String(section.id), newSection.id);
  }

  for (const choice of bundled.choiceBlocks ?? []) {
    await storage.createChoiceBlock({
      presetId,
      variableName: String(choice.variableName ?? ""),
      question: String(choice.question ?? ""),
      options: parseJsonField(choice.options, []),
      multiSelect: choice.multiSelect === true || choice.multiSelect === "true",
      separator: String(choice.separator ?? ", "),
      randomPick: choice.randomPick === true || choice.randomPick === "true",
      displayMode: choice.displayMode === "buttons" || choice.displayMode === "listbox" ? choice.displayMode : "auto",
      optionSort: choice.optionSort === "alphabetical" ? "alphabetical" : "manual",
    });
  }

  await storage.update(presetId, {
    sectionOrder: parseJsonField<string[]>(preset.sectionOrder, [])
      .map((sectionId) => sectionMap.get(sectionId))
      .filter((sectionId): sectionId is string => Boolean(sectionId)),
    groupOrder: parseJsonField<string[]>(preset.groupOrder, [])
      .map((groupId) => groupMap.get(groupId))
      .filter((groupId): groupId is string => Boolean(groupId)),
  });
}

// ─────────────────────────────────────────────
//  Main seed function
// ─────────────────────────────────────────────
export async function seedDefaultPreset(db: DB) {
  const storage = createPromptsStorage(db);
  const appSettings = createAppSettingsStorage(db);
  const bundled = readBundledDefaultPreset();

  const existing = await storage.list();
  const existingMarinaraPreset =
    existing.find(
      (preset) =>
        preset.name === MARINARA_PRESET_NAME && preset.author === MARINARA_PRESET_AUTHOR && preset.isDefault === "true",
    ) ??
    existing.find((preset) => preset.name === MARINARA_PRESET_NAME && preset.author === MARINARA_PRESET_AUTHOR) ??
    existing.find(
      (preset) => preset.name === LEGACY_MARINARA_PRESET_NAME && preset.author === MARINARA_PRESET_AUTHOR,
    );

  const appliedHash = await appSettings.get(MARINARA_PRESET_SEED_HASH_KEY);
  if (existingMarinaraPreset && appliedHash !== bundled.hash) {
    const wasDefault = existingMarinaraPreset.isDefault === "true";
    await applyBundledPresetToExisting(db, storage, existingMarinaraPreset.id, bundled.envelope);
    if (wasDefault) await storage.setDefault(existingMarinaraPreset.id);
    await appSettings.set(MARINARA_PRESET_SEED_HASH_KEY, bundled.hash);
    logger.info("[seed] Updated bundled Marinara universal preset to %s", bundled.hash.slice(0, 12));
    return;
  }

  // Older builds named the bundled preset "Default"; keep the display name tidy
  // even when its bundled body already matches the current seed hash.
  const legacyMarinaraPreset = existing.find(
    (preset) => preset.name === LEGACY_MARINARA_PRESET_NAME && preset.author === MARINARA_PRESET_AUTHOR,
  );
  if (legacyMarinaraPreset) {
    await storage.update(legacyMarinaraPreset.id, {
      name: MARINARA_PRESET_NAME,
      description: bundledPresetDescription(bundled.envelope),
    });
  }

  // Skip if any preset already exists (user may have deleted or changed defaults)
  if (existing.length > 0) return;

  // Import using the standard importer
  const result = await importMarinara(bundled.envelope, db);
  if (!result.success || result.type !== "marinara_preset") {
    logger.error("[seed] Failed to import default preset: %j", result);
    return;
  }

  // Set as default + apply default variable selections
  const presetId = (result as { id: string }).id;
  await storage.setDefault(presetId);
  await storage.update(presetId, {
    conversationPrompt: bundledConversationPrompt(bundled.envelope.data.preset),
    gamePrompt: bundledGamePrompt(bundled.envelope.data.preset),
    defaultChoices: parseJsonField(bundled.envelope.data.preset.defaultChoices, {}),
  });
  await appSettings.set(MARINARA_PRESET_SEED_HASH_KEY, bundled.hash);
}
