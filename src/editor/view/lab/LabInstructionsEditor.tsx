// LabInstructionsEditor — split-pane markdown editor for lab instructions.
// Left: monospace textarea. Right: rendered markdown preview.
// Wired to LabEditorStore.updateInstructions.

import { useMemo } from "react";
import { useLabEditor } from "@/editor/viewmodel/lab-editor-store";
import { useCourseEditorStore } from "@/editor/viewmodel/course-editor-store";
import type { EditableLab } from "@/editor/model/types";

// ── Helpers ────────────────────────────────────────────────────

function findLabForStep(stepId: string): EditableLab | undefined {
  const course = useCourseEditorStore.getState().course;
  if (!course) return undefined;
  const step = course.steps.find((s) => s.id === stepId);
  if (!step || step.kind !== "lab") return undefined;
  return step.lab;
}

// ── Minimal markdown → HTML ───────────────────────────────────
// Handles headings, bold, italic, inline code, code blocks, lists, paragraphs.
// No external dependency — good enough for a live preview.

function markdownToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let inList = false;

  for (const line of lines) {
    // Code fences
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        out.push("</code></pre>");
        inCodeBlock = false;
      } else {
        if (inList) { out.push("</ul>"); inList = false; }
        out.push('<pre class="instructions-code-block"><code>');
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      out.push(line);
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      if (inList) { out.push("</ul>"); inList = false; }
      const level = headingMatch[1]!.length;
      const text = inlineFormat(headingMatch[2]!);
      out.push(`<h${level} style="margin:0.5em 0;font-size:${1.4 - level * 0.1}em">${text}</h${level}>`);
      continue;
    }

    // Unordered list items
    const listMatch = /^[-*]\s+(.+)$/.exec(line);
    if (listMatch) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inlineFormat(listMatch[1]!)}</li>`);
      continue;
    }

    // Close list if we're no longer in one
    if (inList && line.trim() === "") {
      out.push("</ul>");
      inList = false;
    }

    // Blank line → paragraph break
    if (line.trim() === "") {
      out.push("<br/>");
      continue;
    }

    // Regular paragraph
    out.push(`<p style="margin:0.25em 0">${inlineFormat(line)}</p>`);
  }

  if (inList) out.push("</ul>");
  if (inCodeBlock) out.push("</code></pre>");

  return out.join("\n");
}

function inlineFormat(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code style="background:#1a1a1a;padding:1px 4px;border-radius:2px;font-family:var(--font-mono);font-size:0.9em">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// ── LabInstructionsEditor ─────────────────────────────────────

type LabInstructionsEditorProps = {
  readonly stepId: string;
};

export function LabInstructionsEditor({ stepId }: LabInstructionsEditorProps) {
  const lab = findLabForStep(stepId);
  if (!lab) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-sm text-muted-foreground">Lab not found</span>
      </div>
    );
  }

  return <InstructionsPane lab={lab} />;
}

function InstructionsPane({ lab }: { readonly lab: EditableLab }) {
  const store = useLabEditor(lab);
  const html = useMemo(() => markdownToHtml(store.lab.instructions), [store.lab.instructions]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-border px-sp-3 py-sp-2">
        <h2 className="text-ide-sm font-semibold text-foreground">Instructions</h2>
      </div>
      <div className="flex flex-1 min-h-0">
        {/* Editor */}
        <div className="flex flex-1 flex-col border-r border-border">
          <div className="flex h-[28px] items-center px-sp-3">
            <span className="text-ide-2xs font-medium uppercase tracking-wider text-muted-foreground">
              Markdown
            </span>
          </div>
          <textarea
            className="ide-scrollbar flex-1 resize-none bg-background p-sp-3 font-mono text-ide-xs leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            placeholder="Write instructions in markdown..."
            value={store.lab.instructions}
            onChange={(e) => { store.updateInstructions(e.target.value); }}
            aria-label="Lab instructions markdown editor"
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <div className="flex flex-1 flex-col">
          <div className="flex h-[28px] items-center px-sp-3">
            <span className="text-ide-2xs font-medium uppercase tracking-wider text-muted-foreground">
              Preview
            </span>
          </div>
          <div
            className="instructions-prose ide-scrollbar flex-1 overflow-y-auto p-sp-3"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
