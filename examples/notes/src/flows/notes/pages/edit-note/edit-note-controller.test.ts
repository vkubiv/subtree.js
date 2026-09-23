import { describe, expect, it, vi } from "vitest";
import { createAppDeps } from "../../../../app-deps";
import { InMemoryNotesApi } from "../../../../backend-client/in-memory-notes-api";
import { flush } from "../../../../testing/async";
import { EditNoteController } from "./edit-note-controller";

function setup(noteId: string | null) {
  const deps = createAppDeps({ notesApi: new InMemoryNotesApi({ seed: [{ title: "One", content: "1" }] }) });
  const routing = { goBack: vi.fn() };
  const controller = new EditNoteController({ noteId }, deps, routing);
  return { deps, routing, controller, state: controller.state };
}

describe("EditNoteController", () => {
  it("a new note starts ready and empty; save needs a title", async () => {
    const { controller, state, deps, routing } = setup(null);
    expect(state.isNew).toBe(true);
    expect(state.status.value).toBe("ready");
    expect(state.canSave.value).toBe(false);

    await controller.save();
    expect(routing.goBack).not.toHaveBeenCalled();

    controller.onTitleChanged("  Two ");
    controller.onContentChanged("2");
    expect(state.canSave.value).toBe(true);
    await controller.save();

    expect(deps.notesRepository.notes.map((n) => n.title)).toEqual(["Two"]);
    expect(routing.goBack).toHaveBeenCalledTimes(1);
  });

  it("an existing note loads, then saves an update", async () => {
    const { controller, state, deps, routing } = setup("note-1");
    expect(state.isNew).toBe(false);
    expect(state.status.value).toBe("loading");
    expect(state.canSave.value).toBe(false);
    await flush();
    expect(state.status.value).toBe("ready");
    expect(state.title.value).toBe("One");
    expect(state.content.value).toBe("1");
    expect(state.canSave.value).toBe(true);

    controller.onContentChanged("one, edited");
    await controller.save();
    expect(deps.notesRepository.find("note-1")?.content).toBe("one, edited");
    expect(routing.goBack).toHaveBeenCalledTimes(1);
  });

  it("a missing note is state, not a crash", async () => {
    const { state, routing } = setup("nope");
    await flush();
    expect(state.status.value).toBe("notFound");
    expect(state.canSave.value).toBe(false);
    expect(routing.goBack).not.toHaveBeenCalled();
  });

  it("a note deleted meanwhile turns into notFound on save", async () => {
    const { controller, state, deps, routing } = setup("note-1");
    await flush();
    await deps.notesApi.remove("note-1");
    await controller.save();
    expect(state.status.value).toBe("notFound");
    expect(routing.goBack).not.toHaveBeenCalled();
  });

  it("cancel routes back; a load finishing after dispose is ignored", async () => {
    const { controller, state, routing } = setup("note-1");
    controller.cancel();
    expect(routing.goBack).toHaveBeenCalledTimes(1);
    controller.dispose();
    await flush();
    expect(state.status.value).toBe("loading");
  });
});
