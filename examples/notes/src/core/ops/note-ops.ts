import { type AsyncResult, ok } from "operation-result.js";
import type { Note, NoteDraft, NoteNotFound, NotesApi } from "../../backend-client";
import type { NotesRepository } from "../repositories/notes-repository";

export async function loadNotes(o: { notesApi: NotesApi; notesRepository: NotesRepository }): Promise<void> {
  o.notesRepository.setAll(await o.notesApi.list());
}

/** From the repository when it has the note, from the API otherwise. */
export async function getNote(o: {
  id: string;
  notesApi: NotesApi;
  notesRepository: NotesRepository;
}): AsyncResult<Note, NoteNotFound> {
  const cached = o.notesRepository.find(o.id);
  if (cached !== undefined) return ok(cached);
  const r = await o.notesApi.get(o.id);
  if (r.ok) o.notesRepository.upsert(r.value);
  return r;
}

export async function createNote(o: {
  draft: NoteDraft;
  notesApi: NotesApi;
  notesRepository: NotesRepository;
}): Promise<Note> {
  const note = await o.notesApi.create(o.draft);
  o.notesRepository.upsert(note);
  return note;
}

export async function updateNote(o: {
  id: string;
  draft: NoteDraft;
  notesApi: NotesApi;
  notesRepository: NotesRepository;
}): AsyncResult<Note, NoteNotFound> {
  const r = await o.notesApi.update(o.id, o.draft);
  if (r.ok) o.notesRepository.upsert(r.value);
  else o.notesRepository.remove(o.id);
  return r;
}

export async function deleteNote(o: {
  id: string;
  notesApi: NotesApi;
  notesRepository: NotesRepository;
}): Promise<void> {
  await o.notesApi.remove(o.id);
  o.notesRepository.remove(o.id);
}
