import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { CloseConfirmState } from "@/lab/store";
import { useSettingsStore } from "@/lab/settings-store";
import { save as persistSettings } from "@/lab/tauri/settings";

function nameFromPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

type SaveConfirmDialogProps = {
  readonly closeConfirm: CloseConfirmState;
  readonly onSave: () => void;
  readonly onDontSave: () => void;
  readonly onCancel: () => void;
};

export function SaveConfirmDialog({
  closeConfirm,
  onSave,
  onDontSave,
  onCancel,
}: SaveConfirmDialogProps) {
  const [suppress, setSuppress] = useState(false);

  if (closeConfirm.kind !== "prompting") return null;

  const fileName = nameFromPath(closeConfirm.path);

  const handleSuppress = (checked: boolean) => {
    setSuppress(checked);
    useSettingsStore.getState().setSuppressCloseConfirm(checked);
    const state = useSettingsStore.getState();
    persistSettings({
      editor: state.editor,
      sidebarPanel: state.sidebarPanel,
      sidebarCollapsed: state.sidebarCollapsed,
      suppressCloseConfirm: checked,
    });
  };

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save changes to {fileName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Your changes will be lost if you don&apos;t save them.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={suppress}
            onCheckedChange={handleSuppress}
          />
          Don&apos;t ask me again
        </label>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onDontSave}>
            Don&apos;t Save
          </Button>
          <Button onClick={onSave}>
            Save
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
