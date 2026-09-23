import { Rx } from "subtree.js/core";

export type EditNoteStatus = "loading" | "ready" | "notFound";

export class EditNoteState {
  readonly status = new Rx<EditNoteStatus>("loading");
  readonly title = new Rx("");
  readonly content = new Rx("");
  /** Derived: ready and the title is not blank. */
  readonly canSave = new Rx(false);

  constructor(readonly isNew: boolean) {}
}

export abstract class EditNoteActions {
  abstract onTitleChanged(value: string): void;
  abstract onContentChanged(value: string): void;
  abstract save(): Promise<void>;
  abstract cancel(): void;
}
