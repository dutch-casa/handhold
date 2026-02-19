import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type GoToLineDialogProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onGoToLine: (line: number) => void;
};

export function GoToLineDialog({ open, onClose, onGoToLine }: GoToLineDialogProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = useCallback(() => {
    const line = parseInt(value, 10);
    if (Number.isNaN(line) || line < 1) return;
    onGoToLine(line);
    onClose();
    setValue("");
  }, [value, onGoToLine, onClose]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
        setValue("");
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xs gap-3">
        <DialogHeader>
          <DialogTitle>Go to Line</DialogTitle>
        </DialogHeader>
        <Input
          ref={inputRef}
          type="number"
          min={1}
          placeholder="Line number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="tabular-nums"
        />
      </DialogContent>
    </Dialog>
  );
}
