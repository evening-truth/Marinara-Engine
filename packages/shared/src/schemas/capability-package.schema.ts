import { z } from "zod";

export const capabilityPackageKindSchema = z.enum(["agent", "maps", "conversation-calls", "turn-game"]);
export const capabilityPermissionSchema = z.enum([
  "agent-runtime",
  "chat-read",
  "chat-write",
  "network",
  "prompt-context",
  "routes",
  "storage",
  "ui",
]);

export const capabilityPackageManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  name: z.string().min(1).max(120),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  description: z.string().max(2000).default(""),
  engine: z.object({ min: z.string().min(1), maxExclusive: z.string().min(1) }).strict(),
  kind: z.array(capabilityPackageKindSchema).min(1),
  entrypoints: z
    .object({
      server: z.string().optional(),
      client: z.string().optional(),
      agents: z.string().optional(),
      knowledge: z.string().optional(),
    })
    .strict(),
  permissions: z.array(capabilityPermissionSchema),
  restartRequired: z.boolean().default(false),
}).strict();

export const capabilityCatalogPackageSchema = z.object({
  manifest: capabilityPackageManifestSchema,
  artifact: z.object({
    url: z.string().url(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive().max(100 * 1024 * 1024),
  }).strict(),
  iconUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
}).strict();

export const capabilityCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  packages: z.array(capabilityCatalogPackageSchema),
}).strict();

export const installedCapabilityPackageSchema = z.object({
  id: z.string(),
  version: z.string(),
  manifest: capabilityPackageManifestSchema,
  installedAt: z.string().datetime(),
  status: z.enum(["active", "restart-required", "error"]),
  error: z.string().nullable(),
  legacy: z.boolean().default(false),
});

export const installedCapabilityRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  packages: z.array(installedCapabilityPackageSchema),
}).strict();

export type CapabilityPackageManifest = z.infer<typeof capabilityPackageManifestSchema>;
export type CapabilityCatalogPackage = z.infer<typeof capabilityCatalogPackageSchema>;
export type CapabilityCatalog = z.infer<typeof capabilityCatalogSchema>;
export type InstalledCapabilityPackage = z.infer<typeof installedCapabilityPackageSchema>;
