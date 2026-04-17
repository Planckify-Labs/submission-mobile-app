/**
 * Node resolve hook for `utils/walletUtils.test.ts`.
 *
 * Plumbing only — NO business logic here. Registers a hook (see
 * `_test-resolver-hook.mjs`) that:
 *   - Rewrites `@/*` to absolute file URLs (mirrors `tsconfig.json`).
 *   - Appends `.ts` / `.tsx` extensions to extensionless relative imports.
 *   - Stubs RN / Expo native modules that can't load under plain Node.
 *
 * Loaded via `--import` + `module.register`.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./_test-resolver-hook.mjs", pathToFileURL(`${import.meta.dirname}/`));
