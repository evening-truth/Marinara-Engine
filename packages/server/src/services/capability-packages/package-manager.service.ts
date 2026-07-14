import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import AdmZip from "adm-zip";
import {
  APP_VERSION,
  capabilityCatalogSchema,
  capabilityPackageManifestSchema,
  installedCapabilityRegistrySchema,
  type CapabilityCatalog,
  type InstalledCapabilityPackage,
} from "@marinara-engine/shared";
import { DATA_DIR } from "../../utils/data-dir.js";
import { safeFetch } from "../../utils/security.js";

const ROOT = join(DATA_DIR, "capability-packages");
const VERSIONS = join(ROOT, "versions");
const REGISTRY = join(ROOT, "installed.json");
const CATALOG_URL = process.env.MARINARA_AGENT_CATALOG_URL?.trim() ||
  "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/catalog/catalog.json";
const MAX_ARTIFACT_BYTES = 100 * 1024 * 1024;

function inside(root: string, candidate: string): string {
  const base = resolve(root);
  const target = resolve(candidate);
  if (target !== base && !target.startsWith(`${base}${sep}`)) throw new Error("Package contains an unsafe path");
  return target;
}

function versionParts(value: string): number[] {
  return value.split("-")[0]!.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta) return delta;
  }
  return 0;
}

async function readRegistry() {
  try {
    return installedCapabilityRegistrySchema.parse(JSON.parse(await readFile(REGISTRY, "utf8")));
  } catch (error) {
    if (!existsSync(REGISTRY)) return { schemaVersion: 1 as const, packages: [] };
    throw error;
  }
}

async function writeRegistry(packages: InstalledCapabilityPackage[]) {
  await mkdir(ROOT, { recursive: true });
  const temporary = `${REGISTRY}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, JSON.stringify({ schemaVersion: 1, packages }, null, 2), { mode: 0o600 });
  await rename(temporary, REGISTRY);
}

async function fetchBytes(url: string, maximum: number): Promise<Buffer> {
  const response = await safeFetch(url, {
    policy: { allowedProtocols: ["https:"] },
    maxResponseBytes: maximum,
  });
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export const capabilityPackageManager = {
  async catalog(): Promise<CapabilityCatalog> {
    const response = await safeFetch(CATALOG_URL, {
      policy: { allowedProtocols: ["https:"] },
      maxResponseBytes: 2 * 1024 * 1024,
      allowedContentTypes: ["application/json", "text/plain"],
    });
    if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`);
    return capabilityCatalogSchema.parse(await response.json());
  },

  async installed() {
    return (await readRegistry()).packages;
  },

  async install(packageId: string) {
    const catalog = await this.catalog();
    const entry = catalog.packages.find((candidate) => candidate.manifest.id === packageId);
    if (!entry) throw new Error("Package is not present in the official catalog");
    const { manifest, artifact } = entry;
    if (compareVersions(APP_VERSION, manifest.engine.min) < 0 || compareVersions(APP_VERSION, manifest.engine.maxExclusive) >= 0) {
      throw new Error(`Package requires Marinara Engine ${manifest.engine.min} to below ${manifest.engine.maxExclusive}`);
    }
    const archive = await fetchBytes(artifact.url, Math.min(artifact.bytes + 1, MAX_ARTIFACT_BYTES));
    if (archive.byteLength !== artifact.bytes) throw new Error("Downloaded package size does not match the catalog");
    const digest = createHash("sha256").update(archive).digest("hex");
    if (digest !== artifact.sha256) throw new Error("Downloaded package checksum does not match the catalog");

    const zip = new AdmZip(archive);
    const temporary = join(ROOT, `.install-${manifest.id}-${Date.now()}`);
    const destination = join(VERSIONS, manifest.id, manifest.version);
    await rm(temporary, { recursive: true, force: true });
    await mkdir(temporary, { recursive: true });
    try {
      for (const item of zip.getEntries()) {
        if (item.isDirectory) continue;
        const output = inside(temporary, join(temporary, item.entryName));
        await mkdir(dirname(output), { recursive: true });
        await writeFile(output, item.getData(), { mode: 0o600 });
      }
      const installedManifest = capabilityPackageManifestSchema.parse(
        JSON.parse(await readFile(join(temporary, "manifest.json"), "utf8")),
      );
      if (installedManifest.id !== manifest.id || installedManifest.version !== manifest.version) {
        throw new Error("Artifact manifest does not match the catalog");
      }
      await mkdir(dirname(destination), { recursive: true });
      await rm(destination, { recursive: true, force: true });
      await rename(temporary, destination);
      const registry = await readRegistry();
      const installed: InstalledCapabilityPackage = {
        id: manifest.id,
        version: manifest.version,
        manifest,
        installedAt: new Date().toISOString(),
        status: manifest.restartRequired ? "restart-required" : "active",
        error: null,
        legacy: false,
      };
      await writeRegistry([...registry.packages.filter((item) => item.id !== manifest.id), installed]);
      return installed;
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  },

  async uninstall(packageId: string) {
    const registry = await readRegistry();
    const existing = registry.packages.find((item) => item.id === packageId);
    if (!existing) return false;
    await writeRegistry(registry.packages.filter((item) => item.id !== packageId));
    await rm(join(VERSIONS, packageId), { recursive: true, force: true });
    return true;
  },
};
