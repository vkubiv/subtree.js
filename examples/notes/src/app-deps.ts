import type { NotesApi } from "./backend-client";
import { NotesRepository } from "./core/repositories/notes-repository";

export interface AppDeps {
  readonly notesApi: NotesApi;
  readonly notesRepository: NotesRepository;
}

export function createAppDeps(o: { notesApi: NotesApi }): AppDeps {
  return { notesApi: o.notesApi, notesRepository: new NotesRepository() };
}
