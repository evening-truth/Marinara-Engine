import { useState } from "react";
import { ExternalLink, Pencil, Sliders, Trash2 } from "lucide-react";
import { DEFAULT_CONVERSATION_PROMPT } from "@marinara-engine/shared";
import { useUIStore } from "../../../stores/ui.store";
import { ExpandedTextarea } from "../../../components/ui/ExpandedTextarea";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface PromptPresetOption {
  id: string;
  name: string;
  conversationPrompt?: string;
}

interface ConversationPromptSectionProps {
  chatId: string;
  customPrompt: string;
  promptPresetId: string | null;
  promptPresets: PromptPresetOption[];
  selectedPresetName: string | null;
  selectedPresetPrompt: string;
  onCustomPromptChange: (chatId: string, customPrompt: string | null) => void;
  onPromptPresetChange: (presetId: string) => void;
  onOpenPromptPreset: () => void;
}

export function ConversationPromptSection({
  chatId,
  customPrompt,
  promptPresetId,
  promptPresets,
  selectedPresetName,
  selectedPresetPrompt,
  onCustomPromptChange,
  onPromptPresetChange,
  onOpenPromptPreset,
}: ConversationPromptSectionProps) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const basePrompt = selectedPresetPrompt.trim() || DEFAULT_CONVERSATION_PROMPT;

  const openPromptEditor = () => {
    setPromptDraft(customPrompt || basePrompt);
    setPromptOpen(true);
  };

  const closePromptEditor = () => {
    const isPresetPrompt = promptDraft.trim() === basePrompt.trim();
    const nextPrompt = !promptDraft.trim() || isPresetPrompt ? null : promptDraft;
    onCustomPromptChange(chatId, nextPrompt);
    useUIStore.getState().setCustomConversationPrompt(nextPrompt);
    setPromptOpen(false);
  };

  const resetPrompt = () => {
    onCustomPromptChange(chatId, null);
    useUIStore.getState().setCustomConversationPrompt(null);
  };

  return (
    <>
      <ChatSettingsSection
        label="Prompt Preset"
        icon={<Sliders size="0.875rem" />}
        help="Choose a preset's Conversation prompt, then optionally edit a chat-local copy."
      >
        <div className="space-y-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Prompt source</span>
            <div className="flex items-center gap-1.5">
              <select
                value={promptPresetId ?? ""}
                onChange={(event) => onPromptPresetChange(event.target.value)}
                disabled={promptPresets.length === 0}
                className="min-w-0 flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {promptPresets.length === 0 ? (
                  <option value="">No presets available</option>
                ) : (
                  promptPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={onOpenPromptPreset}
                disabled={!promptPresetId}
                className="mari-chrome-control mari-chrome-control--small shrink-0 px-2 py-2 text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-45"
                title="Open selected preset"
              >
                <ExternalLink size="0.75rem" />
                <span className="max-sm:hidden">Preset</span>
              </button>
            </div>
          </label>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 ring-1 ring-[var(--border)]">
            <div className="min-w-0">
              <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">Conversation Prompt</span>
              <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                {customPrompt ? "Using chat-local edit" : `From ${selectedPresetName ?? "selected preset"}`}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {customPrompt ? "Custom" : "Preset"}
            </span>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={openPromptEditor}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
            >
              <Pencil size="0.625rem" />
              Edit Prompt
            </button>
            {customPrompt && (
              <button
                type="button"
                onClick={resetPrompt}
                className="flex items-center justify-center rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Reset to default prompt"
              >
                <Trash2 size="0.625rem" />
              </button>
            )}
          </div>
        </div>
      </ChatSettingsSection>
      <ExpandedTextarea
        open={promptOpen}
        onClose={closePromptEditor}
        title="Edit Conversation Prompt"
        value={promptDraft}
        onChange={setPromptDraft}
        placeholder="Enter your custom conversation prompt..."
        surface="chat"
      />
    </>
  );
}
