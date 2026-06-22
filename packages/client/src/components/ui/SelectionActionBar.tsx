import { Trash2, Upload } from "lucide-react";
import { cn } from "../../lib/utils";

interface SelectionActionBarProps {
  selectedCount: number;
  onExport: () => void;
  onDelete: () => void;
  exportDisabled?: boolean;
  deleteDisabled?: boolean;
  exporting?: boolean;
  placement?: "sticky" | "panel";
  className?: string;
}

export function SelectionActionBar({
  selectedCount,
  onExport,
  onDelete,
  exportDisabled = false,
  deleteDisabled = false,
  exporting = false,
  placement = "sticky",
  className,
}: SelectionActionBarProps) {
  const isPanelFooter = placement === "panel";

  const actionBar = (
    <div
      className={cn(
        isPanelFooter
          ? "mari-selection-action-bar fixed bottom-0 right-0 z-[60] w-[min(var(--mari-right-panel-width,20rem),100vw)] px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5"
          : "mari-selection-action-bar sticky bottom-0 z-20 -mx-3 mt-auto px-3 py-2.5",
        className,
      )}
    >
      <div className="mb-2 text-center text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
        {selectedCount} selected
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={selectedCount === 0 || exportDisabled || exporting}
          className="mari-chrome-control flex-1 px-3 py-2 text-xs"
        >
          <Upload size="0.75rem" />
          Export
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={selectedCount === 0 || deleteDisabled || exporting}
          className="mari-chrome-control mari-chrome-control--danger flex-1 px-3 py-2 text-xs"
        >
          <Trash2 size="0.75rem" />
          Delete
        </button>
      </div>
    </div>
  );

  if (isPanelFooter) {
    return (
      <>
        <div aria-hidden="true" className="h-24 shrink-0" />
        {actionBar}
      </>
    );
  }

  return actionBar;
}
