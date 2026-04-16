import type { TWallet } from "@/constants/types/walletTypes";
import type { ApprovalIntent } from "@/services/bridge/approval";

export type Namespace = "eip155" | "solana" | "sui";

export interface Origin {
  url: string;
  title?: string;
  icon?: string;
  via?: "webview" | "agent";
}

export interface ChainRequest {
  namespace: Namespace;
  method: string;
  params: unknown;
  origin: Origin;
  id: string;
}

export type ChainResult =
  | { status: "resolved"; value: unknown }
  | { status: "needs-approval"; intent: ApprovalIntent }
  | { status: "error"; code: number; message: string; data?: unknown };

export interface AdapterContext {
  activeWallet: TWallet | null;
  wallets: TWallet[];
  setActiveWallet: (index: number) => void;
  getAccount: (wallet: TWallet) => unknown;
  /**
   * TWV-2026-015 — current per-session nonce. Threaded through to the
   * injected provider's closure scope so every outbound bridge message
   * carries it. Rotated on every top-frame navigation.
   */
  sessionNonce?: string;
}

export interface ChainAdapter {
  readonly namespace: Namespace;

  getInjectedScript(ctx: AdapterContext): string;

  handleRequest(req: ChainRequest, ctx: AdapterContext): Promise<ChainResult>;

  executeApproval(
    intent: ApprovalIntent,
    decision: { id: string; outcome: "approve" | "reject"; data?: unknown },
    ctx: AdapterContext,
  ): Promise<unknown>;

  onStateChange?(ctx: AdapterContext): { injectedJs: string } | null;
}
