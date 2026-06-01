# EIP-7710 Gas Abstraction via 1Shot Relayer — Engineering Spec (Phase 3)

**Status:** Draft  
**Owner:** Wallet & AI Agent Team  
**Target version:** `takumipay-mobile-app` v2.6.0  
**Scope:** EVM wallet core, space-docking ports ([WalletKitAdapter](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts)), agent execution module  
**References:**  
* Research Notes: [hackathon-research-notes.md](file:///home/cstralpt/takumipay/mobile-app/docs/hackathon-research-notes.md)  
* Phase 2 Spec: [erc7710-delegation-caveats-spec.md](file:///home/cstralpt/takumipay/mobile-app/docs/erc7710-delegation-caveats-spec.md)  
* WalletKit Types: [types.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts)  
* EVM WalletKit: [EvmWalletKit.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/evm/EvmWalletKit.ts)  
* Delegations Implementation: [delegations.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/evm/delegations.ts)  
* Agent Delegate Constants: [agentDelegate.ts](file:///home/cstralpt/takumipay/mobile-app/constants/agentDelegate.ts)  
* Public Relayer Skill: [SKILL.md](file:///home/cstralpt/takumipay/mobile-app/.agents/skills/public-relayer/SKILL.md)  

---

## 1. Executive Summary

This spec outlines the design and implementation details for **Phase 3: Gas Abstraction via 1Shot Relayer** in the TakumiPay mobile application. 

Building upon the on-chain Smart Account upgrades (Phase 1) and ERC-7710 delegation mechanics (Phase 2), we now integrate a gasless execution rail. Using the **1Shot Relayer**, the AI Agent or the application can submit transactions on behalf of the user, charging all transaction/network gas fees directly in stablecoins (e.g., USDC) instead of requiring native ETH. The relayer handles the actual blockchain execution and gas sponsorship permissionlessly.

To preserve the application's clean design, the integration conforms entirely to our **space-docking multi-chain architecture**. All 1Shot Relayer interactions (fetching fee data, submitting transaction bundles, and checking task statuses) are encapsulated as optional methods on the [WalletKitAdapter](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts) interface. This keeps UI screens and agent execution handlers chain-agnostic, with Solana / Sui wallet adapters compiling cleanly without modification.

---

## 2. Goals & Non-Goals

### Goals
* **G1. Define Space-Docking Relayer Methods**: Add namespace-agnostic methods to the [WalletKitAdapter](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts) interface to query capabilities, request fee data, estimate/simulate transactions, submit delegation execution bundles, and query execution status.
* **G2. Implement 1Shot RPC Client in `EvmWalletKit`**: Implement these methods inside [EvmWalletKit.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/evm/EvmWalletKit.ts) using the official 1Shot Relayer RPC API.
* **G3. Integrate Dynamic Capability Discovery**: Fetch the active target delegation address (`targetAddress`) and gas receiver (`feeCollector`) dynamically from the relayer per chain.
* **G4. Integrate Stablecoin Gas Payments**: Support querying, estimating, and paying fee amounts in USDC (and other supported tokens) dynamically utilizing the relayer's fee collector address.
* **G5. Design Asynchronous Status Tracking**: Implement status-polling mechanisms to track transactions submitted via 1Shot Task IDs and present real-time updates.
* **G6. Ensure Chain-Agnostic UI & Agent Loops**: Ensure UI components and the AI Agent's execution handlers interact with the relayer strictly through presence-of-method checks on the resolved `walletKit` instance.
* **G7. Isolate Non-EVM Adapters**: Ensure that Solana / Sui adapters compile without issues by keeping the new methods `undefined` on their respective kit implementations.

### Non-Goals
* **N1. Venice AI Brain Integration**: Swappable reasoning model setup is deferred to Phase 4.
* **N2. x402 Micropayments HTTP Loop**: Client-side fetch interceptors and automatic challenge response handling are deferred to Phase 5.
* **N3. Multi-Agent Coordination**: Core Agent sub-delegating scoped permissions to specialists (Phase 6) is out of scope.

---

## 3. Background: The Space-Docking Multi-Chain Architecture

The TakumiPay mobile application implements a **space-docking architecture** to ensure multi-chain agility. UI screens, wallets, and agent controllers never branch on chain namespace strings (e.g., `if (chain.namespace === 'solana')`). Instead, they resolve capabilities dynamically:

1. Capabilities are defined as optional properties or methods on the [WalletKitAdapter](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts) interface.
2. The UI or Agent Controller queries the `WalletKitRegistry` for the active chain and checks for the presence of the method before showing options or triggering execution.
3. Adapters that do not support a capability (e.g., Solana does not support ERC-7710 or 1Shot's EVM relayer) leave those methods `undefined`.

```
                      ┌────────────────────────┐
                      │    AI Agent Loop /     │
                      │   UI Execution Cards   │
                      └───────────┬────────────┘
                                  │ (Is method present?)
                                  ▼
                      ┌────────────────────────┐
                      │   WalletKitRegistry    │
                      └───────────┬────────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 ▼                ▼                ▼
       ┌──────────────────┐ ┌───────────┐ ┌──────────────────┐
       │   EvmWalletKit   │ │ SolanaKit │ │     SuiKit       │
       │ (1Shot Relayer   │ │ (Methods  │ │ (Methods         │
       │  Methods Impl)   │ │  = undef) │ │  = undefined)    │
       └──────────────────┘ └───────────┘ └──────────────────┘
```

---

## 4. Technical Mechanics & 1Shot Relayer Integration

The **1Shot Relayer** is a permissionless gas-abstraction infrastructure that executes EIP-7710 delegations using stablecoin fees.

### 4.1 RPC API Definition
* **Mainnet RPC Endpoint**: `https://relayer.1shotapi.com/relayers`
* **Testnet RPC Endpoint (Sepolia / Base Sepolia)**: `https://relayer.1shotapi.dev/relayers`
* **JSON-RPC Format**: Standard HTTP `POST` requests with JSON payloads.

We leverage five core RPC methods:

#### 1. `relayer_getCapabilities`
Resolves supported chains and accepted fee tokens. Used to discover the correct `targetAddress` (redeemer delegate address) and `feeCollector` (gas fee destination).
* **Request Params**:
  ```json
  ["8453", "84532"]
  ```
* **Response**:
  ```json
  {
    "result": {
      "84532": {
        "feeCollector": "0xE936e8FAf4A5655469182A49a505055B71C17604",
        "targetAddress": "0x4e44e22ee6da76c2ad19baaaffb52f676230fa06",
        "tokens": [
          { "address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", "symbol": "USDC", "decimals": "6" }
        ]
      }
    }
  }
  ```

#### 2. `relayer_getFeeData`
Used to get a rough gas price quote **before the bundle is built** (e.g. to show estimated fees in the UI prior to user signing).
* **Request Params**:
  ```json
  {
    "chainId": "84532",
    "token": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  }
  ```
* **Response**:
  ```json
  {
    "gasPrice": "0x6ddd00", 
    "rate": 1.0, 
    "minFee": "100000", 
    "expiry": 1782345678,
    "context": "0xabcdef..." 
  }
  ```

#### 3. `relayer_estimate7710Transaction`
The **preferred** way to estimate fees once the signed transaction bundle exists. It validates the delegation scope, runs a gas simulation, and locks the price context.
* **Request Params**:
  Same shape as `relayer_send7710Transaction` (excluding `context`).
* **Response**:
  ```json
  {
    "success": true,
    "requiredPaymentAmount": "150000", // Fee in payment token atoms
    "gasUsed": { "84532": "75000" },
    "context": "0xsignedquote..." // Price lock context to pass to send
  }
  ```

#### 4. `relayer_send7710Transaction`
Submits a delegation context and a batch of transactions to the relayer for on-chain execution.
* **Request Params**:
  ```json
  [
    {
      "chainId": 84532,
      "delegationContext": "0x...", // Hex-encoded signed ERC-7710 delegation bundle from encodeDelegations
      "transactions": [
        {
          "to": "0x1234...",
          "value": "0x0",
          "data": "0xa9059cbb..."
        }
      ],
      "feeToken": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "feeContext": "0xsignedquote...", // Returned from estimate
      "authorization": "0x...", // Optional EIP-7702 auth list hex (if upgrade is combined)
      "destinationUrl": "https://webhook.takumipay.com/tx-updates", // Optional webhook
      "memo": "order-1234" // Optional client-side tracking label
    }
  ]
  ```
* **Response**:
  ```json
  {
    "taskId": "task-uuid-1234-5678" // ID representing the execution task
  }
  ```

#### 5. `relayer_getStatus`
Queries the execution status of a submitted task.
* **Request Params**:
  ```json
  ["task-uuid-1234-5678"]
  ```
* **Response**:
  ```json
  {
    "status": "pending" | "success" | "failed",
    "transactionHash": "0x1234...", // Present if success
    "error": "reverted", // Present if failed
    "memo": "order-1234" // Echoed back if set
  }
  ```

---

## 5. Interface Extensions (WalletKitAdapter Port)

To support 1Shot Relayer capabilities, we extend the [WalletKitAdapter](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts) interface.

### 5.1 New Data Types inside `types.ts`

We introduce namespace-agnostic data shapes:

```typescript
export interface RelayerToken {
  address: string;
  symbol: string;
  decimals: number;
}

export interface RelayerChainCapabilities {
  targetAddress: string; // The address to delegate permissions TO (the redeemer)
  feeCollector: string; // The address to pay fees to
  tokens: RelayerToken[];
}

export interface RelayerCapabilities {
  [chainId: number]: RelayerChainCapabilities;
}

export interface GetRelayerFeeDataArgs {
  chain: ChainConfig;
  token: string; // Contract address of the stablecoin
}

export interface RelayerFeeData {
  gasPrice: bigint;
  rate: number;
  minFee: bigint;
  expiry: number; // UNIX timestamp
  context: string; // Price-lock quote
}

export interface RelayerTransaction {
  to: string;
  value: bigint;
  data: string;
}

export interface Estimate7710TransactionArgs {
  chain: ChainConfig;
  delegationContext: string;
  transactions: RelayerTransaction[];
  feeToken: string;
  authorization?: string; // Optional EIP-7702 auth list hex
}

export interface Estimate7710TransactionResult {
  success: boolean;
  requiredPaymentAmount?: bigint;
  gasUsed?: Record<number, string>;
  context?: string; // Price lock context
  error?: string;
}

export interface Send7710TransactionArgs {
  chain: ChainConfig;
  delegationContext: string; // Hex string from encodeSignedDelegations
  transactions: RelayerTransaction[];
  feeToken: string;
  feeContext: string; // context returned from estimate
  authorization?: string; // Optional EIP-7702 upgrade authorization
  destinationUrl?: string; // Optional webhook destination
  memo?: string; // Optional correlation ID
}

export interface Send7710TransactionResult {
  taskId: string;
}

export interface GetRelayerStatusArgs {
  chain: ChainConfig;
  taskId: string;
}

export interface RelayerStatus {
  status: "pending" | "success" | "failed";
  transactionHash?: string;
  error?: string;
  memo?: string;
}
```

### 5.2 WalletKitAdapter Interface Changes
Add the new optional methods to `WalletKitAdapter` in [types.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts):

```typescript
export interface WalletKitAdapter {
  // ... existing methods ...

  /**
   * Fetches supported chains, accepted payment tokens, target addresses, and fee collectors.
   */
  getRelayerCapabilities?(args: { chain: ChainConfig }): Promise<RelayerCapabilities>;

  /**
   * Fetches rough gas fee quotes and context before a bundle is built.
   * EVM-only; Solana/Sui leave this undefined.
   */
  getRelayerFeeData?(args: GetRelayerFeeDataArgs): Promise<RelayerFeeData>;

  /**
   * Estimates fees and simulates execution for a signed transaction bundle.
   * EVM-only; Solana/Sui leave this undefined.
   */
  estimate7710Transaction?(args: Estimate7710TransactionArgs): Promise<Estimate7710TransactionResult>;

  /**
   * Submits an ERC-7710 delegation-authorized execution bundle to the 1Shot Relayer.
   * EVM-only; Solana/Sui leave this undefined.
   */
  send7710Transaction?(args: Send7710TransactionArgs): Promise<Send7710TransactionResult>;

  /**
   * Queries the execution status of a submitted 1Shot Relayer task.
   * EVM-only; Solana/Sui leave this undefined.
   */
  getRelayerTransactionStatus?(args: GetRelayerStatusArgs): Promise<RelayerStatus>;
}
```

### 5.3 Implementing in `EvmWalletKit.ts`
Implement these methods inside [EvmWalletKit.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/evm/EvmWalletKit.ts) pointing to either the Mainnet endpoint `https://relayer.1shotapi.com/relayers` or Testnet endpoint `https://relayer.1shotapi.dev/relayers`:

```typescript
// Inside createEvmWalletKit() implementation:

    function getRelayerEndpoint(chainId: number): string {
      const testnets = [11155111, 84532]; // Sepolia, Base Sepolia
      return testnets.includes(chainId) 
        ? "https://relayer.1shotapi.dev/relayers" 
        : "https://relayer.1shotapi.com/relayers";
    }

    async getRelayerCapabilities({ chain }): Promise<RelayerCapabilities> {
      assertEvm(chain);
      const url = getRelayerEndpoint(chain.chain.id);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "relayer_getCapabilities",
          params: [String(chain.chain.id)],
          id: 1
        })
      });

      const payload = await response.json();
      if (payload.error) {
        throw new Error(`getRelayerCapabilities failed: ${payload.error.message || payload.error}`);
      }

      const caps: RelayerCapabilities = {};
      const networkData = payload.result[chain.chain.id];
      if (networkData) {
        caps[chain.chain.id] = {
          targetAddress: networkData.targetAddress,
          feeCollector: networkData.feeCollector,
          tokens: networkData.tokens.map((t: any) => ({
            address: t.address,
            symbol: t.symbol,
            decimals: Number(t.decimals)
          }))
        };
      }
      return caps;
    },

    async getRelayerFeeData({ chain, token }): Promise<RelayerFeeData> {
      assertEvm(chain);
      const url = getRelayerEndpoint(chain.chain.id);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "relayer_getFeeData",
          params: {
            chainId: String(chain.chain.id),
            token: token
          },
          id: 1
        })
      });

      const payload = await response.json();
      if (payload.error) {
        throw new Error(`getRelayerFeeData failed: ${payload.error.message || payload.error}`);
      }

      return {
        gasPrice: BigInt(payload.result.gasPrice),
        rate: Number(payload.result.rate),
        minFee: BigInt(payload.result.minFee),
        expiry: Number(payload.result.expiry),
        context: payload.result.context
      };
    },

    async estimate7710Transaction({
      chain,
      delegationContext,
      transactions,
      feeToken,
      authorization
    }): Promise<Estimate7710TransactionResult> {
      assertEvm(chain);
      const url = getRelayerEndpoint(chain.chain.id);

      const mappedTxs = transactions.map(tx => ({
        to: tx.to as `0x${string}`,
        value: `0x${tx.value.toString(16)}`,
        data: tx.data as `0x${string}`
      }));

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "relayer_estimate7710Transaction",
          params: [
            {
              chainId: chain.chain.id,
              delegationContext,
              transactions: mappedTxs,
              feeToken,
              authorization
            }
          ],
          id: 1
        })
      });

      const payload = await response.json();
      if (payload.error) {
        return {
          success: false,
          error: payload.error.message || String(payload.error)
        };
      }

      const result = payload.result;
      if (!result.success) {
        return {
          success: false,
          error: result.error || "Simulation failed"
        };
      }

      return {
        success: true,
        requiredPaymentAmount: BigInt(result.requiredPaymentAmount),
        gasUsed: result.gasUsed,
        context: result.context
      };
    },

    async send7710Transaction({
      chain,
      delegationContext,
      transactions,
      feeToken,
      feeContext,
      authorization,
      destinationUrl,
      memo
    }): Promise<Send7710TransactionResult> {
      assertEvm(chain);
      const url = getRelayerEndpoint(chain.chain.id);

      const mappedTxs = transactions.map(tx => ({
        to: tx.to as `0x${string}`,
        value: `0x${tx.value.toString(16)}`,
        data: tx.data as `0x${string}`
      }));

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "relayer_send7710Transaction",
          params: [
            {
              chainId: chain.chain.id,
              delegationContext,
              transactions: mappedTxs,
              feeToken,
              feeContext,
              authorization,
              destinationUrl,
              memo
            }
          ],
          id: 1
        })
      });

      const payload = await response.json();
      if (payload.error) {
        throw new Error(`send7710Transaction failed: ${payload.error.message || payload.error}`);
      }

      return {
        taskId: payload.result.taskId
      };
    },

    async getRelayerTransactionStatus({ chain, taskId }): Promise<RelayerStatus> {
      assertEvm(chain);
      const url = getRelayerEndpoint(chain.chain.id);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "relayer_getStatus",
          params: [taskId],
          id: 1
        })
      });

      const payload = await response.json();
      if (payload.error) {
        throw new Error(`getRelayerStatus failed: ${payload.error.message || payload.error}`);
      }

      return {
        status: payload.result.status,
        transactionHash: payload.result.transactionHash,
        error: payload.result.error,
        memo: payload.result.memo
      };
    }
```

---

## 6. UI/UX & Flow Integration

### 6.1 Capability Resolution & Gas Fee Discovery
1. Upon loading the screen/intent, the app queries `walletKit.getRelayerCapabilities` for the active chain.
2. The resolved capabilities provide the:
   - Supported tokens (typically USDC).
   - Dynamic `targetAddress` used to populate the `to` field of the delegation request.
   - Dynamic `feeCollector` used to populate the target address of the gas payment execution leg.
3. If pre-bundle estimation is needed, the UI calls `walletKit.getRelayerFeeData` to retrieve a rough native gas price and token conversion rate to display.

### 6.2 Transaction Estimation (Price-Lock Loop)
1. Assemble the EIP-7710 transaction bundle with a mock payment execution (e.g. `USDC.transfer(feeCollector, minFee)`).
2. Call `walletKit.estimate7710Transaction` passing the unsigned or signed bundle configuration.
3. Check `result.success`:
   - If `false`, inspect `result.error` and resolve the configuration issue.
   - If `true`, verify if the `requiredPaymentAmount` is greater than the mock fee.
   - If the payment amount needs updating, update the fee amount on the delegation scope, rebuild/re-sign the delegation, and re-run the estimate.
4. If the estimation succeeds, proceed immediately to submit the transaction utilizing the returned `context` to lock in the price quote.

### 6.3 Transaction Submission & Background Polling
Once the transaction is triggered:
1. The UI/Agent invokes `walletKit.send7710Transaction` with the final signed context and quote.
2. The transaction submission completes instantly and yields a `taskId`.
3. The app launches a non-blocking background task/poll:
   - Polls `walletKit.getRelayerTransactionStatus` every 3 seconds.
   - If the state is `"pending"`, show a "Relaying transaction..." loading indicator.
   - If the state is `"success"`, update the UI with the final transaction hash, register the tx in the transaction history store, and display a completion message.
   - If the state is `"failed"`, display the error payload and prompt the user.

---

## 7. Security Invariants & Audit Guidelines

* **SI-1. Fee Overcharge Protection**: Before invoking `send7710Transaction`, the client MUST assert that the returned `feeAmount` from `getRelayerFeeData` or `requiredPaymentAmount` from `estimate7710Transaction` does not exceed a safety threshold (e.g. $5.00 USDC equivalent). Any fee request exceeding this bound must trigger a safety rejection.
* **SI-2. Target Chain Enforcement**: The `chainId` included in the relayer parameters must be strictly validated to match the current active chain configuration. Mismatches must throw an assertion error before payload construction.
* **SI-3. Replay & Double Spend Prevention**: The client must track task IDs and must not submit the same execution bundle multiple times. If a task fails or times out, the client must reset state and prompt the user rather than retrying blindly.
* **SI-4. Redeemer Validation**: The EIP-7710 delegation `delegate` parameter must be verified to match the dynamically resolved `targetAddress` from capabilities to ensure the relayer can redeem the delegation.

---

## 8. Test Plan & Acceptance Criteria

### Unit Tests
* **RPC Request Builders**: Assert that `getRelayerFeeData`, `estimate7710Transaction`, `send7710Transaction`, and `getRelayerTransactionStatus` format JSON-RPC payloads exactly matching the 1Shot specification.
* **Response Handling**: Test behavior with various mock HTTP responses (200 OK with success, 200 OK with error payload, 5xx server failures) to ensure error messages are thrown safely.
* **BigInt Formatting**: Verify that hex-encoded gas parameters are correctly mapped back and forth to JavaScript `bigint` primitives.

### Integration Tests
* **Verify Docking Ports**: Confirm `EvmWalletKit` successfully registers all optional relayer methods, while `SolanaWalletKit` / `SuiWalletKit` continue compiling cleanly with these methods remaining `undefined`.
* **RPC Interception Mocking**: Test the full submission pipeline using mocked RPC endpoints to verify that calling `send7710Transaction` correctly issues and processes a `taskId`.

### Acceptance Criteria
1. `EvmWalletKit` implements all optional relayer methods using standard browser `fetch` (compatible with Expo/React Native).
2. UI screens detect `getRelayerFeeData` or capabilities presence dynamically and correctly show estimated stablecoin gas fees without hardcoding chain names.
3. Solana and Sui kits continue working and compile cleanly with no references to EVM-specific relayer endpoints.
