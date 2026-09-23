export interface AuthData {
  readonly token: string;
  readonly userId: string;
  readonly username: string;
}

/** Where the session survives a reload. */
export interface AuthStorage {
  load(): Promise<AuthData | null>;
  save(data: AuthData): Promise<void>;
  clear(): Promise<void>;
}

export class LocalAuthStorage implements AuthStorage {
  readonly #storage: Storage;
  readonly #key: string;

  constructor(storage: Storage, key = "login-example.auth") {
    this.#storage = storage;
    this.#key = key;
  }

  async load(): Promise<AuthData | null> {
    const raw = this.#storage.getItem(this.#key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as AuthData;
    } catch {
      return null;
    }
  }

  async save(data: AuthData): Promise<void> {
    this.#storage.setItem(this.#key, JSON.stringify(data));
  }

  async clear(): Promise<void> {
    this.#storage.removeItem(this.#key);
  }
}

/** For tests and stories. */
export class MemoryAuthStorage implements AuthStorage {
  #data: AuthData | null;

  constructor(initial: AuthData | null = null) {
    this.#data = initial;
  }

  async load(): Promise<AuthData | null> {
    return this.#data;
  }

  async save(data: AuthData): Promise<void> {
    this.#data = data;
  }

  async clear(): Promise<void> {
    this.#data = null;
  }
}
