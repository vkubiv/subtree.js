import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { SubtreeModel } from "subtree.js/core";
import { SubtreeProvider } from "subtree.js/react";
import { describe, expect, it, vi } from "vitest";
import { EditNoteActions, EditNoteState } from "./edit-note-model";
import { EditNotePage } from "./edit-note-page";

function setup(o: { isNew?: boolean; save?: () => Promise<void> } = {}) {
  const model = new SubtreeModel();
  const state = model.put(EditNoteState, new EditNoteState(o.isNew ?? false));
  const actions = model.put(EditNoteActions, {
    onTitleChanged: vi.fn(),
    onContentChanged: vi.fn(),
    save: vi.fn(o.save ?? (async () => {})),
    cancel: vi.fn(),
  });
  render(
    <StrictMode>
      <SubtreeProvider model={model}>
        <EditNotePage />
      </SubtreeProvider>
    </StrictMode>,
  );
  return { state, actions };
}

describe("EditNotePage", () => {
  it("shows loading, not-found, and the form by status", () => {
    const { state } = setup();
    expect(screen.getByRole("heading", { name: "Edit note" })).toBeTruthy();
    expect(screen.getByText("Loading…")).toBeTruthy();

    act(() => {
      state.status.value = "notFound";
    });
    expect(screen.getByText("This note no longer exists.")).toBeTruthy();

    act(() => {
      state.status.value = "ready";
      state.title.value = "One";
      state.content.value = "1";
    });
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("One");
    expect((screen.getByLabelText("Note") as HTMLTextAreaElement).value).toBe("1");
  });

  it("a new note has its own heading", () => {
    setup({ isNew: true });
    expect(screen.getByRole("heading", { name: "New note" })).toBeTruthy();
  });

  it("forwards typing and cancel to the actions", () => {
    const { state, actions } = setup();
    act(() => {
      state.status.value = "ready";
    });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "T" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "N" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(actions.onTitleChanged).toHaveBeenCalledWith("T");
    expect(actions.onContentChanged).toHaveBeenCalledWith("N");
    expect(actions.cancel).toHaveBeenCalledTimes(1);
  });

  it("Save is disabled until canSave, and while a save is in flight", async () => {
    let finish!: () => void;
    const { state, actions } = setup({ save: () => new Promise<void>((r) => (finish = r)) });
    act(() => {
      state.status.value = "ready";
    });
    const save = () => screen.getByRole("button", { name: /Save|Saving/ }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);

    act(() => {
      state.canSave.value = true;
    });
    expect(save().disabled).toBe(false);

    act(() => {
      fireEvent.click(save());
    });
    expect(actions.save).toHaveBeenCalledTimes(1);
    expect(save().textContent).toBe("Saving…");
    expect(save().disabled).toBe(true);

    await act(async () => {
      finish();
    });
    expect(save().textContent).toBe("Save");
    expect(save().disabled).toBe(false);
  });
});
