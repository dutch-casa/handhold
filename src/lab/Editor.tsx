import { useRef, useEffect, useCallback } from "react";
import * as monaco from "monaco-editor";
import { initVimMode } from "monaco-vim";
import "@/lab/monaco-workers";
import { useSettingsStore } from "@/lab/settings-store";
import { useEditorCursorStore } from "@/lab/editor-cursor-store";
import { langFromExt } from "@/lab/monaco-lang";
import { getOrCreateModel } from "@/lab/monaco-models";
import type { LineChange } from "@/lab/tauri/git";
import type { LineNumbers } from "@/types/settings";

// Deep module: hides all of Monaco Editor.
// Consumer passes content + callbacks. Internal wiring is invisible.

type EditorProps = {
  readonly filePath: string;
  readonly content: string;
  readonly ext: string;
  readonly gitChanges: readonly LineChange[];
  readonly onSave: (content: string) => void;
  readonly onChange: (content: string) => void;
  readonly onOpenFile?: ((path: string, line: number, column: number) => void) | undefined;
  readonly onViewCreated?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  readonly onViewDestroyed?: () => void;
  readonly fontSize?: number;
  readonly tabSize?: number;
};

// Line number mode → Monaco config
function lineNumbersOption(mode: LineNumbers): monaco.editor.LineNumbersType {
  if (mode === "off") return "off";
  if (mode === "relative") return "relative";
  return "on";
}

// Git diff change kind → Monaco decoration class
const CHANGE_KIND_CLASS: Record<string, string> = {
  added: "git-gutter-added",
  modified: "git-gutter-modified",
  deleted: "git-gutter-deleted",
};

// Handhold dark theme — matches the existing true-black palette
monaco.editor.defineTheme("handhold-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "ff7b72" },
    { token: "keyword.control", foreground: "ff7b72" },
    { token: "storage", foreground: "ff7b72" },
    { token: "storage.type", foreground: "ff7b72" },
    { token: "string", foreground: "a5d6ff" },
    { token: "string.regexp", foreground: "a5d6ff" },
    { token: "number", foreground: "79c0ff" },
    { token: "constant", foreground: "79c0ff" },
    { token: "constant.language", foreground: "79c0ff" },
    { token: "comment", foreground: "555550", fontStyle: "italic" },
    { token: "entity.name.function", foreground: "d2a8ff" },
    { token: "support.function", foreground: "d2a8ff" },
    { token: "variable", foreground: "f1efe8" },
    { token: "variable.parameter", foreground: "ffa657" },
    { token: "entity.name.type", foreground: "ffa657" },
    { token: "entity.name.class", foreground: "ffa657" },
    { token: "support.type", foreground: "ffa657" },
    { token: "entity.other.attribute-name", foreground: "79c0ff" },
    { token: "tag", foreground: "7ee787" },
    { token: "metatag", foreground: "8a8880" },
    { token: "delimiter", foreground: "8a8880" },
    { token: "bracket", foreground: "8a8880" },
    { token: "operator", foreground: "ff7b72" },
    { token: "invalid", foreground: "f87171" },
    { token: "type", foreground: "ffa657" },
    { token: "type.identifier", foreground: "ffa657" },
    { token: "identifier", foreground: "f1efe8" },
  ],
  colors: {
    "editor.background": "#0a0a0a",
    "editor.foreground": "#f1efe8",
    "editorCursor.foreground": "#f1efe8",
    "editor.selectionBackground": "#ffffff15",
    "editor.lineHighlightBackground": "#ffffff06",
    "editorLineNumber.foreground": "#555550",
    "editorLineNumber.activeForeground": "#8a8880",
    "editorGutter.background": "#0a0a0a",
    "editorBracketMatch.background": "#ffffff15",
    "editorBracketMatch.border": "#8a8880",
    "editorWidget.background": "#141414",
    "editorWidget.border": "#2a2a2a",
    "editorSuggestWidget.background": "#141414",
    "editorSuggestWidget.border": "#2a2a2a",
    "editorSuggestWidget.selectedBackground": "#1a1a1a",
    "editorSuggestWidget.highlightForeground": "#ffa657",
    "editorHoverWidget.background": "#141414",
    "editorHoverWidget.border": "#2a2a2a",
    "input.background": "#0a0a0a",
    "input.border": "#2a2a2a",
    "input.foreground": "#f1efe8",
    "focusBorder": "#ffa657",
    "list.activeSelectionBackground": "#1a1a1a",
    "list.hoverBackground": "#1a1a1a",
    "scrollbarSlider.background": "#2a2a2a80",
    "scrollbarSlider.hoverBackground": "#555550",
    "scrollbarSlider.activeBackground": "#8a8880",
    "minimap.background": "#0a0a0a",
    "editorOverviewRuler.border": "#2a2a2a",
    "panel.border": "#2a2a2a",
    "peekViewEditor.background": "#0a0a0a",
    "peekViewResult.background": "#141414",
    "peekViewTitle.background": "#141414",
    "peekViewTitleLabel.foreground": "#f1efe8",
    "peekViewTitleDescription.foreground": "#8a8880",
    "editorIndentGuide.background": "#2a2a2a",
    "editorIndentGuide.activeBackground": "#555550",
    "findMatchHighlight.background": "#ffa65730",
    "editor.findMatchBackground": "#ffa65760",
    "editor.findMatchHighlightBackground": "#ffa65730",
  },
});

