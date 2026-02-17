import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSettingsStore } from "@/lab/settings-store";
import type { EditorSettings, LineNumbers } from "@/types/settings";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function SettingsPanel() {
  const editor = useSettingsStore((s) => s.editor);
  const setEditor = useSettingsStore((s) => s.setEditor);

  const update = (patch: Partial<EditorSettings>) => {
    setEditor({ ...editor, ...patch });
  };

  return (
    <ScrollArea className="h-full">
      <Collapsible defaultOpen className="flex flex-col">
        <CollapsibleTrigger className="ide-section-header">
          <ChevronRight className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
          <span>Editor</span>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-3 py-2">
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs text-muted-foreground">Vim mode</span>
              <Switch
                size="sm"
                checked={editor.vimMode}
                onCheckedChange={(checked) => update({ vimMode: checked })}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs text-muted-foreground">Ligatures</span>
              <Switch
                size="sm"
                checked={editor.ligatures}
                onCheckedChange={(checked) => update({ ligatures: checked })}
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Font size</span>
              <Input
                type="number"
                min={8}
                max={32}
                value={editor.fontSize}
                onChange={(e) =>
                  update({ fontSize: clamp(e.target.valueAsNumber || 14, 8, 32) })
                }
                className="h-6 w-14 rounded-md px-2 text-center text-xs tabular-nums"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tab size</span>
              <Input
                type="number"
                min={1}
                max={8}
                value={editor.tabSize}
                onChange={(e) =>
                  update({ tabSize: clamp(e.target.valueAsNumber || 2, 1, 8) })
                }
                className="h-6 w-14 rounded-md px-2 text-center text-xs tabular-nums"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs text-muted-foreground">Word wrap</span>
              <Switch
                size="sm"
                checked={editor.wordWrap}
                onCheckedChange={(checked) => update({ wordWrap: checked })}
              />
            </label>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Line numbers</span>
              <Select
                value={editor.lineNumbers}
                onValueChange={(v) => update({ lineNumbers: v as LineNumbers })}
              >
                <SelectTrigger className="h-6 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">On</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="relative">Relative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs text-muted-foreground">Bracket matching</span>
              <Switch
                size="sm"
                checked={editor.bracketColors}
                onCheckedChange={(checked) => update({ bracketColors: checked })}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs text-muted-foreground">Auto save</span>
              <Switch
                size="sm"
                checked={editor.autoSave}
                onCheckedChange={(checked) => update({ autoSave: checked })}
              />
            </label>

            {editor.autoSave ? (
              <label className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Save delay (ms)</span>
                <Input
                  type="number"
                  min={500}
                  max={5000}
                  step={500}
                  value={editor.autoSaveDelay}
                  onChange={(e) =>
                    update({ autoSaveDelay: clamp(e.target.valueAsNumber || 1000, 500, 5000) })
                  }
                  className="h-6 w-20 rounded-md px-2 text-center text-xs tabular-nums"
                />
              </label>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </ScrollArea>
  );
}
