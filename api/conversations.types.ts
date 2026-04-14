export interface ConversationSummary {
  id: string;
  title: string;
  wallet_address: string;
  chain_id: number;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview: string;
}

export interface ConversationListResponse {
  items: ConversationSummary[];
  next_cursor: string | null;
}

export interface ConversationDetailResponse {
  id: string;
  title: string;
  wallet_address: string;
  chain_id: number;
  created_at: string;
  updated_at: string;
  messages: unknown[];
}
