import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { SubtreeModel } from "subtree.js/core";
import { SubtreeProvider } from "subtree.js/react";
import { describe, expect, it, vi } from "vitest";
import { HomeActions, HomeState } from "./home-model";
import { HomePage } from "./home-page";

function setup() {
  const model = new SubtreeModel();
  const state = model.put(HomeState, new HomeState());
  const actions = model.put(HomeActions, {
    openNote: vi.fn(),
    addNote: vi.fn(),
    deleteNote: vi.fn(async () => {}),
  });
  render(
    <StrictMode>
      <SubtreeProvider model={model}>
        <HomePage />
      </SubtreeProvider>
    </StrictMode>,
  );
  return { state, actions };
}

describe("HomePage", () => {
  it("shows loading, then an empty hint, then the items", () => {
    const { state } = setup();
    expect(screen.getByText("Loading…")).toBeTruthy();

    act(() => {
      state.isLoaded.value = true;
    });
    expect(screen.getByText("No notes yet.")).toBeTruthy();

    act(() => {
      state.items.value = [
        { id: "a", title: "Alpha" },
        { id: "b", title: "Beta" },
      ];
    });
    expect(screen.queryByText("No notes yet.")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("calls the actions", () => {
    const { state, actions } = setup();
    act(() => {
      state.isLoaded.value = true;
      state.items.value = [{ id: "a", title: "Alpha" }];
    });
    fireEvent.click(screen.getByRole("button", { name: "New note" }));
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Alpha" }));
    expect(actions.addNote).toHaveBeenCalledTimes(1);
    expect(actions.openNote).toHaveBeenCalledWith("a");
    expect(actions.deleteNote).toHaveBeenCalledWith("a");
  });
});
