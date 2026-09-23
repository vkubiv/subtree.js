import { Navigate, Route, Routes, useNavigate } from "react-router";
import { Subtree, useObserver, useSubtree } from "subtree.js/react";
import { pick } from "trunk.js";
import { AppController, AppState } from "./app-controller";
import type { AppDeps } from "./app-deps";
import { HomeFlow } from "./flows/home/home-flow";
import { SignInFlow } from "./flows/sign-in/sign-in-flow";
import { SplashPage } from "./splash-page";

/** Render inside a router (`BrowserRouter` in `main.tsx`, `MemoryRouter` in tests). */
export function App({ deps }: { deps: AppDeps }) {
  return (
    <Subtree controller={() => new AppController(pick(deps, "authStorage", "loggedinUser", "pendingReauth"))}>
      <AppRoutes deps={deps} />
    </Subtree>
  );
}

function AppRoutes({ deps }: { deps: AppDeps }) {
  const state = useSubtree(AppState);
  const observer = useObserver();
  const navigate = useNavigate();

  const session = observer.watch(state.session);
  const reauthPending = observer.watch(state.reauthPending);
  if (session === "restoring") return <SplashPage />;

  const goHome = () => navigate("/", { replace: true });
  const goToSignIn = () => navigate("/sign-in", { replace: true });

  function authenticatedArea() {
    if (session === "anonymous") return <Navigate to="/sign-in" replace />;
    if (reauthPending) return <Navigate to="/sign-in/expired" replace />;
    return (
      <HomeFlow
        deps={pick(
          deps,
          "userApi",
          "authHandler",
          "profileRepository",
          "authStorage",
          "loggedinUser",
          "pendingReauth",
          "demo",
        )}
        routing={{ onSignedOut: goToSignIn }}
      />
    );
  }

  return (
    <Routes>
      <Route
        path="sign-in/*"
        element={
          <SignInFlow
            deps={pick(deps, "authApi", "authStorage", "loggedinUser", "pendingReauth", "profileRepository")}
            routing={{ onSignedIn: goHome }}
          />
        }
      />
      <Route path="*" element={authenticatedArea()} />
    </Routes>
  );
}
