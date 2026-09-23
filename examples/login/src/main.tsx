import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app";
import { createAppDeps } from "./app-deps";
import { DemoBackend } from "./backend-client/demo-backend";
import { LocalAuthStorage } from "./core/auth/auth-storage";

const deps = createAppDeps({
  backend: new DemoBackend({ latencyMs: 400 }),
  authStorage: new LocalAuthStorage(window.localStorage),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App deps={deps} />
    </BrowserRouter>
  </StrictMode>,
);
