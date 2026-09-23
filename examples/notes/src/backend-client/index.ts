/**
 * The contract of the notes backend-client. Stateless; expected failures are
 * `Result` errors, unexpected ones throw. Reads that cannot fail in an expected
 * way return a plain `Promise`.
 */
import type { AsyncResult } from "operation-result.js";
import { AppError } from "trunk.js";

export interface Note {
  readonly id: string;
  readonly title: string;
  readonly content: string;
}

export interface NoteDraft {
  readonly title: string;
  readonly content: string;
}

export class NoteNotFound extends AppError {
  constructor(readonly id: string) {
    super(`Note ${id} does not exist`);
  }
}

export interface NotesApi {
  list(): Promise<readonly Note[]>;
  get(id: string): AsyncResult<Note, NoteNotFound>;
  create(draft: NoteDraft): Promise<Note>;
  update(id: string, draft: NoteDraft): AsyncResult<Note, NoteNotFound>;
  /** Idempotent: removing a note that is already gone is a success. */
  remove(id: string): Promise<void>;
}
