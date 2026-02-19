import { useState, useEffect, useRef } from "react";
import { useImportCourse } from "@/browser/use-courses";
import type { ImportResult } from "@/types/browser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type ImportDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

const IMPORT_MESSAGES: Record<
  Exclude<ImportResult["kind"], "ok">,
  string
> = {
  invalidUrl: "That doesn't look like a valid GitHub URL.",
  notFound: "Repository not found. Check the URL and try again.",
  noManifest: "No handhold.yaml found at the repository root.",
  badManifest: "The handhold.yaml manifest is invalid.",
  alreadyExists: "This course is already in your library.",
  cloneFailed: "Failed to download the repository.",
};

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const importMutation = useImportCourse();
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    importMutation.mutate(url.trim(), {
      onSuccess: (result) => {
        if (result.kind === "ok") {
          setUrl("");
          onOpenChange(false);
          return;
        }

        const base = IMPORT_MESSAGES[result.kind];
        const detail = "reason" in result ? `: ${result.reason}` : "";
        setError(`${base}${detail}`);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      },
    });
  }

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Course</DialogTitle>
          <DialogDescription>
            Paste a GitHub repository URL containing a handhold.yaml manifest.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            ref={inputRef}
            placeholder="https://github.com/owner/repo"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            aria-invalid={error.length > 0 ? true : undefined}
          />

          {error.length > 0 && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={url.trim().length === 0 || importMutation.isPending}
            >
              {importMutation.isPending && (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              )}
              {importMutation.isPending ? "Importing..." : "Import"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
