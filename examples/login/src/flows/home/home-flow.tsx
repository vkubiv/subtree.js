import { Route, Routes } from "react-router";
import { Subtree } from "subtree.js/react";
import type { AppDeps } from "../../app-deps";
import { HomeController } from "./pages/home/home-controller";
import { HomePage } from "./pages/home/home-page";

export type HomeFlowDeps = Pick<
  AppDeps,
  "userApi" | "authHandler" | "profileRepository" | "authStorage" | "loggedinUser" | "pendingReauth" | "demo"
>;

export interface HomeFlowRouting {
  onSignedOut(): void;
}

/** The signed-in area. One page today; more routes would go next to it. */
export function HomeFlow({ deps, routing }: { deps: HomeFlowDeps; routing: HomeFlowRouting }) {
  return (
    <Routes>
      <Route
        index
        element={
          <Subtree controller={() => new HomeController(deps, routing)}>
            <HomePage />
          </Subtree>
        }
      />
    </Routes>
  );
}
