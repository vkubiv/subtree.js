import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { App } from "./app";
import { createAppDeps } from "./app-deps";
import { InMemoryNotesApi } from "./backend-client/in-memory-notes-api";
import { flush } from "./testing/async";

/** The flow test: real deps (in-memory API), the app inside a MemoryRouter. */
function renderApp(initialPath = "/") {
  const notesApi = new InMemoryNotesApi({ seed: [{ title: "One", content: "first" }] });
  const deps = createAppDeps({ notesApi });
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[initialPath]}>
        <App deps={deps} />
      </MemoryRouter>
    </StrictMode>,
  );
  return { deps, notesApi };
}

/** Wait for a page, then let its effects settle (see the login example for why). */
async function onPage(heading: string) {
  await screen.findByRole("heading", { name: heading });
  await act(flush);
}

const type = (label: string, value: string) =>
  act(() => fireEvent.change(screen.getByLabelText(label), { target: { value } }));
const click = (name: string | RegExp) => act(() => fireEvent.click(screen.getByRole("button", { name })));

describe("App", () => {
  it("lists the notes, creates one, edits it, deletes it", async () => {
    const { deps } = renderApp();
    await onPage("Notes");
    await screen.findByRole("button", { name: "One" });

    click("New note");
    await onPage("New note");
    type("Title", "Two");
    type("Note", "second");
    click("Save");
    await onPage("Notes");
    await screen.findByRole("button", { name: "Two" });
    expect(deps.notesRepository.notes.map((n) => n.title)).toEqual(["One", "Two"]);

    click("Two");
    await onPage("Edit note");
    expect(((await screen.findByLabelText("Title")) as HTMLInputElement).value).toBe("Two");
    await act(flush);
    type("Title", "Two, edited");
    click("Save");
    await onPage("Notes");
    await screen.findByRole("button", { name: "Two, edited" });

    click("Delete Two, edited");
    await act(flush);
    expect(screen.queryByRole("button", { name: "Two, edited" })).toBeNull();
    expect(deps.notesRepository.notes.map((n) => n.title)).toEqual(["One"]);
  });

  it("opening a note by URL that does not exist shows the not-found state", async () => {
    renderApp("/note/nope");
    await onPage("Edit note");
    await screen.findByText("This note no longer exists.");
    click("Back");
    await onPage("Notes");
  });

  it("cancel leaves the editor without saving", async () => {
    const { deps } = renderApp("/note/new");
    await onPage("New note");
    type("Title", "Draft");
    click("Cancel");
    await onPage("Notes");
    expect(deps.notesRepository.notes.map((n) => n.title)).toEqual(["One"]);
  });
});
