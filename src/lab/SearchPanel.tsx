import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Search, CaseSensitive, WholeWord, Regex, ChevronRight, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSearch } from "@/lab/use-search";
import { useDebouncedValue } from "@/lab/use-debounced-value";
import type { SearchMatch, SearchOpts } from "@/lab/tauri/search";

type SearchPanelProps = {
  readonly workspacePath: string;
  readonly onFileSelect: (path: string) => void;
  readonly onGoToLine?: ((line: number) => void) | undefined;
};

// Groups flat matches by file path
function groupByFile(matches: readonly SearchMatch[]): ReadonlyMap<string, readonly SearchMatch[]> {
  const groups = new Map<string, SearchMatch[]>();
  for (const match of matches) {
    const existing = groups.get(match.path);
    if (existing) {
      existing.push(match);
    } else {
      groups.set(match.path, [match]);
    }
  }
  return groups;
}

function nameFromPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

function ToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring rounded p-0.5 ${active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function MatchLine({
  match,
  onClick,
}: {
  readonly match: SearchMatch;
  readonly onClick: () => void;
}) {
  const { lineContent, column, matchLen, lineNumber } = match;
  const colIdx = column - 1;

  return (
    <button
      onClick={onClick}
      className="focus-ring flex w-full items-baseline gap-2 rounded px-2 py-0.5 text-left text-xs hover:bg-muted"
    >
      <span className="shrink-0 tabular-nums text-muted-foreground">{lineNumber}</span>
      <span className="truncate">
        {lineContent.slice(0, colIdx)}
        <span className="rounded bg-primary/25 text-primary">
          {lineContent.slice(colIdx, colIdx + matchLen)}
        </span>
        {lineContent.slice(colIdx + matchLen)}
      </span>
    </button>
  );
}

export function SearchPanel({ workspacePath, onFileSelect, onGoToLine }: SearchPanelProps) {
  const [rawQuery, setRawQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regexMode, setRegexMode] = useState(false);

  const query = useDebouncedValue(rawQuery, 300);

  const opts: SearchOpts = useMemo(
    () => ({ caseSensitive, regex: regexMode, wholeWord }),
    [caseSensitive, regexMode, wholeWord],
  );

  const { data, isFetching } = useSearch(workspacePath, query, opts);

  const grouped = useMemo(
    () => (data ? groupByFile(data.matches) : new Map<string, readonly SearchMatch[]>()),
    [data],
  );

  const handleMatchClick = useCallback(
    (match: SearchMatch) => {
      onFileSelect(match.path);
      onGoToLine?.(match.lineNumber);
    },
    [onFileSelect, onGoToLine],
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 px-3 py-2">
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Search files..."
              className="h-7 pl-7 text-xs"
            />
          </div>
          <ToggleButton active={caseSensitive} onClick={() => setCaseSensitive(!caseSensitive)} label="Match case">
            <CaseSensitive className="size-4" />
          </ToggleButton>
          <ToggleButton active={wholeWord} onClick={() => setWholeWord(!wholeWord)} label="Match whole word">
            <WholeWord className="size-4" />
          </ToggleButton>
          <ToggleButton active={regexMode} onClick={() => setRegexMode(!regexMode)} label="Use regular expression">
            <Regex className="size-4" />
          </ToggleButton>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isFetching && !data ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">Searching...</div>
        ) : query.length < 2 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            Type at least 2 characters to search
          </div>
        ) : grouped.size === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">No results found</div>
        ) : (
          <div className="flex flex-col">
            {data?.truncated ? (
              <div className="px-3 py-1 text-xs text-yellow-400">
                Results capped at 1000 matches
              </div>
            ) : null}
            {Array.from(grouped).map(([filePath, matches]) => (
              <Collapsible key={filePath} defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs hover:bg-muted">
                  <ChevronRight className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                  <FileText className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{nameFromPath(filePath)}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                    {matches.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-col py-0.5 pl-4">
                    {matches.map((match, i) => (
                      <MatchLine
                        key={`${match.lineNumber}-${match.column}-${i}`}
                        match={match}
                        onClick={() => handleMatchClick(match)}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
