import { useEffect, useRef, useState } from "react";
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
  readonly initialUrl?: string | undefined;
};

const IMPORT_MESSAGES: Record<
  Exclude<ImportResult["kind"], "ok">,
  string
> = {
  invalidUrl: "That doesn't look like a valid course URL.",
  notFound: "Course not found. Check the URL and try again.",
  noManifest: "No handhold.yaml found at that location.",
  badManifest: "The handhold.yaml manifest is invalid.",
  alreadyExists: "This course is already in your library.",
  downloadFailed: "Failed to download the course.",
};

export function ImportDialog({ open, onOpenChange, initialUrl }: ImportDialogProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [error, setError] = useState("");
  const importMutation = useImportCourse();
  const autoSubmitted = useRef(false);

  useEffect(() => {
    if (initialUrl && initialUrl.length > 0) {
      setUrl(initialUrl);
    }
  }, [initialUrl]);

  useEffect(() => {
    if (!open || !initialUrl || initialUrl.length === 0 || autoSubmitted.current) return;
    autoSubmitted.current = true;
    doImport(initialUrl);
  }, [open, initialUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  function doImport(value: string) {
    setError("");
    importMutation.mutate(value.trim(), {
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    doImport(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Course</DialogTitle>
          <DialogDescription>
            Paste a link to a handhold.yaml file, or a GitHub repository URL.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            autoFocus
            placeholder="URL to handhold.yaml or GitHub repo"
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
