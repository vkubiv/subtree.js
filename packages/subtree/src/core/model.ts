declare const TOKEN_TYPE: unique symbol;

/** A symbol carrying a type, for registering interfaces that have no class. */
export type TypedSymbol<T> = symbol & { readonly [TOKEN_TYPE]?: T };

/**
 * What identifies an instance in a `SubtreeModel`: a class (concrete or abstract)
 * or a typed symbol from `token<T>()`.
 */
// biome-ignore lint/suspicious/noExplicitAny: any constructor signature
export type Token<T> = (abstract new (...args: any[]) => T) | TypedSymbol<T>;

/** Create a typed symbol token: `const Api = token<UserApi>("UserApi")`. */
export function token<T>(description: string): TypedSymbol<T> {
  return Symbol(description) as TypedSymbol<T>;
}

function tokenName(t: Token<unknown>): string {
  if (typeof t === "function") return t.name || "<anonymous class>";
  return t.description ?? String(t);
}

/**
 * The per-page registry. A controller `put`s its state and actions; the page reads
 * them with `useSubtree(Token)`. One instance per token; duplicates and misses throw
 * so wiring mistakes surface immediately.
 */
export class SubtreeModel {
  readonly #instances = new Map<Token<unknown>, unknown>();

  put<T>(token: Token<T>, instance: T): T {
    if (this.#instances.has(token)) {
      throw new Error(
        `Subtree model already contains ${tokenName(token)}.\n(Did you put it twice, or put two things under the same token?)`,
      );
    }
    this.#instances.set(token, instance);
    return instance;
  }

  get<T>(token: Token<T>): T {
    if (!this.#instances.has(token)) {
      throw new Error(
        `${tokenName(token)} is not in the subtree model.\n(Did you forget to put it in the controller? Or does a <Subtree> at this position still hold another page's controller: sibling routes need a key.)`,
      );
    }
    return this.#instances.get(token) as T;
  }

  has(token: Token<unknown>): boolean {
    return this.#instances.has(token);
  }
}
