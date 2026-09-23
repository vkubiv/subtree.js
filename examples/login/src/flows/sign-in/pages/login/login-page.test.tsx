import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { SubtreeModel } from "subtree.js/core";
import { SubtreeProvider } from "subtree.js/react";
import { describe, expect, it, vi } from "vitest";
import { LoginActions, LoginState } from "./login-model";
import { LoginPage } from "./login-page";

/** Same shape as the Flutter `login_page_test.dart`: a real state, mocked actions, rendered through a provider. */
function setup() {
  const model = new SubtreeModel();
  const state = model.put(LoginState, new LoginState());
  const actions = model.put(LoginActions, {
    onUsernameChanged: vi.fn(),
    onPasswordChanged: vi.fn(),
    submit: vi.fn(async () => {}),
  });
  render(
    <StrictMode>
      <SubtreeProvider model={model}>
        <LoginPage />
      </SubtreeProvider>
    </StrictMode>,
  );
  return { state, actions };
}

describe("LoginPage", () => {
  it("forwards typing to the actions", () => {
    const { actions } = setup();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    expect(actions.onUsernameChanged).toHaveBeenCalledWith("alice");
    expect(actions.onPasswordChanged).toHaveBeenCalledWith("pw");
  });

  it("shows state: values, validation messages, button enablement", () => {
    const { state } = setup();
    const button = screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    act(() => {
      state.username.value = "alice";
      state.usernameError.value = "Enter your username";
      state.canSubmit.value = true;
    });
    expect((screen.getByLabelText("Username") as HTMLInputElement).value).toBe("alice");
    expect(screen.getByText("Enter your username")).toBeTruthy();
    expect(button.disabled).toBe(false);
  });

  it("calls submit on click and shows progress while submitting", () => {
    const { state, actions } = setup();
    act(() => {
      state.canSubmit.value = true;
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(actions.submit).toHaveBeenCalledTimes(1);

    act(() => {
      state.isSubmitting.value = true;
    });
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.getByText("Signing in…")).toBeTruthy();
  });

  it("shows a failure event as an alert", () => {
    const { state } = setup();
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => state.failed.emit("Login or password is incorrect"));
    expect(screen.getByRole("alert").textContent).toBe("Login or password is incorrect");
  });
});
