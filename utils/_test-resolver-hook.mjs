/**
 * Node ESM resolution hook for `utils/walletUtils.test.ts`.
 *
 * Mirrors `services/walletKit/evm/_test-resolver-hook.mjs`. NO business
 * logic here — purely test-harness plumbing.
 */

import { existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// ../ relative to this file = mobile-app root
const PROJECT_ROOT = resolvePath(__dirname, "..");

// Minimum-viable stubs for RN / Expo modules only reachable via
// transitive imports. The wallet-util surface this test exercises
// never calls these at runtime.
const STUB_SOURCES = {
  "expo-secure-store": `
    export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = "whenUnlockedThisDeviceOnly";
    export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = "afterFirstUnlockThisDeviceOnly";
    export async function getItemAsync() { return null; }
    export async function setItemAsync() {}
    export async function deleteItemAsync() {}
    export default {};
  `,
  "mmkv-storage": `
    export const storage = {
      getString: () => undefined,
      set: () => {},
      delete: () => {},
    };
  `,
};

function stubUrl(src) {
  return "data:text/javascript;base64," + Buffer.from(src).toString("base64");
}

function tryExtensions(absNoExt) {
  for (const ext of [".ts", ".tsx", ".mjs", ".js"]) {
    const candidate = absNoExt + ext;
    if (existsSync(candidate)) return candidate;
  }
  if (existsSync(absNoExt) && statSync(absNoExt).isDirectory()) {
    for (const ext of [".ts", ".tsx", ".mjs", ".js"]) {
      const candidate = resolvePath(absNoExt, "index" + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // Stub expo-secure-store.
  if (specifier === "expo-secure-store") {
    return {
      shortCircuit: true,
      url: stubUrl(STUB_SOURCES["expo-secure-store"]),
      format: "module",
    };
  }
  // Stub the mmkv storage helper (`@/lib/storage/mmkv`).
  if (specifier === "@/lib/storage/mmkv") {
    return {
      shortCircuit: true,
      url: stubUrl(STUB_SOURCES["mmkv-storage"]),
      format: "module",
    };
  }

  // Alias rewrite for `@/*`.
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const abs = resolvePath(PROJECT_ROOT, rel);
    const withExt =
      existsSync(abs) && statSync(abs).isFile() ? abs : tryExtensions(abs);
    if (withExt) {
      return nextResolve(pathToFileURL(withExt).href, context);
    }
  }

  // Relative imports missing an explicit extension.
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[a-zA-Z0-9]+$/.test(specifier) &&
    context.parentURL
  ) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const abs = resolvePath(parentDir, specifier);
    const withExt = tryExtensions(abs);
    if (withExt) {
      return nextResolve(pathToFileURL(withExt).href, context);
    }
  }

  return nextResolve(specifier, context);
}
