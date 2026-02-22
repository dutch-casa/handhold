// NarrationEditor — editable narration paragraphs with trigger pills.
// Each paragraph is a <textarea> that auto-grows with content.
// Typing {{ opens the TriggerAutocomplete dropdown.
// Triggers are rendered as pills below each paragraph, positioned by wordIndex.

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { TriggerVerb } from "@/types/lesson";
import type { EditableNarration } from "@/editor/model/types";
import { TriggerPill } from "@/editor/view/canvas/TriggerPill";
import { TriggerAutocomplete } from "@/editor/view/canvas/TriggerAutocomplete";

// ── Auto-resize textarea ──────────────────────────────────────────

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "0";
  el.style.height = `${el.scrollHeight}px`;
}

// ── Paragraph component ───────────────────────────────────────────

type ParagraphEditorProps = {
  readonly paragraph: EditableNarration;
  readonly paragraphIndex: number;
  readonly blockNames: readonly string[];
  readonly regions: readonly string[];
  readonly onUpdateText: (paragraphIndex: number, text: string) => void;
  readonly onAddTrigger: (paragraphIndex: number, wordIndex: number, verb: TriggerVerb) => void;
  readonly onUpdateTrigger: (paragraphIndex: number, triggerIndex: number, verb: TriggerVerb) => void;
  readonly onRemoveTrigger: (paragraphIndex: number, triggerIndex: number) => void;
};

function ParagraphEditor({
  paragraph,
  paragraphIndex,
  blockNames,
  regions,
  onUpdateText,
  onAddTrigger,
  onUpdateTrigger,
  onRemoveTrigger,
}: ParagraphEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [autocompleteState, setAutocompleteState] = useState<{
    readonly anchor: { readonly top: number; readonly left: number };
    readonly wordIndex: number;
    readonly editingTriggerIndex: number | null;
  } | null>(null);

  // Auto-resize on mount and text changes.
  useEffect(() => {
    if (!textareaRef.current) return;
    autoResize(textareaRef.current);
  }, [paragraph.text]);

  // ── Text change ─────────────────────────────────────────────────

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onUpdateText(paragraphIndex, e.target.value);
      autoResize(e.target);
    },
    [paragraphIndex, onUpdateText],
  );

  // ── Detect {{ keystroke ─────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "{") return;

      const ta = textareaRef.current;
      if (!ta) return;

      const pos = ta.selectionStart;
      if (pos < 1) return;
      if (ta.value[pos - 1] !== "{") return;

      // Double-brace detected. Calculate word index from cursor position.
      const textBeforeCursor = ta.value.slice(0, pos - 1);
      const words = textBeforeCursor.trim().split(/\s+/);
      const wordIndex = textBeforeCursor.trim() === "" ? 0 : words.length;

      // Get anchor position for dropdown.
      const rect = ta.getBoundingClientRect();
      // Approximate cursor position: measure text up to cursor.
      const linesBefore = ta.value.slice(0, pos).split("\n");
      const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 20;
      const top = rect.top + linesBefore.length * lineHeight;
      const left = rect.left + 16;

      e.preventDefault();

      // Remove the {{ from text.
      const before = ta.value.slice(0, pos - 1);
      const after = ta.value.slice(pos);
      onUpdateText(paragraphIndex, before + after);

      setAutocompleteState({
        anchor: { top, left },
        wordIndex,
        editingTriggerIndex: null,
      });
    },
    [paragraphIndex, onUpdateText],
  );

  // ── Autocomplete handlers ───────────────────────────────────────

  const handleAutocompleteSelect = useCallback(
    (verb: TriggerVerb) => {
      if (!autocompleteState) return;

      if (autocompleteState.editingTriggerIndex !== null) {
        onUpdateTrigger(paragraphIndex, autocompleteState.editingTriggerIndex, verb);
      } else {
        onAddTrigger(paragraphIndex, autocompleteState.wordIndex, verb);
      }
      setAutocompleteState(null);
    },
    [autocompleteState, paragraphIndex, onAddTrigger, onUpdateTrigger],
  );

  const handleAutocompleteCancel = useCallback(() => {
    setAutocompleteState(null);
  }, []);

  // ── Pill click → open autocomplete for editing ──────────────────

  const handlePillClick = useCallback(
    (triggerIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const trigger = paragraph.triggers[triggerIndex];
      if (!trigger) return;

      setAutocompleteState({
        anchor: { top: rect.bottom + 4, left: rect.left },
        wordIndex: trigger.wordIndex,
        editingTriggerIndex: triggerIndex,
      });
    },
    [paragraph.triggers],
  );

  return (
    <div className="group/para relative">
      {/* Paragraph number badge */}
      <div className="absolute -left-8 top-2 flex h-5 w-5 items-center justify-center rounded-full
        bg-muted text-ide-2xs font-medium text-muted-foreground">
        {paragraphIndex + 1}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={paragraph.text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type narration text..."
        aria-label={`Paragraph ${paragraphIndex + 1}`}
        rows={1}
        className="w-full resize-none rounded-md border border-transparent bg-transparent px-sp-3 py-sp-2
          text-ide-sm text-foreground leading-relaxed placeholder:text-muted-foreground/40
          transition-colors duration-fast
          hover:border-border focus:border-border focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {/* Trigger pills */}
      {paragraph.triggers.length > 0 && (
        <div className="flex flex-wrap gap-1 px-sp-3 pb-sp-2" role="group" aria-label="Triggers">
          {paragraph.triggers.map((trigger, i) => (
            <TriggerPill
              key={`${trigger.wordIndex}-${trigger.action.verb}-${i}`}
              action={trigger.action}
              onClick={(e) => handlePillClick(i, e)}
              onRemove={() => onRemoveTrigger(paragraphIndex, i)}
            />
          ))}
        </div>
      )}

      {/* Autocomplete dropdown */}
      {autocompleteState && (
        <TriggerAutocomplete
          anchorRect={autocompleteState.anchor}
          blockNames={blockNames}
          regions={regions}
          onSelect={handleAutocompleteSelect}
          onCancel={handleAutocompleteCancel}
        />
      )}
    </div>
  );
}

