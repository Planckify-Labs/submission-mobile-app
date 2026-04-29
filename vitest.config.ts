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
      "services/chains/solana/takumiPay/pda.test.ts",
      "services/nanopay/solana/__tests__/*.test.ts",
    ],
  },
});
