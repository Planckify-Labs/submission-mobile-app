/**
 * IndexerRegistry — tries providers in priority order (lowest number first).
 * On failure, falls through to the next provider. Callers never interact
 * with individual providers; they call the registry which dispatches
 * to the best available.
 */

import type { IndexerProvider } from "./types";
import { IndexerNotSupportedError } from "./types";

export class IndexerRegistry {
  private providers: IndexerProvider[] = [];

  register(provider: IndexerProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  unregister(name: string): void {
    this.providers = this.providers.filter((p) => p.name !== name);
  }

  getProviders(): readonly IndexerProvider[] {
    return this.providers;
  }

  /**
   * Try each provider in priority order. Skip providers that throw
   * IndexerNotSupportedError or any runtime error, falling through
   * to the next. If all fail, throw the last error.
   */
  async call<T>(method: keyof IndexerProvider, ...args: unknown[]): Promise<T> {
    let lastError: Error | undefined;

    for (const provider of this.providers) {
      try {
        const fn = provider[method] as (...a: unknown[]) => Promise<T>;
        if (typeof fn !== "function") continue;
        const result = await fn.call(provider, ...args);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // IndexerNotSupportedError → expected, fall through silently
        if (err instanceof IndexerNotSupportedError) continue;
        // Runtime error → log and fall through
        console.warn(
          `[IndexerRegistry] ${provider.name}.${method} failed:`,
          lastError.message,
        );
        continue;
      }
    }

    throw lastError ?? new Error(`No providers registered for ${method}`);
  }
}

// ─── Singleton ───────────────────────────────────────────────────────

export const indexerRegistry = new IndexerRegistry();
