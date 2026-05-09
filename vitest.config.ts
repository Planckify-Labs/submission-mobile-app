import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: [
      "services/agent-executors/sui.test.ts",
      "services/chains/solana/takumiPay/pda.test.ts",
      "services/chains/sui/codec.test.ts",
      "services/chains/sui/coinTransferService.test.ts",
      "services/chains/sui/derivation.test.ts",
      "services/chains/sui/errorCodes.transferErrors.test.ts",
      "services/chains/sui/tokenKind.test.ts",
      "services/chains/sui/transferService.test.ts",
      "services/nanopay/solana/__tests__/*.test.ts",
    ],
  },
});
