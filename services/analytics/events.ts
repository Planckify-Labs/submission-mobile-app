// Central catalog of product-analytics events. Every `track()` call site is
// type-checked against this map — add new events here, not ad-hoc strings at
// the call site (mirrors services/errors/paymentErrors.ts centralizing the
// payment-error vocabulary).
export type AnalyticsEventProps = {
  app_session_started: Record<string, never>;
  wallet_created: { chains: string[]; wallets_added: number };
  wallet_imported: { chains: string[]; wallets_added: number };
  payment_sent: { chain: string; token?: string; amount?: number };
  merchant_payment_completed: {
    chain: string;
    rail?: string;
    amount_minor?: string;
  };
  bill_payment_completed: {
    product_category?: string;
    points_spent?: number;
  };
  swap_completed: {
    chain: string;
    from_asset?: string;
    to_asset?: string;
    amount?: number;
  };
  defi_deposit_completed: {
    chain: string;
    protocol_slug?: string;
    chain_id?: string | number;
    asset_symbol?: string;
    amount?: number;
    amount_usd?: number;
  };
  deposit_completed: { chain: string; amount?: number };
  dapp_connected: { chain: string; dapp_host?: string; dapp_name?: string };
  dapp_transaction_approved: {
    chain: string;
    method: string;
    dapp_host?: string;
    dapp_name?: string;
  };
  agent_message_sent: Record<string, never>;
  agent_tool_completed: { tool_name: string; state: string };
  // In-screen feature engagement — taps that open a sub-feature/modal
  // without an expo-router navigation, so they're invisible to `$screen`.
  // `feature` is a short slug (e.g. "agent_mode", "receive_modal");
  // `trigger` further breaks down *which* entry point, only populated for
  // "agent_mode" (ask_bar | mic | spotlight | capability_card |
  // quick_prompt_chip | floating_button).
  feature_opened: { feature: string; trigger?: string };
  // Lifecycle of one Agent Mode "visit" — from the pager landing on the
  // chat page to leaving it (back button, swipe home, etc.), whichever
  // path gets there. Answers "how long do people spend chatting" and
  // "how many chat sessions per day/week/month", not just per-message
  // volume.
  agent_session_started: Record<string, never>;
  agent_session_ended: { duration_seconds: number };
};

export type AnalyticsEvent = keyof AnalyticsEventProps;
