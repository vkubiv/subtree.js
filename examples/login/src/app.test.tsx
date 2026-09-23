import { act, fireEvent, render, screen } from "@testing-library/react";
import { unwrap } from "operation-result.js";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { App } from "./app";
import { createAppDeps } from "./app-deps";
import { DemoBackend } from "./backend-client/demo-backend";
import { type AuthStorage, MemoryAuthStorage } from "./core/auth/auth-storage";
import { flush } from "./testing/async";

/** The flow test: real deps (demo backend, memory storage), the app inside a MemoryRouter. */
function renderApp(o: { authStorage?: AuthStorage; backend?: DemoBackend } = {}) {
  const backend = o.backend ?? new DemoBackend();
  const deps = createAppDeps({ backend, authStorage: o.authStorage ?? new MemoryAuthStorage() });
  render(
    <StrictMode>
      <MemoryRouter>
        <App deps={deps} />
      </MemoryRouter>
    </StrictMode>,
  );
  return { backend, deps };
}

/**
 * Wait for a page, then let its effects settle: under StrictMode the controller
 * built during the first render is replaced from an effect, and input typed
 * before that effect ran would go to the discarded one.
 */
async function onPage(heading: string) {
  await screen.findByRole("heading", { name: heading });
  await act(flush);
}

async function profileName(): Promise<string | null> {
  const name = (await screen.findByTestId("profile-name")).textContent;
  await act(flush);
  return name;
}

// Explicit `act`: state written by a controller reaches the DOM synchronously, so the next
// step can rely on it (a button enabled by validation, for example).
const type = (label: string, value: string) =>
  act(() => fireEvent.change(screen.getByLabelText(label), { target: { value } }));
const click = (name: string) => act(() => fireEvent.click(screen.getByRole("button", { name })));

describe("App", () => {
  it("shows the splash, then the sign-in page when nothing is stored", async () => {
    renderApp();
    expect(screen.getByText("Loading…")).toBeTruthy();
    await onPage("Sign in");
  });

  it("restores a stored session straight into home", async () => {
    const backend = new DemoBackend();
    const login = unwrap(await backend.auth.login("bob", "pw"));
    renderApp({
      backend,
      authStorage: new MemoryAuthStorage({ token: login.token, userId: login.userId, username: "bob" }),
    });
    await onPage("Home");
    expect(await profileName()).toBe("Bob Demo");
  });

  it("rejects wrong credentials and stays on the sign-in page", async () => {
    renderApp();
    await onPage("Sign in");
    type("Username", "alice");
    type("Password", "fail");
    click("Sign in");
    expect((await screen.findByRole("alert")).textContent).toBe("Login or password is incorrect");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("signs in, survives an expired session through re-auth, and signs out", async () => {
    const { deps } = renderApp();
    await onPage("Sign in");
    type("Username", "alice");
    type("Password", "pw");
    click("Sign in");
    await onPage("Home");
    expect(await profileName()).toBe("Alice Demo");

    // The server forgets the token; the next call parks itself and the app asks for the password.
    click("Expire session (demo)");
    click("Reload");
    await onPage("Session expired");
    expect(deps.pendingReauth.count).toBe(1);

    type("Password", "fail");
    click("Continue");
    await screen.findByText("Login or password is incorrect");
    expect(deps.pendingReauth.count).toBe(1);

    type("Password", "pw");
    click("Continue");
    // Back home, and the parked call finished on its own: nothing had to be requested again.
    await onPage("Home");
    expect(await profileName()).toBe("Alice Demo");
    expect(deps.pendingReauth.isPending).toBe(false);

    click("Sign out");
    await onPage("Sign in");
    expect(deps.loggedinUser.isLoggedIn).toBe(false);
    expect(await deps.authStorage.load()).toBeNull();
  });

  it("giving up on re-auth signs out", async () => {
    const { deps } = renderApp();
    await onPage("Sign in");
    type("Username", "alice");
    type("Password", "pw");
    click("Sign in");
    await onPage("Home");
    await profileName();

    click("Expire session (demo)");
    click("Reload");
    await onPage("Session expired");
    click("Sign out");
    await onPage("Sign in");
    expect(deps.pendingReauth.isPending).toBe(false);
    expect(deps.profileRepository.status.kind).toBe("idle");
  });
});
