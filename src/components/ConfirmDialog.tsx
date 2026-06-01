import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = "Continue", cancelLabel = "Cancel",
  destructive, onConfirm, onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md">
      <div className="panel w-full max-w-md p-6">
        <div className="mb-3 flex items-center gap-2 text-amber-500">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="font-display text-lg font-bold tracking-wide text-foreground">{title}</h2>
        </div>
        <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-widest text-secondary-foreground hover:bg-accent"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-widest text-destructive-foreground shadow-sm hover:brightness-110 ${
              destructive ? "bg-destructive" : "bg-[var(--ok)] text-background"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
