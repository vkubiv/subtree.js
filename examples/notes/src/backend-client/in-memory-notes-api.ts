import { type AsyncResult, fail, ok } from "operation-result.js";
import { type Note, type NoteDraft, NoteNotFound, type NotesApi } from "./index";

/** The stand-in for a real backend: a list in memory behind simulated latency. */
export class InMemoryNotesApi implements NotesApi {
  readonly #latencyMs: number;
  readonly #notes = new Map<string, Note>();
  #nextId = 1;

  constructor(o: { latencyMs?: number; seed?: readonly NoteDraft[] } = {}) {
    this.#latencyMs = o.latencyMs ?? 0;
    for (const draft of o.seed ?? []) this.#insert(draft);
  }

  async list(): Promise<readonly Note[]> {
    await this.#delay();
    return [...this.#notes.values()];
  }

  async get(id: string): AsyncResult<Note, NoteNotFound> {
    await this.#delay();
    const note = this.#notes.get(id);
    return note === undefined ? fail(new NoteNotFound(id)) : ok(note);
  }

  async create(draft: NoteDraft): Promise<Note> {
    await this.#delay();
    return this.#insert(draft);
  }

  async update(id: string, draft: NoteDraft): AsyncResult<Note, NoteNotFound> {
    await this.#delay();
    if (!this.#notes.has(id)) return fail(new NoteNotFound(id));
    const note: Note = { id, ...draft };
    this.#notes.set(id, note);
    return ok(note);
  }

  async remove(id: string): Promise<void> {
    await this.#delay();
    this.#notes.delete(id);
  }

  #insert(draft: NoteDraft): Note {
    const note: Note = { id: `note-${this.#nextId++}`, ...draft };
    this.#notes.set(note.id, note);
    return note;
  }

  /** Zero latency resolves in a microtask, so tests can `await` a macrotask tick and see the outcome. */
  #delay(): Promise<void> {
    if (this.#latencyMs === 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, this.#latencyMs));
  }
}
