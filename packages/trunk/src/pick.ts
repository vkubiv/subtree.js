/**
 * Narrow a dependencies object to the keys a flow or page declares.
 *
 * Structural typing already lets a superset be passed where a subset is expected;
 * `pick` makes the narrowing real at runtime, so a flow cannot reach what it did
 * not declare, and tests can see exactly what a page receives.
 *
 * ```ts
 * type SignInFlowDeps = Pick<AppDeps, "authStorage" | "loggedinUser" | "authApi">;
 * const flowDeps = pick(appDeps, "authStorage", "loggedinUser", "authApi");
 * ```
 */
export function pick<T extends object, K extends keyof T>(source: T, ...keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    if (!(key in source)) {
      throw new Error(`pick(): "${String(key)}" is missing on the source object`);
    }
    out[key] = source[key];
  }
  return out;
}
