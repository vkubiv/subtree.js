# subtree.js monorepo

Three packages that together support one application architecture for TypeScript and
React, the counterpart of the Flutter stack `subtree` + `immutable_di` + `operation_result`.

| Package | What it is | Depends on |
|---|---|---|
| [`subtree.js`](packages/subtree) | State management: `Rx` fields, controllers with `sync`/`subscribe`, per-page `SubtreeModel`, React bindings with explicit `observer.watch`. Entry points `subtree.js/core` (no React) and `subtree.js/react`. | React 18+ (react entry only) |
| [`trunk.js`](packages/trunk) | Application structure: `pick()` for typed dependency narrowing, `AuthHandler` with retry-after-reauth, the Deps/Routing/Flow conventions. | `operation-result.js` |
| [`operation-result.js`](packages/operation-result) | `Result<T, E>` with a union of error classes; `ok`, `fail`, `hasError`, `forward`, `unwrap`. | nothing |

Docs:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the architecture the packages enable.
- [docs/AI_INSTRUCTIONS.md](docs/AI_INSTRUCTIONS.md): the condensed manual to copy into an app's `CLAUDE.md`.
- [docs/subtree.md](docs/subtree.md), [docs/operation-result.md](docs/operation-result.md): library references. `trunk.js` is documented in its [README](packages/trunk/README.md).
- [docs/PLAN.md](docs/PLAN.md): analysis of the previous port, design decisions, roadmap and status.

Examples (ports of the Flutter `subtree/full_examples`, each a Vite app with tests at
every level):

| Example | Shows |
|---|---|
| [`examples/login`](examples/login) | Fake backend-client with `Result` everywhere, `AuthHandler` with re-authentication of parked calls, two flows, a section, ops / controller / page / flow tests. |
| [`examples/notes`](examples/notes) | List and editor, repository mirrored into state with `sync`, ops over a fake API, a route parameter as controller identity. |

```
npm run dev -w example-login     # or example-notes
```

## Development

```
npm install
npm run check      # typecheck, lint (biome), tests (vitest, with type tests), build (tsup)
npm run test:watch
```

Node 20+, npm workspaces. Each package has `build`, `typecheck` and `test` scripts.
