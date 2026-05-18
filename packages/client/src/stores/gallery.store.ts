// ──────────────────────────────────────────────
// Zustand Store: Pinned Gallery Images
// ──────────────────────────────────────────────
import { create } from "zustand";
import type { ChatImage } from "../hooks/use-gallery";

interface GalleryState {
  /** Images pinned to the chat area as floating overlays */
  pinnedImages: ChatImage[];
  /** Chat IDs with an in-flight manual gallery illustration request. */
  illustratingChatIds: Set<string>;
  pinImage: (image: ChatImage) => void;
  unpinImage: (imageId: string) => void;
  clearPinned: () => void;
  setChatIllustrating: (chatId: string, illustrating: boolean) => void;
}

export const useGalleryStore = create<GalleryState>((set) => ({
  pinnedImages: [],
  illustratingChatIds: new Set(),

  pinImage: (image) =>
    set((s) => (s.pinnedImages.some((p) => p.id === image.id) ? s : { pinnedImages: [...s.pinnedImages, image] })),

  unpinImage: (imageId) => set((s) => ({ pinnedImages: s.pinnedImages.filter((p) => p.id !== imageId) })),

  clearPinned: () => set({ pinnedImages: [] }),

  setChatIllustrating: (chatId, illustrating) =>
    set((s) => {
      const next = new Set(s.illustratingChatIds);
      if (illustrating) next.add(chatId);
      else next.delete(chatId);
      return { illustratingChatIds: next };
    }),
}));
