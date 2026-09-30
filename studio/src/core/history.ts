/** Immutable, bounded document history. Selection and view state stay outside it. */
export class History<T> {
  private past: { value: T; label: string }[] = [];
  private future: { value: T; label: string }[] = [];
  constructor(
    public current: T,
    private readonly capacity = 80,
  ) {}
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  get undoLabel() {
    return this.past.at(-1)?.label ?? "";
  }
  get redoLabel() {
    return this.future.at(-1)?.label ?? "";
  }
  commit(next: T, label: string) {
    if (JSON.stringify(this.current) === JSON.stringify(next)) return false;
    this.past.push({ value: this.current, label });
    if (this.past.length > this.capacity) this.past.shift();
    this.future = [];
    this.current = next;
    return true;
  }
  undo() {
    const entry = this.past.pop();
    if (!entry) return false;
    this.future.push({ value: this.current, label: entry.label });
    this.current = entry.value;
    return true;
  }
  redo() {
    const entry = this.future.pop();
    if (!entry) return false;
    this.past.push({ value: this.current, label: entry.label });
    this.current = entry.value;
    return true;
  }
}
