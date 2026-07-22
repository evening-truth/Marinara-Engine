// ──────────────────────────────────────────────
// Hooks: Legacy extension cleanup
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import type { InstalledExtension } from "@marinara-engine/shared";

export const extensionKeys = {
  all: ["extensions"] as const,
  list: () => [...extensionKeys.all, "list"] as const,
};

/** Read-only list used to remove records left by older Marinara versions. */
export function useExtensions() {
  return useQuery({
    queryKey: extensionKeys.list(),
    queryFn: () => api.get<InstalledExtension[]>("/extensions"),
    staleTime: 5 * 60_000,
    refetchOnReconnect: true,
  });
}

export function useDeleteExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/extensions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: extensionKeys.all });
    },
  });
}

/**
 * Remove browser-local extension records left by versions that predated
 * server storage. They are intentionally not copied into the disabled server
 * registry because the extension feature no longer exists.
 */
export function useLegacyExtensionCleanup() {
  const legacyExtensions = useUIStore((state) => state.installedExtensions);
  const hasCleanedUp = useUIStore((state) => state.hasMigratedExtensionsToServer);
  const clearLegacy = useUIStore((state) => state.clearLegacyExtensions);
  const markCleanedUp = useUIStore((state) => state.setHasMigratedExtensionsToServer);

  useEffect(() => {
    if (hasCleanedUp) return;
    if (legacyExtensions.length > 0) {
      console.warn(`[Extensions] Removed ${legacyExtensions.length} disabled browser-local extension record(s).`);
      clearLegacy();
    }
    markCleanedUp(true);
  }, [clearLegacy, hasCleanedUp, legacyExtensions.length, markCleanedUp]);
}
