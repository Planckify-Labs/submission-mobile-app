# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Quick Reference

**Primary Documentation**: See `CLAUDE.md` for comprehensive development commands, architecture details, and code conventions. This file provides supplementary context and highlights critical patterns for AI agents.

**Project**: TakumiPay - A multi-chain crypto wallet with AI agent capabilities  
**Framework**: React Native + Expo 54 (Hermes, New Architecture)  
**Package Manager**: pnpm (workspace)

## Essential Commands

```bash
# Development
pnpm start                    # Start Expo dev server
pnpm android                  # Run on Android
pnpm ios                      # Run on iOS

# Code Quality & Testing
pnpm lint                     # ESLint
pnpm check:syntax             # TypeScript type checking
pnpm check:chains             # Enforce chain-agnostic code (critical)
pnpm check:agents             # Enforce agent architecture rules
pnpm biome:check              # Biome format + lint
pnpm test                     # Run all tests (vitest + node)

# Building
eas build --platform android --profile development
eas build --platform ios --profile production
```

## Critical Architecture Patterns

### 1. Multi-Chain Architecture (Enforced by CI)

**Hard Rule**: Shared code (`components/`, `hooks/`, `app/`) must NEVER branch on chain namespace strings (`"eip155"`, `"solana"`, `"sui"`).

**Why**: When a new chain is added, namespace-specific branches silently take the wrong path. This caused production bugs when Solana was added to an EVM-only codebase.

**How**: Chain-specific logic lives in `services/walletKit/` adapters. Shared code dispatches through:
- `walletKitRegistry` - Adapter lookup
- `services/walletKit/chainInfo.ts` - Chain-agnostic helpers

**Enforcement**: `pnpm check:chains` fails CI if violations are found. See `scripts/check-chain-agnostic.sh` for the allowlist and justifications.

**Example - Wrong**:
```typescript
// ❌ NEVER do this in shared code
if (namespace === "eip155") {
  // EVM-specific logic
}
```

**Example - Correct**:
```typescript
// ✅ Use the adapter registry
const kit = walletKitRegistry.get(namespace);
const nativeCurrency = kit.getNativeCurrency(chainId);
```

### 2. Multi-Agent Architecture

The app uses a specialist-team model with three agents:

- **Core Agent**: Orchestrator only. Routes intents, holds conversation state. Owns NO external tools (enforced by CI).
- **Wallet Agent**: Owns all wallet operations (balances, transfers, approvals, signing).
- **DeFi Agent**: Owns yield strategies and DeFi operations (currently stubbed).

**Key Principles**:
- Tool routing is prefix-based: `wallet_*`, `defi_*`, `core_*`
- Specialists never communicate directly with mobile - only through Core
- Each specialist has an Agent Card defining capabilities
- See `docs/multi-agent-architecture-spec.md` for full details

### 3. Wallet Context Isolation

**Hard Rule**: Tool calls MUST use the wallet that initiated the intent, NOT the currently active wallet.

**Why**: The home-screen wallet and the wallet a dApp is talking to can be different. Mixing them causes security bugs.

**Implementation**:
- `wallet_context` (address, namespace, chain_id, JWT) is set once per turn
- Forwarded verbatim to all specialists
- Mobile executors read from SSE envelope, ignore `activeWallet`/`activeChain`
- Payment intent reads use the paying wallet's JWT

**Reference**: See commit `4828e91` and `CLAUDE.md` "DApp bridge isolation" section.

### 4. User-Facing Error Sanitization

**Hard Rule**: End users must NEVER see raw error text, regardless of source (API, RPC, OS, biometric, etc.).

**Forbidden**:
- `err.message` in UI
- `String(err)` or `JSON.stringify(err)`
- Server response bodies
- HTTP status codes
- Stack traces
- Any machine-shaped string

**Required**:
- Hand-written friendly copy for all user-facing errors
- Raw details logged only in `__DEV__` mode
- Use `services/errors/paymentErrors.ts` classifier for payment flows

**Example - Wrong**:
```typescript
// ❌ NEVER expose raw errors to users
Alert.alert("Error", err.message);
```

**Example - Correct**:
```typescript
// ✅ Friendly copy + dev-only logging
Alert.alert("Payment Failed", "We couldn't complete your payment. Please try again.");
if (__DEV__) console.error("Payment error details:", err);
```

## Project Structure

```
mobile-app/
├── app/                    # Expo Router screens (file-based routing)
├── components/             # React components (must be chain-agnostic)
├── hooks/                  # Custom hooks (must be chain-agnostic)
├── services/
│   ├── walletKit/         # Multi-chain adapter registry
│   ├── chains/            # Per-chain implementations (evm, solana, sui)
│   ├── bridge/            # DApp bridge (EIP-1193 style)
│   ├── agent-executors/   # AI agent tool executors
│   └── errors/            # Error classification
├── api/                    # Backend API client
├── constants/              # App constants and types
├── contracts/              # Smart contract ABIs and hooks
├── docs/                   # Specs and runbooks (READ THESE!)
└── utils/                  # Utility functions
```

## Key Files to Understand

### Must Read
- `CLAUDE.md` - Comprehensive development guide
- `docs/multi-agent-architecture-spec.md` - Agent system design
- `docs/dapp-bridge-spec.md` - DApp integration
- `docs/wallet-security-vulnerabilities-spec.md` - Security considerations
- `scripts/check-chain-agnostic.sh` - Chain-agnostic enforcement

### Configuration
- `app.config.ts` - Expo config with security annotations
- `eas.json` - EAS Build profiles
- `biome.json` - Code formatting rules
- `tsconfig.json` - TypeScript configuration

