import { describe, expect, it, vi } from "vitest";
import { createAppDeps } from "../../../../app-deps";
import { InMemoryNotesApi } from "../../../../backend-client/in-memory-notes-api";
import { flush } from "../../../../testing/async";
import { HomeController } from "./home-controller";

function setup() {
  const deps = createAppDeps({
    notesApi: new InMemoryNotesApi({
      seed: [
        { title: "One", content: "1" },
        { title: "", content: "no title" },
      ],
    }),
  });
  const routing = { goToNote: vi.fn(), goToAddNote: vi.fn() };
  const controller = new HomeController(deps, routing);
  return { deps, routing, controller, state: controller.state };
}

describe("HomeController", () => {
  it("loads the notes once and mirrors the repository into state", async () => {
    const { state } = setup();
    expect(state.isLoaded.value).toBe(false);
    await flush();
    expect(state.isLoaded.value).toBe(true);
    expect(state.items.value).toEqual([
      { id: "note-1", title: "One" },
      { id: "note-2", title: "(untitled)" },
    ]);
  });

  it("does not reload when the repository is already loaded", async () => {
    const notesApi = new InMemoryNotesApi();
    const list = vi.spyOn(notesApi, "list");
    const deps = createAppDeps({ notesApi });
    deps.notesRepository.setAll([{ id: "x", title: "Cached", content: "" }]);
    const controller = new HomeController(deps, { goToNote: vi.fn(), goToAddNote: vi.fn() });
    await flush();
    expect(list).not.toHaveBeenCalled();
    expect(controller.state.items.value).toEqual([{ id: "x", title: "Cached" }]);
  });

  it("follows repository changes made elsewhere (the editor saving)", async () => {
    const { deps, state } = setup();
    await flush();
    deps.notesRepository.upsert({ id: "note-9", title: "Nine", content: "" });
    await flush();
    expect(state.items.value.map((i) => i.id)).toEqual(["note-1", "note-2", "note-9"]);
  });

  it("navigates through routing and deletes through the op", async () => {
    const { controller, routing, deps, state } = setup();
    await flush();
    controller.openNote("note-1");
    controller.addNote();
    expect(routing.goToNote).toHaveBeenCalledWith("note-1");
    expect(routing.goToAddNote).toHaveBeenCalledTimes(1);

    await controller.deleteNote("note-1");
    await flush();
    expect(deps.notesRepository.find("note-1")).toBeUndefined();
    expect(state.items.value.map((i) => i.id)).toEqual(["note-2"]);
  });

  it("stops mirroring after dispose", async () => {
    const { controller, deps, state } = setup();
    await flush();
    controller.dispose();
    deps.notesRepository.upsert({ id: "late", title: "Late", content: "" });
    await flush();
    expect(state.items.value.map((i) => i.id)).toEqual(["note-1", "note-2"]);
  });
});
