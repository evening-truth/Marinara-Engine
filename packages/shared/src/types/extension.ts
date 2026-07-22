// ──────────────────────────────────────────────
// Extension Types
// ──────────────────────────────────────────────

/**
 * A user-installed extension stored on the Marinara server.
 *
 * This public shape contains metadata only. Legacy payload columns remain in
 * storage until the user deletes the record, but never cross the API boundary.
 */
export interface InstalledExtension {
  id: string;
  name: string;
  /** Optional author-declared release version retained for identification. */
  version?: string | null;
  description: string;
  /** Whether the extension is currently active. */
  enabled: boolean;
  /** True when a legacy extension record is retained but blocked by policy. */
  executionBlocked?: boolean;
  /** When the user originally imported it. */
  installedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const EXTENSIONS_DISABLED_MESSAGE =
  "Extensions have been removed for security. Existing records can only be reviewed and deleted.";
