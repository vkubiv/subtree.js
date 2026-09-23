import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { SubtreeModel } from "subtree.js/core";
import { SubtreeProvider } from "subtree.js/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileSectionActions, ProfileSectionState } from "../../sections/profile/profile-section-model";
import { HomeActions, HomeState } from "./home-model";
import { HomePage } from "./home-page";

function setup() {
  const model = new SubtreeModel();
  const state = model.put(HomeState, new HomeState());
  const profile = model.put(ProfileSectionState, new ProfileSectionState());
  const actions = model.put(HomeActions, { signOut: vi.fn(async () => {}), expireSession: vi.fn() });
  const profileActions = model.put(ProfileSectionActions, { reload: vi.fn(async () => {}) });
  render(
    <StrictMode>
      <SubtreeProvider model={model}>
        <HomePage />
      </SubtreeProvider>
    </StrictMode>,
  );
  return { state, profile, actions, profileActions };
}

describe("HomePage", () => {
  it("shows the loading state, then the profile, then an error", () => {
    const { profile } = setup();
    expect(screen.getByText("Loading profile…")).toBeTruthy();

    act(() => {
      profile.status.value = { kind: "loaded", profile: { id: "u", firstName: "Alice", lastName: "Demo" } };
    });
    expect(screen.getByTestId("profile-name").textContent).toBe("Alice Demo");

    act(() => {
      profile.status.value = { kind: "error", message: "boom" };
    });
    expect(screen.getByText("boom")).toBeTruthy();
  });

  it("shows the username and calls the actions", () => {
    const { state, actions, profileActions } = setup();
    act(() => {
      state.username.value = "alice";
    });
    expect(screen.getByText("alice")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    fireEvent.click(screen.getByRole("button", { name: "Expire session (demo)" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(profileActions.reload).toHaveBeenCalledTimes(1);
    expect(actions.expireSession).toHaveBeenCalledTimes(1);
    expect(actions.signOut).toHaveBeenCalledTimes(1);
  });
});