// ── Add paragraph button ──────────────────────────────────────────

function AddParagraphButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add paragraph"
      className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-dashed
        border-border text-muted-foreground/50 opacity-0 transition-opacity duration-fast
        group-hover/narration:opacity-100 hover:border-primary hover:text-primary
        focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M6 2v8M2 6h8" />
      </svg>
    </button>
  );
}

// ── NarrationEditor ───────────────────────────────────────────────

type NarrationEditorProps = {
  readonly narration: readonly EditableNarration[];
  readonly blockNames: readonly string[];
  readonly regions: readonly string[];
  readonly onUpdateText: (paragraphIndex: number, text: string) => void;
  readonly onAddParagraph: (afterIndex: number) => void;
  readonly onAddTrigger: (paragraphIndex: number, wordIndex: number, verb: TriggerVerb) => void;
  readonly onUpdateTrigger: (paragraphIndex: number, triggerIndex: number, verb: TriggerVerb) => void;
  readonly onRemoveTrigger: (paragraphIndex: number, triggerIndex: number) => void;
};

export function NarrationEditor({
  narration,
  blockNames,
  regions,
  onUpdateText,
  onAddParagraph,
  onAddTrigger,
  onUpdateTrigger,
  onRemoveTrigger,
}: NarrationEditorProps) {
  return (
    <div className="group/narration flex flex-col gap-1 pl-10" role="group" aria-label="Narration paragraphs">
      {narration.map((para, i) => (
        <div key={i}>
          <ParagraphEditor
            paragraph={para}
            paragraphIndex={i}
            blockNames={blockNames}
            regions={regions}
            onUpdateText={onUpdateText}
            onAddTrigger={onAddTrigger}
            onUpdateTrigger={onUpdateTrigger}
            onRemoveTrigger={onRemoveTrigger}
          />
          {/* Add-paragraph button between paragraphs */}
          <div className="flex justify-center py-0.5">
            <AddParagraphButton onClick={() => onAddParagraph(i)} />
          </div>
        </div>
      ))}

      {/* Leading add button when empty */}
      {narration.length === 0 && (
        <div className="flex justify-center py-sp-4">
          <button
            type="button"
            onClick={() => onAddParagraph(-1)}
            aria-label="Add first paragraph"
            className="flex items-center gap-sp-2 rounded-md border border-dashed border-border
              px-sp-4 py-sp-2 text-ide-xs text-muted-foreground
              transition-colors duration-fast hover:border-primary hover:text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Add narration paragraph
          </button>
        </div>
      )}
    </div>
  );
}
