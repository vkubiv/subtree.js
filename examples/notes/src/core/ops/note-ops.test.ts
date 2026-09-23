import { hasError, unwrap } from "operation-result.js";
import { describe, expect, it, vi } from "vitest";
import { InMemoryNotesApi } from "../../backend-client/in-memory-notes-api";
import { NoteNotFound } from "../../backend-client/index";
import { NotesRepository } from "../repositories/notes-repository";
import { createNote, deleteNote, getNote, loadNotes, updateNote } from "./note-ops";

function setup() {
  const notesApi = new InMemoryNotesApi({ seed: [{ title: "One", content: "1" }] });
  const notesRepository = new NotesRepository();
  const changes = vi.fn();
  notesRepository.addListener(changes);
  return { notesApi, notesRepository, changes };
}

describe("note ops", () => {
  it("loadNotes fills the repository", async () => {
    const o = setup();
    expect(o.notesRepository.isLoaded).toBe(false);
    await loadNotes(o);
    expect(o.notesRepository.isLoaded).toBe(true);
    expect(o.notesRepository.notes.map((n) => n.title)).toEqual(["One"]);
    expect(o.changes).toHaveBeenCalledTimes(1);
  });

  it("getNote serves from the repository when it can, from the API otherwise", async () => {
    const o = setup();
    const get = vi.spyOn(o.notesApi, "get");

    const fromApi = unwrap(await getNote({ id: "note-1", ...o }));
    expect(fromApi.title).toBe("One");
    expect(get).toHaveBeenCalledTimes(1);
    expect(o.notesRepository.find("note-1")).toEqual(fromApi);

    unwrap(await getNote({ id: "note-1", ...o }));
    expect(get).toHaveBeenCalledTimes(1);

    const missing = await getNote({ id: "nope", ...o });
    expect(hasError(missing, NoteNotFound)).toBe(true);
  });

  it("createNote and updateNote write through to the repository", async () => {
    const o = setup();
    await loadNotes(o);
    const created = await createNote({ draft: { title: "Two", content: "2" }, ...o });
    expect(o.notesRepository.notes.map((n) => n.id)).toEqual(["note-1", created.id]);

    unwrap(await updateNote({ id: created.id, draft: { title: "Two!", content: "2" }, ...o }));
    expect(o.notesRepository.find(created.id)?.title).toBe("Two!");
  });

  it("updateNote of a vanished note reports NoteNotFound and drops it from the repository", async () => {
    const o = setup();
    await loadNotes(o);
    await o.notesApi.remove("note-1"); // behind the app's back
    const r = await updateNote({ id: "note-1", draft: { title: "x", content: "" }, ...o });
    expect(hasError(r, NoteNotFound)).toBe(true);
    expect(o.notesRepository.find("note-1")).toBeUndefined();
  });

  it("deleteNote removes from the API and the repository", async () => {
    const o = setup();
    await loadNotes(o);
    await deleteNote({ id: "note-1", ...o });
    expect(o.notesRepository.notes).toEqual([]);
    expect(await o.notesApi.list()).toEqual([]);
  });
});
