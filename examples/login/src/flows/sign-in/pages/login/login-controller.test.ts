import { fail, ok, type Result } from "operation-result.js";
import { describe, expect, it, vi } from "vitest";
import { InvalidCredentials, type LoginResponse } from "../../../../backend-client";
import { MemoryAuthStorage } from "../../../../core/auth/auth-storage";
import { LoggedinUser } from "../../../../core/auth/loggedin-user";
import { deferred } from "../../../../testing/async";
import { LoginController } from "./login-controller";

/** Same shape as the Flutter `login_controller_test.dart`: fake deps, spy routing, drive actions, assert state. */
function setup() {
  const login = deferred<Result<LoginResponse, InvalidCredentials>>();
  const deps = {
    authApi: { login: vi.fn(() => login.promise) },
    authStorage: new MemoryAuthStorage(),
    loggedinUser: new LoggedinUser(),
  };
  const routing = { onSignedIn: vi.fn() };
  const controller = new LoginController(deps, routing);
  return { controller, state: controller.state, deps, routing, login };
}

describe("LoginController", () => {
  it("starts empty and not submittable", () => {
    const { state } = setup();
    expect(state.username.value).toBe("");
    expect(state.canSubmit.value).toBe(false);
    expect(state.usernameError.value).toBeNull();
  });

  it("validates as the user types and derives canSubmit", () => {
    const { controller, state } = setup();
    controller.onUsernameChanged("alice");
    expect(state.usernameError.value).toBeNull();
    expect(state.canSubmit.value).toBe(false);

    controller.onPasswordChanged("");
    expect(state.passwordError.value).toBe("Enter your password");

    controller.onPasswordChanged("pw");
    expect(state.passwordError.value).toBeNull();
    expect(state.canSubmit.value).toBe(true);
  });

  it("submit: in progress, then signed in and routed", async () => {
    const { controller, state, deps, routing, login } = setup();
    controller.onUsernameChanged("alice");
    controller.onPasswordChanged("pw");

    const submitted = controller.submit();
    expect(state.isSubmitting.value).toBe(true);
    expect(state.canSubmit.value).toBe(false);
    expect(deps.authApi.login).toHaveBeenCalledWith("alice", "pw");

    login.resolve(ok({ token: "t", userId: "u" }));
    await submitted;

    expect(state.isSubmitting.value).toBe(false);
    expect(deps.loggedinUser.username).toBe("alice");
    expect(routing.onSignedIn).toHaveBeenCalledTimes(1);
    expect(state.failed.value).toBeUndefined();
  });

  it("submit: wrong credentials emit a failure and stay on the page", async () => {
    const { controller, state, deps, routing, login } = setup();
    controller.onUsernameChanged("alice");
    controller.onPasswordChanged("fail");
    const failures: string[] = [];
    state.failed.addListener(() => failures.push(state.failed.value!));

    const submitted = controller.submit();
    login.resolve(fail(new InvalidCredentials()));
    await submitted;

    expect(failures).toEqual(["Login or password is incorrect"]);
    expect(state.isSubmitting.value).toBe(false);
    expect(deps.loggedinUser.isLoggedIn).toBe(false);
    expect(routing.onSignedIn).not.toHaveBeenCalled();
  });

  it("submit is ignored while the form is invalid", async () => {
    const { controller, deps } = setup();
    await controller.submit();
    expect(deps.authApi.login).not.toHaveBeenCalled();
  });

  it("dispose stops the derived-state block", () => {
    const { controller, state } = setup();
    controller.dispose();
    controller.onUsernameChanged("alice");
    controller.onPasswordChanged("pw");
    expect(state.canSubmit.value).toBe(false);
  });
});
