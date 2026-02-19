import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GROUPED_BINDINGS,
  CATEGORY_LABELS,
  formatKey,
  type HotkeyBinding,
  type HotkeyCategory,
} from "@/lab/hotkeys/registry";

type ShortcutsOverlayProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
};

function KeyCombo({ binding }: { readonly binding: HotkeyBinding }) {
  if (binding.kind === "single") {
    return <Kbd text={formatKey(binding.keys)} />;
  }
  const counts = new Map<string, number>();
  let isFirst = true;
  return (
    <span className="flex items-center gap-1">
      {binding.keys.map((key) => {
        const label = formatKey(key);
        const next = (counts.get(label) ?? 0) + 1;
        counts.set(label, next);
        const showThen = !isFirst;
        isFirst = false;
        return (
          <span key={`${label}-${next}`} className="flex items-center gap-1">
            {showThen ? <span className="text-muted-foreground/50">then</span> : null}
            <Kbd text={label} />
          </span>
        );
      })}
    </span>
  );
}

function Kbd({ text }: { readonly text: string }) {
  const parts = text.split(" + ");
  const counts = new Map<string, number>();
  return (
    <span className="flex items-center gap-0.5">
      {parts.map((part) => {
        const next = (counts.get(part) ?? 0) + 1;
        counts.set(part, next);
        return (
        <kbd
          key={`${part}-${next}`}
          className="inline-flex min-w-[1.5em] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
        >
          {part}
        </kbd>
        );
      })}
    </span>
  );
}

export function ShortcutsOverlay({ visible, onClose }: ShortcutsOverlayProps) {
  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {Array.from(GROUPED_BINDINGS.entries()).map(([category, bindings]) => {
            if (bindings.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[category as HotkeyCategory]}
                </h3>
                <div className="flex flex-col gap-1">
                  {bindings.map((binding) => (
                    <div
                      key={binding.id}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
                    >
                      <span className="text-foreground">{binding.label}</span>
                      <KeyCombo binding={binding} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
