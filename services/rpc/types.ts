export type HealthStatus = "healthy" | "degraded" | "down";

export interface RPCProviderConfig {
  name: string;
  url: string;
  chainId: number;
  priority: number; // lower = higher priority
  rateLimitRpm: number;
  isCustom?: boolean;
}

export interface RPCProviderState extends RPCProviderConfig {
  healthStatus: HealthStatus;
  lastLatencyMs: number;
  consecutiveHealthy: number;
  lastCheckedAt: number;
}
