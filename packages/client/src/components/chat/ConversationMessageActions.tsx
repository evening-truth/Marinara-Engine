// ──────────────────────────────────────────────
// Hover action bar — floats above the message row
// ──────────────────────────────────────────────
import { Brain, Copy, Eye, EyeOff, Languages, Pencil, RefreshCw, ScrollText, Search, Trash2 } from "lucide-react";
import type { MessageExtra } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { MsgAction } from "./ConversationMessageShared";

export interface ConversationMessageActionsProps {
  // Positioning
  isBubbleStyle: boolean;
  isUser: boolean;
  // Visibility
  showActions: boolean;
  forceShowActions?: boolean;
  // State
  copied: boolean;
  translatedText?: string | null;
  isHiddenFromAI: boolean;
  canRegenerate: boolean;
  isLastAssistantMessage?: boolean;
  thinking?: string | null;
  generationReplay: MessageExtra["generationReplay"] | null;
  isGuided: boolean;
  regenerateButtonTitle: string;
  regenerateGuidedClass?: string;
  // Handlers
  onCopy: () => void;
  onTranslate: () => void;
  onEdit: () => void;
  onRegenerate?: () => void;
  onToggleHiddenFromAI?: () => void;
  onPeekPrompt?: () => void;
  onDelete?: () => void;
  onShowGenerationReplay: () => void;
  onShowThinking: () => void;
}

export function ConversationMessageActions({
  isBubbleStyle,
  isUser,
  showActions,
  forceShowActions,
  copied,
  translatedText,
  isHiddenFromAI,
  canRegenerate,
  isLastAssistantMessage,
  thinking,
  generationReplay,
  regenerateButtonTitle,
  regenerateGuidedClass,
  onCopy,
  onTranslate,
  onEdit,
  onRegenerate,
  onToggleHiddenFromAI,
  onPeekPrompt,
  onDelete,
  onShowGenerationReplay,
  onShowThinking,
}: ConversationMessageActionsProps) {
  return (
    <div
      className={cn(
        "mari-message-actions absolute -top-3 flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--card)]/90 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-all dark:border-white/20 dark:bg-black/40",
        "opacity-0 group-hover:opacity-100",
        (showActions || forceShowActions) && "opacity-100",
        isBubbleStyle && !isUser ? "left-12" : "right-4",
      )}
    >
      <MsgAction icon={copied ? "✓" : <Copy size="0.75rem" />} onClick={onCopy} title="Copy" />
      <MsgAction
        icon={<Languages size="0.75rem" />}
        onClick={onTranslate}
        title={translatedText ? "Hide translation" : "Translate"}
        className={translatedText ? "text-blue-400" : undefined}
      />
      <MsgAction icon={<Pencil size="0.75rem" />} onClick={onEdit} title="Edit" />
      {canRegenerate && onRegenerate && (
        <MsgAction
          icon={<RefreshCw size="0.75rem" />}
          onClick={onRegenerate}
          title={regenerateButtonTitle}
          className={regenerateGuidedClass}
        />
      )}
      {onToggleHiddenFromAI && (
        <MsgAction
          icon={isHiddenFromAI ? <Eye size="0.75rem" /> : <EyeOff size="0.75rem" />}
          onClick={onToggleHiddenFromAI}
          title={isHiddenFromAI ? "Unhide from AI" : "Hide from AI"}
          className={isHiddenFromAI ? "text-amber-400" : undefined}
        />
      )}
      {isLastAssistantMessage && !isUser && onPeekPrompt && (
        <MsgAction icon={<Search size="0.75rem" />} onClick={onPeekPrompt} title="Peek prompt" />
      )}
      {generationReplay && (
        <MsgAction icon={<ScrollText size="0.75rem" />} onClick={onShowGenerationReplay} title="Stored guidance" />
      )}
      {thinking && !isUser && (
        <MsgAction icon={<Brain size="0.75rem" />} onClick={onShowThinking} title="View thoughts" />
      )}
      {onDelete && (
        <MsgAction
          icon={<Trash2 size="0.75rem" />}
          onClick={onDelete}
          title="Delete"
          className="hover:text-[var(--destructive)]"
        />
      )}
    </div>
  );
}