### Core Services
- `services/walletKit/registry.ts` - Chain adapter registry
- `services/walletKit/chainInfo.ts` - Chain-agnostic helpers
- `hooks/useWallet.ts` - Multi-wallet state management
- `services/bridge/DappBridge.ts` - DApp communication

## Development Conventions

### Code Style
- **Formatter**: Biome (spaces, double quotes)
- **Linter**: ESLint + Biome
- **TypeScript**: Strict mode, path alias `@/*` → repo root
- **Imports**: Use `@/` prefix for all internal imports

### Testing
- **Vitest**: For most tests (explicit include list in `vitest.config.ts`)
- **node:test**: For files importing Node.js test utilities
- **Test files**: Must be added to vitest include list to run
- **Custom resolver**: `services/walletKit/evm/_test-resolver.mjs` for node:test

### Git Workflow
- **Branches**: `main` (release), `dev` (integration)
- **Commit format**: `type(scope): description`
  - Types: `feat`, `fix`, `refactor`, `chore`, `docs`
  - Example: `feat(wallet): add multi-sig support`

## Security & Distribution

### Official Distribution (TWV-2026-065)
- **Google Play**: `com.planckify.takumiwallet`
- **Website**: https://takumipay.xyz
- **Signing cert**: SHA-256 shown in About screen (from `constants/about.ts`)
- **Security review required** for changes to `constants/about.ts`

### Security Rules
1. **No raw errors to users** - Always use friendly copy
2. **Wallet context isolation** - Use intent wallet, not active wallet
3. **Chain-agnostic shared code** - No namespace branching
4. **Backup disabled** - No `adb backup` or Auto Backup (TWV-2026-059)
5. **Universal Links only** - No custom URL schemes for WalletConnect (TWV-2026-024)

## State Management

### Defaults
- **TanStack Query**: `staleTime: 60s`, `retry: 1`, `refetchOnWindowFocus: false`
- **Shared state**: Use `hooks/useRQGlobalState.ts` (React Query backed)
- **Persistence**: `expo-secure-store` for credentials, MMKV for cache

### Key Hooks
- `hooks/useWallet.ts` - Multi-wallet + multi-chain state
- `hooks/queries/*` - Feature-scoped query hooks
- `hooks/useRQGlobalState.ts` - Shared client state

## AI Agent Integration

### Architecture
- **Framework**: Vercel AI SDK (`@ai-sdk/react`, `@ai-sdk/anthropic`)
- **UI**: `components/home/TakumiAgent/`
- **Executors**: `services/agent-executors/` (partitioned by agent)
- **Protocol**: SSE with tool call/result envelopes

### Tool Execution
- Tools are prefix-routed: `wallet_*`, `defi_*`, `core_*`
- Executors run on mobile device
- Results flow back through server to agent
- All executors must respect wallet context isolation

## Common Pitfalls to Avoid

1. **❌ Branching on namespace in shared code** → Use adapter registry
2. **❌ Showing raw errors to users** → Use friendly copy + dev logging
3. **❌ Using activeWallet for dApp signing** → Use intent.wallet
4. **❌ Large search_and_replace operations** → Use write_to_file instead
5. **❌ Forgetting to add tests to vitest include** → Tests won't run
6. **❌ Importing from wrong chain namespace** → Use walletKit helpers

## Environment Variables

See `.env.example` for the full list. Key variables:
- `EXPO_PUBLIC_API_URL` - Backend API endpoint
- `EXPO_PUBLIC_AI_API_URL` - AI agent endpoint
- `EXPO_PUBLIC_SECRET_AI_KEY` - AI API key
- Provider IDs for mobile data/pulsa purchases

## Documentation Deep Dives

The `docs/` directory contains extensive specifications and runbooks:

### Specifications
- `dapp-bridge-spec.md` - DApp integration architecture
- `defi-strategies-spec.md` - DeFi yield strategies
- `multi-agent-architecture-spec.md` - Agent system design
- `multisig-spec.md` - Multi-signature wallet support
- `social-recovery-spec.md` - Account recovery mechanisms
- `solana-chain-support-spec.md` - Solana integration
- `sui-chain-support-spec.md` - Sui integration
- `wallet-security-vulnerabilities-spec.md` - Security audit

### Runbooks
- `docs/runbooks/` - Operational procedures
- `jwk_rotation_runbook.md` - Key rotation procedures
- `mainnet_migration_runbook.md` - Production deployment
- `refund_runbook.md` - Refund processing
- `agent-onboarding-runbook.md` - Agent setup

**When implementing or changing a subsystem, read its spec file first** - it's the source of truth for design intent.

## Known Technical Debt

From `docs/todolist/technical-debt.md`:
1. `activeChain` chainId fetching is inefficient - should store directly in state
2. Some screens still reach into viem `nativeCurrency` (EVM-specific) - should use kit hooks

## Getting Help

1. **For Bob Shell questions**: Use search_docs tool to find relevant documentation
2. **For project questions**: Check `CLAUDE.md` first, then relevant spec in `docs/`
3. **For chain-specific logic**: Look in `services/chains/{evm,solana,sui}/`
4. **For agent logic**: Check `services/agent-executors/` and `docs/multi-agent-architecture-spec.md`

## Summary for AI Agents

When working on this codebase:

1. **Always check chain-agnostic rules** - Run `pnpm check:chains` before committing
2. **Never expose raw errors to users** - Use friendly copy everywhere
3. **Respect wallet context isolation** - Use the intent wallet, not active wallet
4. **Read the relevant spec** - `docs/` contains the design intent
5. **Use the adapter registry** - Don't branch on namespace strings
6. **Test your changes** - Add new test files to vitest include list
7. **Follow the conventions** - Biome formatting, conventional commits
8. **Security first** - Review security rules before making changes

This is a production crypto wallet handling real user funds. Code quality, security, and correctness are paramount.