// CSS for git gutter decorations — injected once
const GUTTER_STYLE_ID = "handhold-git-gutter-style";
if (!document.getElementById(GUTTER_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = GUTTER_STYLE_ID;
  style.textContent = `
    .git-gutter-added { border-left: 3px solid #7ee787 !important; }
    .git-gutter-modified { border-left: 3px solid #ffa657 !important; }
    .git-gutter-deleted { border-left: 3px solid #f87171 !important; }
  `;
  document.head.appendChild(style);
}

// Configure TypeScript defaults for IntelliSense (0.55+ top-level namespace)
const ts = monaco.typescript;
ts.typescriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  esModuleInterop: true,
  allowNonTsExtensions: true,
  allowJs: true,
});
ts.typescriptDefaults.setEagerModelSync(true);
ts.javascriptDefaults.setEagerModelSync(true);

export function Editor({
  filePath,
  content,
  ext,
  gitChanges,
  onSave,
  onChange,
  onOpenFile,
  onViewCreated,
  onViewDestroyed,
  fontSize = 14,
  tabSize = 2,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const vimRef = useRef<{ dispose: () => void } | null>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  const { vimMode, ligatures, wordWrap, lineNumbers: lineNumbersMode, bracketColors, minimap, stickyScroll } =
    useSettingsStore((s) => s.editor);

  const handleSave = useCallback((ed: monaco.editor.IStandaloneCodeEditor) => {
    onSave(ed.getValue());
  }, [onSave]);

  // Create editor once, update options when settings change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const model = getOrCreateModel(filePath, content, langFromExt(ext));

    const editor = monaco.editor.create(container, {
      model,
      theme: "handhold-dark",
      fontSize,
      tabSize,
      lineNumbers: lineNumbersOption(lineNumbersMode),
      wordWrap: wordWrap ? "on" : "off",
      matchBrackets: bracketColors ? "always" : "never",
      fontLigatures: ligatures,
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      minimap: { enabled: minimap },
      stickyScroll: { enabled: stickyScroll },
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      smoothScrolling: true,
      bracketPairColorization: { enabled: bracketColors },
      guides: { bracketPairs: bracketColors, indentation: true },
      fixedOverflowWidgets: true,
      padding: { top: 8 },
      suggest: {
        showMethods: true,
        showFunctions: true,
        showConstructors: true,
        showFields: true,
        showVariables: true,
        showClasses: true,
        showStructs: true,
        showInterfaces: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumMembers: true,
        showKeywords: true,
        showWords: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showSnippets: true,
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
      parameterHints: { enabled: true },
      hover: { enabled: true, delay: 300 },
      automaticLayout: true,
      folding: true,
      foldingStrategy: "indentation",
      renderWhitespace: "selection",
      overviewRulerLanes: 3,
    });

    editorRef.current = editor;
    decorationsRef.current = editor.createDecorationsCollection([]);
    onViewCreated?.(editor);

    // Cmd/Ctrl+S → save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave(editor);
    });

    // Cmd/Ctrl+D → add next occurrence to selection
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      editor.trigger("keyboard", "editor.action.addSelectionToNextFindMatch", null);
    });

    // Cross-file go-to-definition: intercept navigation to file:// URIs
    const openerDisposable = monaco.editor.registerEditorOpener({
      openCodeEditor(_source, resource, selectionOrPosition) {
        if (resource.scheme !== "file") return false;
        if (!onOpenFile) return false;
        let line = 1;
        let column = 1;
        if (selectionOrPosition) {
          if ("startLineNumber" in selectionOrPosition) {
            line = selectionOrPosition.startLineNumber;
            column = selectionOrPosition.startColumn;
          } else if ("lineNumber" in selectionOrPosition) {
            line = selectionOrPosition.lineNumber;
            column = selectionOrPosition.column;
          }
        }
        onOpenFile(resource.path, line, column);
        return true;
      },
    });

    // Content change → notify parent
    const disposable = editor.onDidChangeModelContent(() => {
      onChange(editor.getValue());
    });

    // Cursor position → store
    const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
      useEditorCursorStore.getState().setCursor(e.position.lineNumber, e.position.column);
    });

    // Vim mode
    if (vimMode) {
      vimRef.current = initVimMode(editor, null);
    }

    return () => {
      openerDisposable.dispose();
      cursorDisposable.dispose();
      disposable.dispose();
      vimRef.current?.dispose();
      vimRef.current = null;
      decorationsRef.current = null;
      editor.dispose();
      editorRef.current = null;
      onViewDestroyed?.();
    };
  }, [ext, vimMode, ligatures, wordWrap, lineNumbersMode, bracketColors, minimap, stickyScroll, fontSize, tabSize]); // eslint-disable-line react-hooks/exhaustive-deps -- content is initial value

  // Push git diff markers as gutter decorations
  useEffect(() => {
    const editor = editorRef.current;
    const collection = decorationsRef.current;
    if (!editor || !collection) return;

    const model = editor.getModel();
    if (!model) return;

    const decorations: monaco.editor.IModelDeltaDecoration[] = gitChanges
      .filter((c) => c.line >= 1 && c.line <= model.getLineCount())
      .map((change) => ({
        range: new monaco.Range(change.line, 1, change.line, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: CHANGE_KIND_CLASS[change.kind] ?? "",
        },
      }));

    collection.set(decorations);
  }, [gitChanges]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
    />
  );
}
