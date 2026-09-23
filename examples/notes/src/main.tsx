import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app";
import { createAppDeps } from "./app-deps";
import { InMemoryNotesApi } from "./backend-client/in-memory-notes-api";

const deps = createAppDeps({
  notesApi: new InMemoryNotesApi({
    latencyMs: 300,
    seed: [
      { title: "Groceries", content: "Milk, eggs, bread" },
      { title: "Ideas", content: "A notes app that proves an architecture" },
    ],
  }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App deps={deps} />
    </BrowserRouter>
  </StrictMode>,
);
