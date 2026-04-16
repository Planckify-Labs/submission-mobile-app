/**
 * Bootstrap the indexer registry with available providers.
 * Import this once from app/_layout.tsx to register providers at startup.
 */

import { DirectRPCProvider } from "./DirectRPCProvider";
import { indexerRegistry } from "./registry";

// Register the baseline fallback provider
indexerRegistry.register(new DirectRPCProvider());

// Additional providers (Alchemy, etc.) will be registered here
// when platform task P1 is completed.
