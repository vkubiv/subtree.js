import { Route, Routes, useNavigate } from "react-router";
import { Subtree } from "subtree.js/react";
import { pick } from "trunk.js";
import type { AppDeps } from "../../app-deps";
import { LoginController } from "./pages/login/login-controller";
import { LoginPage } from "./pages/login/login-page";
import { SessionExpiredController } from "./pages/session-expired/session-expired-controller";
import { SessionExpiredPage } from "./pages/session-expired/session-expired-page";

export type SignInFlowDeps = Pick<
  AppDeps,
  "authApi" | "authStorage" | "loggedinUser" | "pendingReauth" | "profileRepository"
>;

export interface SignInFlowRouting {
  onSignedIn(): void;
}

/**
 * Two pages: the sign-in form, and the session-expired form that `AuthHandler`
 * sends the user to when a call comes back with `ApiNotAuthorized`.
 *
 * Each `<Subtree>` gets a `key`: sibling routes render at the same position in
 * the React tree, and without a key React would keep the previous route's
 * controller for the next route's page.
 */
export function SignInFlow({ deps, routing }: { deps: SignInFlowDeps; routing: SignInFlowRouting }) {
  const navigate = useNavigate();
  return (
    <Routes>
      <Route
        index
        element={
          <Subtree
            key="login"
            controller={() =>
              new LoginController(pick(deps, "authApi", "authStorage", "loggedinUser"), {
                onSignedIn: routing.onSignedIn,
              })
            }
          >
            <LoginPage />
          </Subtree>
        }
      />
      <Route
        path="expired"
        element={
          <Subtree
            key="expired"
            controller={() =>
              new SessionExpiredController(
                pick(deps, "authApi", "authStorage", "loggedinUser", "pendingReauth", "profileRepository"),
                {
                  onReauthenticated: routing.onSignedIn,
                  onSignedOut: () => navigate("/sign-in", { replace: true }),
                },
              )
            }
          >
            <SessionExpiredPage />
          </Subtree>
        }
      />
    </Routes>
  );
}
