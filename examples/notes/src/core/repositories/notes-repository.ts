import { ChangeNotifier } from "subtree.js/core";
import type { Note } from "../../backend-client";

/**
 * The notes the app has seen, in memory. Ops write it after every API call;
 * controllers `sync` on it. It replaces the `ControllerNotifier` the Flutter
 * example used to tell the list that something changed: the data itself is the
 * signal.
 */
export class NotesRepository extends ChangeNotifier {
  #notes: readonly Note[] = [];
  #isLoaded = false;

  /** False until the first successful `setAll`. */
  get isLoaded(): boolean {
    return this.#isLoaded;
  }

  get notes(): readonly Note[] {
    return this.#notes;
  }

  find(id: string): Note | undefined {
    return this.#notes.find((n) => n.id === id);
  }

  setAll(notes: readonly Note[]): void {
    this.#notes = [...notes];
    this.#isLoaded = true;
    this.notifyListeners();
  }

  upsert(note: Note): void {
    this.#notes = this.#notes.some((n) => n.id === note.id)
      ? this.#notes.map((n) => (n.id === note.id ? note : n))
      : [...this.#notes, note];
    this.notifyListeners();
  }

  remove(id: string): void {
    if (!this.#notes.some((n) => n.id === id)) return;
    this.#notes = this.#notes.filter((n) => n.id !== id);
    this.notifyListeners();
  }
}
