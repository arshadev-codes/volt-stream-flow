import { X } from "lucide-react";
import type { ReactNode } from "react";

export function GraphModal({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4 py-10 backdrop-blur-md">
      <div className="panel relative w-full max-w-6xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold tracking-wide text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[70vh] w-full">{children}</div>
      </div>
    </div>
  );
}
