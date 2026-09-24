# Changelog

## Repository (2026-09-23)

- `examples/login` and `examples/notes`: ports of the Flutter `full_examples` with ops,
  controller, page and flow tests.
- `docs/AI_INSTRUCTIONS.md` (the manual for an app's `CLAUDE.md`), `docs/subtree.md` and
  `docs/operation-result.md` (library references), next to `docs/ARCHITECTURE.md`.

## subtree.js 2.0.0-alpha.0 (2026-09-23)

Rewrite as a monorepo package with `core` and `react` entry points. Breaking.

- `Rx.value` getter no longer throws; `snapshot` is gone. Controllers use `.value`.
- `RxList`, `RxEvent`, `ReactiveBlock`, `watchable()` added.
- `BaseController` with `sync`, `subscribe`, `autoDispose`, `own`, `isDisposed`;
  `SubtreeController` extends it. `sync`/`subscribe` return a `Subscription`
  (`cancel()`, `ready`).
- `SubtreeModel.put` throws on duplicates; `get` no longer treats falsy instances as
  missing and its error names the two usual causes (not `put`, or a `<Subtree>` reused
  across sibling routes without a `key`); `has` added; string identifiers replaced by
  `token<T>()`.
- `<Subtree>` no longer disposes the controller on parent re-render (bug), gains a
  `deps` prop, and survives React StrictMode.
- `useObserver` subscribes in an effect instead of during render; `disableUntilCompleted`
  added. `obs()` replaced by `<Obs>`.
- `useSubtree` returns `View<T>`: reactive fields are `Watchable` without `.value`.
- `useWatch`, `useRxEvent`, `SubtreeProvider` added.
- ESM + CJS builds with type declarations; React 18+.

## trunk.js 1.0.0-alpha.0 (2026-09-23)

- `pick()`.
- `AuthHandler` / `AuthenticatedCall` / `PendingCall`, ported from btb-neo with
  `cancel()` resolving to the auth-failed result instead of throwing.
- `AppError` base class and `ApiNotAuthorized`, the error `AuthHandler` recognises.

## operation-result.js 1.0.0 (2026-09-23)

- `Result`, `AsyncResult`, `ok`, `fail`, `fails`, `isOk`, `isFailed`, `hasError`,
  `hasSingleError`, `getError`, `getErrors`, `unwrap`, `ensureSuccess`, `forward`,
  `mapValue`, `mapErrors`, `describeErrors`, `UnhandledErrors`.
