/** Let every pending microtask and zero-delay timer run. */
export const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
