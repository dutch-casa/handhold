// Edit history + dirty-tracking wrapper for editor domain values.

type EditCommand = {
  readonly description: string;
  readonly forward: () => void;
  readonly reverse: () => void;
};

export class EditHistory {
  private undoStack: EditCommand[] = [];
  private redoStack: EditCommand[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(cmd: EditCommand): void {
    cmd.forward();
    this.undoStack.push(cmd);
    this.redoStack = [];
  }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.reverse();
    this.redoStack.push(cmd);
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.forward();
    this.undoStack.push(cmd);
  }
}

export class Editable<T> {
  readonly history: EditHistory;
  private _original: T;
  private _current: T;
  private readonly eq: (a: T, b: T) => boolean;

  constructor(
    value: T,
    eq: (a: T, b: T) => boolean = (a, b) =>
      JSON.stringify(a) === JSON.stringify(b),
  ) {
    this._original = value;
    this._current = value;
    this.eq = eq;
    this.history = new EditHistory();
  }

  get original(): T {
    return this._original;
  }

  get current(): T {
    return this._current;
  }

  set current(value: T) {
    this._current = value;
  }

  get dirty(): boolean {
    return !this.eq(this._original, this._current);
  }

  markClean(): void {
    this._original = this._current;
  }
}
