/**
 * `bootGasAbstraction` — idempotent registration of all gas-abstraction
 * providers. Mirrors `services/walletKit/boot.ts`; called once at process
 * boot from `app/_layout.tsx`, AFTER `bootWalletKits()` (the 1Shot
 * provider resolves the EVM kit from `walletKitRegistry` at execution
 * time, so the kits must be registered first).
 *
 * Registration order is priority order in `gasAbstractionRegistry`. To
 * add Circle Paymaster / Biconomy later, register it here — no call site
 * changes.
 */

import { createOneShotRelayerProvider } from "./oneShot/oneShotRelayerProvider";
import { gasAbstractionRegistry } from "./registry";

let booted = false;

export function bootGasAbstraction(): void {
  if (booted) return;
  gasAbstractionRegistry.register(createOneShotRelayerProvider());
  booted = true;
}
