# ERC-7710 Onchain Delegation & Caveats — Engineering Spec (Phase 2)

**Status:** Draft  
**Owner:** Wallet & AI Agent Team  
**Target version:** `takumipay-mobile-app` v2.5.0  
**Scope:** EVM wallet core, space-docking ports (`WalletKitAdapter`), local permission store (`PermissionGrantStore`)  
**References:**  
* Research Notes: [hackathon-research-notes.md](file:///home/cstralpt/takumipay/mobile-app/docs/hackathon-research-notes.md)  
* Phase 1 Spec: [eip7702-smart-account-upgrade-spec.md](file:///home/cstralpt/takumipay/mobile-app/docs/eip7702-smart-account-upgrade-spec.md)  
* WalletKit Types: [types.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts)  
* EVM WalletKit: [EvmWalletKit.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/evm/EvmWalletKit.ts)  
* Permission Store: [permissionGrantStore.ts](file:///home/cstralpt/takumipay/mobile-app/services/permissionGrantStore.ts)  

---

## 1. Executive Summary

This spec outlines the design and implementation details for **Phase 2: ERC-7710 Delegation & Caveats (Onchain Permissions)** in the TakumiPay mobile application. 

Following the EIP-7702 EOA upgrade in Phase 1, we now transition the user's local, device-only permission settings inside [PermissionGrantStore](file:///home/cstralpt/takumipay/mobile-app/services/permissionGrantStore.ts) into cryptographically signed **ERC-7710 delegations**. By doing so, we bridge user-authorized limits (spending caps, targets, allowed methods, and lifetimes) to onchain caveats. These delegations are signed by the delegator (user's smart account) and authorize the delegate (e.g., our AI agent) to execute transactions within strictly enforced bounds, laying the groundwork for gasless relayer execution (Phase 3) and agent-initiated micropayments (Phase 5).

Crucially, this system adheres to our **space-docking multi-chain architecture**, wrapping all ERC-7710 delegation-building, signing, and serialization logic as optional methods on [WalletKitAdapter](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts).

---

## 2. Goals & Non-Goals

### Goals
* **G1. Define Space-Docking Delegation Methods**: Add generic, namespace-agnostic interfaces for creating, signing, and encoding ERC-7710 delegations in [types.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts).
* **G2. Implement MetaMask SDK Delegation Building**: Implement these methods inside `EvmWalletKit` using `@metamask/smart-accounts-kit` to dynamically build, sign, and encode delegations.
* **G3. Bridge local `PermissionGrantStore` to Caveats**: Map local `PermissionGrant` structures to ERC-7710 scopes (`Erc20TransferAmount`, `FunctionCall`, etc.) and caveats (`Timestamp`, `LimitedCalls`, `AllowedTargets`, `AllowedMethods`).
* **G4. Secure Signing and Persistence**: Integrate biometric-secured delegation signing into the Agent Permissions flow and persist the signed delegations locally alongside existing permission grants.
* **G5. Isolation of Non-EVM Chains**: Ensure that Solana / Sui wallet kits remain unaffected by leaving the delegation methods `undefined`, preserving clean compilation and type separation.

### Non-Goals
* **N1. Relayer Execution / Gas Abstractor**: Broadcaster integration via the 1Shot Relayer is deferred to Phase 3.
* **N2. Venice AI Brain Integration**: Integration of Venice AI model reasoning is deferred to Phase 4.
* **N3. x402 Micropayments HTTP Loop**: Client-side fetch interceptors and automatic challenge settlement are deferred to Phase 5.
* **N4. Redelegation (Agent-to-Agent)**: Core Agent sub-delegating scoped permissions to specialists (Phase 6) is out of scope.

---

## 3. Background: The Space-Docking Multi-Chain Architecture

The TakumiPay mobile application implements a **space-docking architecture** to remain chain-agnostic. UI screens and application logic never branch on chain namespace strings (e.g., `if (chain.namespace === 'solana')`). Instead:
1. Capabilities are defined as optional properties/methods on the [WalletKitAdapter](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts) interface.
2. The UI queries the `walletKitRegistry` for the active chain and checks for the presence of the method before showing options or triggering execution.
3. Chains that do not support a capability (e.g., Solana does not support EIP-7702 or ERC-7710 onchain delegations) leave those methods `undefined`.

```
                    ┌────────────────────────┐
                    │     UI Screens /       │
                    │   Agent Controllers    │
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
     │  EvmWalletKit    │ │ SolanaKit │ │     SuiKit       │
     │  (Delegations    │ │ (Methods  │ │ (Methods         │
     │   Implemented)   │ │  = undef) │ │  = undefined)    │
     └──────────────────┘ └───────────┘ └──────────────────┘
```

---

## 4. Technical Mechanics & MetaMask Smart Account Integration

Under the `@metamask/smart-accounts-kit`, an ERC-7710 delegation restricts a delegate's power by matching rules defined as **Caveats**.

### 4.1 Scope vs. Caveats
* **Scope**: Defines the primary action capability assigned to the delegate. Built-in scope types inside the SDK include `ScopeType.Erc20TransferAmount`, `ScopeType.FunctionCall`, and `ScopeType.NativeTokenTransferAmount`.
* **Caveats**: Enforce boundaries evaluated on-chain during execution. Multiple caveats can be attached to a delegation.

#### Mapping Local Permissions to Caveats
Our existing local `PermissionGrant` objects map directly to ERC-7710 scopes and caveats:

| Local Permission Grant (in app) | ERC-7710 Scope / Caveat Configuration |
| :--- | :--- |
| **Capability:** `write` / `defi_write` | `ScopeType.FunctionCall` targeting DeFi contracts |
| **Tool:** `transfer_erc20` | `ScopeType.Erc20TransferAmount` + target token address |
| **Limit:** `maxAmount` (e.g., $100) | `maxAmount` term inside `ScopeType.Erc20TransferAmount` |
| **Lifetime:** `timed` (expires at unix ms) | `timestamp` Caveat with `beforeThreshold` in Unix seconds |
| **Lifetime:** `once` / `session` | `limitedCalls` Caveat with `limit: 1` |

### 4.2 SDK API Usage Flow
The EVM implementation inside the wallet kit follows this sequence to construct and sign a delegation:

1. **Resolve Environment & Smart Account Wrapper**:
   ```typescript
   import { getSmartAccountsEnvironment, Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
   
   const environment = getSmartAccountsEnvironment(chainId);
   const smartAccount = await toMetaMaskSmartAccount({
     client: publicClient,
     implementation: Implementation.Stateless7702,
     address: delegatorAddress,
     signer: { account },
   });
   ```

2. **Construct Delegation Structure**:
   ```typescript
   import { createDelegation } from '@metamask/smart-accounts-kit';
   
   const delegation = createDelegation({
     from: delegatorAddress,
     to: delegateAddress,
     environment,
     scope: {
       type: ScopeType.Erc20TransferAmount,
       tokenAddress: usdcAddress,
       maxAmount: parseUnits('50', 6),
     },
     caveats: [
       {
         type: 'timestamp',
         afterThreshold: 0,
         beforeThreshold: Math.floor(expiresAtMs / 1000),
       }
     ]
   });
   ```

3. **Sign & Serialize (Encode)**:
   The smart account signs the delegation, and the result is encoded to a hex string for future inclusion in transaction payloads:
   ```typescript
   import { encodeDelegation } from '@metamask/smart-accounts-kit/utils';
   
   const signature = await smartAccount.signDelegation({ delegation });
   const signedDelegation = { ...delegation, signature };
   const encodedContext = encodeDelegation(signedDelegation);
   ```

---

## 5. Interface Extensions (WalletKitAdapter Port)

To support this capability in a space-docking compliant way, we extend the [WalletKitAdapter](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts) interface.

### 5.1 New Data Types inside `types.ts`
We introduce serialized, plain-object configurations so UI screens and storage utilities do not import SDK-specific classes.

```typescript
export interface DelegationScope {
  type: "erc20TransferAmount" | "nativeTokenTransferAmount" | "functionCall" | "erc20PeriodTransfer" | "nativeTokenPeriodTransfer";
  tokenAddress?: string;
  maxAmount?: bigint;
  periodAmount?: bigint;
  periodDuration?: number; // In seconds (e.g. 604800 for Weekly)
  targets?: string[];      // Target contract addresses for functionCall
  methods?: string[];      // Allowed function selectors or signatures
}

export interface CaveatConfig {
  type: "timestamp" | "limitedCalls" | "allowedTargets" | "allowedMethods";
  expiresAt?: number;      // Expiration timestamp (Unix epoch in seconds)
  limit?: number;          // Limit on number of execution calls
  targets?: string[];      // Allowlist of target contract addresses
  methods?: string[];      // Allowlist of function selectors/signatures
}

export interface CaveatStruct {
  enforcer: `0x${string}`;
  terms: `0x${string}`;
  args: `0x${string}`;
}

export interface DelegationStruct {
  delegate: `0x${string}`;
  delegator: `0x${string}`;
  authority: `0x${string}`;
  caveats: CaveatStruct[];
  salt: `0x${string}`;
  signature: `0x${string}`;
}

export interface CreateDelegationArgs {
  wallet: TWallet;
  chain: ChainConfig;
  delegate: string;
  scope: DelegationScope;
  caveats?: CaveatConfig[];
  salt?: string;
  authority?: string;
}

export interface SignDelegationArgs {
  wallet: TWallet;
  chain: ChainConfig;
  delegation: Omit<DelegationStruct, "signature">;
}

export interface EncodeDelegationsArgs {
  chain: ChainConfig;
  delegations: DelegationStruct[];
}
```

### 5.2 WalletKitAdapter Interface Changes
We add the three new optional methods to `WalletKitAdapter` in [types.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts):

```typescript
export interface WalletKitAdapter {
  // ... existing methods ...

  /**
   * Builds an unsigned ERC-7710 delegation structure based on scope and caveats.
   * EVM-only; Solana/Sui leave this undefined.
   */
  createDelegation?(args: CreateDelegationArgs): Promise<Omit<DelegationStruct, "signature">>;

  /**
   * Signs an unsigned ERC-7710 delegation structure using the smart account's keys.
   * EVM-only; Solana/Sui leave this undefined.
   */
  signDelegation?(args: SignDelegationArgs): Promise<`0x${string}`>;

  /**
   * Encodes an array of signed delegations into a single hex string (delegationContext).
   * EVM-only; Solana/Sui leave this undefined.
   */
  encodeDelegations?(args: EncodeDelegationsArgs): Promise<string>;
}
```

### 5.3 Implementing in `EvmWalletKit.ts`
We implement these methods in [EvmWalletKit.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/evm/EvmWalletKit.ts):

```typescript
import { 
  createDelegation as sdkCreateDelegation,
  ScopeType,
  Implementation,
  toMetaMaskSmartAccount
} from "@metamask/smart-accounts-kit";
import { encodeDelegations as sdkEncodeDelegations } from "@metamask/smart-accounts-kit/utils";

// Inside createEvmWalletKit() implementation:

    async createDelegation({
      wallet,
      chain,
      delegate,
      scope,
      caveats = [],
      salt = "0x0000000000000000000000000000000000000000000000000000000000000000",
      authority = "0x0000000000000000000000000000000000000000000000000000000000000000"
    }): Promise<Omit<DelegationStruct, "signature">> {
      assertEvm(chain);
      
      const environment = getSmartAccountsEnvironment(chain.chain.id);
      
      // 1. Map scope to SDK ScopeConfig
      let sdkScope: any;
      if (scope.type === "erc20TransferAmount") {
        sdkScope = {
          type: ScopeType.Erc20TransferAmount,
          tokenAddress: scope.tokenAddress as `0x${string}`,
          maxAmount: scope.maxAmount!,
        };
      } else if (scope.type === "nativeTokenTransferAmount") {
        sdkScope = {
          type: ScopeType.NativeTokenTransferAmount,
          maxAmount: scope.maxAmount!,
        };
      } else if (scope.type === "functionCall") {
        sdkScope = {
          type: ScopeType.FunctionCall,
          targets: scope.targets as `0x${string}`[],
          selectors: scope.methods!,
        };
      } else if (scope.type === "erc20PeriodTransfer") {
        sdkScope = {
          type: ScopeType.Erc20PeriodTransfer,
          tokenAddress: scope.tokenAddress as `0x${string}`,
          periodAmount: scope.periodAmount!,
          periodDuration: scope.periodDuration!,
          startDate: Math.floor(Date.now() / 1000),
        };
      } else {
        throw new Error(`EvmWalletKit.createDelegation: unsupported scope type ${scope.type}`);
      }

      // 2. Map CaveatConfigs to SDK Caveats list
      const sdkCaveats = caveats.map((c) => {
        if (c.type === "timestamp") {
          return {
            type: "timestamp" as const,
            afterThreshold: 0,
            beforeThreshold: c.expiresAt!,
          };
        } else if (c.type === "limitedCalls") {
          return {
            type: "limitedCalls" as const,
            limit: c.limit!,
          };
        } else if (c.type === "allowedTargets") {
          return {
            type: "allowedTargets" as const,
            targets: c.targets as `0x${string}`[],
          };
        } else if (c.type === "allowedMethods") {
          return {
            type: "allowedMethods" as const,
            selectors: c.methods!,
          };
        }
        throw new Error(`EvmWalletKit.createDelegation: unsupported caveat type ${c.type}`);
      });

      // 3. Build SDK delegation
      const delegation = sdkCreateDelegation({
        environment,
        from: wallet.address as `0x${string}`,
        to: delegate as `0x${string}`,
        scope: sdkScope,
        caveats: sdkCaveats,
        salt: salt as `0x${string}`,
      });

      return {
        delegate: delegation.delegate,
        delegator: delegation.delegator,
        authority: delegation.authority,
        caveats: delegation.caveats.map(c => ({
          enforcer: c.enforcer,
          terms: c.terms,
          args: c.args,
        })),
        salt: delegation.salt,
      };
    },

    async signDelegation({ wallet, chain, delegation }): Promise<`0x${string}`> {
      assertEvm(chain);
      const account = getAccountForWallet(wallet);
      if (!account) {
        throw new Error("EvmWalletKit.signDelegation: unable to reconstruct signer");
      }

      const publicClient = getPublicClient(chain.chain);
      
      // Instantiate MetaMaskSmartAccount wrapper (stateless EIP-7702 implementation)
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Stateless7702,
        address: wallet.address as `0x${string}`,
        signer: { account },
      });

      // Sign the delegation structure
      const signature = await smartAccount.signDelegation({
        delegation: {
          delegate: delegation.delegate,
          delegator: delegation.delegator,
          authority: delegation.authority,
          salt: delegation.salt,
          caveats: delegation.caveats.map(c => ({
            enforcer: c.enforcer,
            terms: c.terms,
            args: c.args,
          })),
        },
      });

      return signature;
    },

    async encodeDelegations({ chain, delegations }): Promise<string> {
      assertEvm(chain);
      // Map to full SDK type for encoding
      const sdkDelegations = delegations.map((d) => ({
        delegate: d.delegate,
        delegator: d.delegator,
        authority: d.authority,
        salt: d.salt,
        signature: d.signature,
        caveats: d.caveats.map(c => ({
          enforcer: c.enforcer,
          terms: c.terms,
          args: c.args,
        })),
      }));

      return sdkEncodeDelegations(sdkDelegations);
    }
```

---

## 6. UI/UX & Flow Integration

### 6.1 Permission Onboarding Sheet
When editing permissions in [agent-permissions.tsx](file:///home/cstralpt/takumipay/mobile-app/app/agent-permissions.tsx):
1. The app verifies capability support:
   ```typescript
   const isDelegationSupported = 
     typeof walletKit.createDelegation === "function" && 
     typeof walletKit.signDelegation === "function";
   ```
2. If `true`, saving permissions triggers the onchain delegation flow.
3. The user is shown an `ApprovalSheet` detailing the exact boundaries being registered on-chain (e.g., *"Authorize Agent to execute up to 5 calls, spending maximum $10.00 USDC, expiring in 3 days"*).
4. After biometric verification (PIN/biometrics), `walletKit.signDelegation` is executed.

### 6.2 Permission Synchronization & Storage
Once signed, the signed delegation struct is persisted in the local [PermissionGrantStore](file:///home/cstralpt/takumipay/mobile-app/services/permissionGrantStore.ts) by extending the `PermissionGrant` type:

```typescript
export interface PermissionGrant {
  scope: GrantScope;
  lifetime: GrantLifetime;
  wallet_address: `0x${string}`;
  granted_at: number; // Unix ms
  delegation?: DelegationStruct; // Stored signed ERC-7710 delegation
}
```

---

## 7. Security Invariants & Audit Guidelines

* **SI-1. Biometric Enclosure**: No delegation signing may occur without explicit device biometric authentication. Background signing is strictly prohibited.
* **SI-2. Scope Alignment Verification**: The generated `DelegationScope` must perfectly align with or represent a stricter subset of the user's selected configuration. It must never expand limits.
* **SI-3. Epoch Bounds Compliance**: The timestamp caveat `beforeThreshold` must be explicitly verified to be non-zero and match the mapped local lifetime `timed` configuration.
* **SI-4. Replay Protection**: Each delegation must use a unique `salt` (or increment nonces) to ensure previous grants cannot be maliciously replayed or re-asserted.

---

## 8. Test Plan & Acceptance Criteria

### Unit Tests
* **Verify Translation Logic**: Test that local scopes (like `timed` or limit-bound USDC transfers) correctly translate into `@metamask/smart-accounts-kit` scopes and caveats.
* **Mocked Signatures**: Test `signDelegation` against a mocked `MetaMaskSmartAccount` to confirm it returns valid mock signatures.
* **Serialization Integrity**: Verify that `encodeDelegations` outputs a hex string starting with `0x` containing the formatted delegation array.

### Acceptance Criteria
1. `EvmWalletKit` successfully registers all three new optional delegation methods.
2. `SolanaWalletKit` and `SuiWalletKit` compile cleanly while leaving these methods `undefined`.
3. The UI successfully falls back to local-only mock store behavior if delegation methods are missing.
4. Bytecode scanning and allowlisting rules from Phase 1 remain strictly enforced when the smart account performs signing.
