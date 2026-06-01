# EIP-7702 Smart Account Upgrade — Engineering Spec (Phase 1)

**Status:** Draft  
**Owner:** Wallet & AI Agent Team  
**Target version:** `takumipay-mobile-app` v2.4.0  
**Scope:** EVM wallet core, space-docking ports (`WalletKitAdapter`, `ChainAdapter`)  
**References:**  
* Research Notes: [hackathon-research-notes.md](file:///home/cstralpt/takumipay/mobile-app/docs/hackathon-research-notes.md)  
* Allowlist Spec: [eip7702-delegator-allowlist-spec.md](file:///home/cstralpt/takumipay/mobile-app/docs/eip7702-delegator-allowlist-spec.md)  
* Allowlist Guard: [eip7702Guard.ts](file:///home/cstralpt/takumipay/mobile-app/services/chains/evm/eip7702Guard.ts)  
* Multi-chain Spec: [solana-chain-support-spec.md](file:///home/cstralpt/takumipay/mobile-app/docs/solana-chain-support-spec.md)  

---

## 1. Executive Summary

This spec outlines the design and implementation details for **Phase 1: EIP-7702 EOA-to-Smart-Account Upgrade** in the TakumiPay mobile application. By upgrading the user's Externally Owned Account (EOA) to a MetaMask Smart Account using EIP-7702, we lay the foundation for advanced features like ERC-7710 on-chain delegations, gas abstraction via the 1Shot Relayer, Venice AI integration, and agent-initiated micropayments (x402).

The upgrade must be integrated seamlessly within our existing **space-docking multi-chain architecture**, avoiding any hardcoded namespace or chain checks in the UI screens, and preserving all security invariants (such as allowlist gating and bytecode scanning).

---

## 2. Goals & Non-Goals

### Goals
* **G1. Allowlist MetaMask's deterministic Smart Account delegator**: Wire the deterministic MetaMask Smart Account delegator contract address to the allowlist in `eip7702Guard.ts` so EIP-7702 authorization signatures can be co-signed.
* **G2. Extend `WalletKitAdapter` Docking Port**: Add EIP-7702 upgrade methods (`upgradeToSmartAccount`) and metadata checks to the `WalletKitAdapter` interface in `services/walletKit/types.ts`.
* **G3. Implement MetaMask Smart Account Wrapper Factory**: Add `EvmWalletKit` implementations for EIP-7702 using `@metamask/smart-accounts-kit`.
* **G4. EIP-7702 Execution Invariants**: Wire the EIP-7702 `authorizationList` transaction submission flow using `viem`'s `signAuthorization` and transaction submission methods.
* **G5. Ensure Chain-Agnostic UI (Space Docking)**: Expose upgrade and signature actions in screens (`app/wallet.tsx`, `components/wallet/*`) only through presence-of-method checks on the `WalletKitAdapter` registry.
* **G6. Preserving Security Invariants**: Ensure the bytecode-prologue scanning for `SELFDESTRUCT` and the strict allowlist check are executed during the co-signing flow.

### Non-Goals (This Spec / Phase 1)
* **N1. ERC-7710 On-chain Delegations**: Defining and signing caveats is deferred to Phase 2.
* **N2. 1Shot Relayer & Gas Sponsorship**: Integrating gas abstraction via 1Shot is deferred to Phase 3.
* **N3. Multi-Agent Coordination**: Redelegation (Phase 6) is out of scope.
* **N4. Non-EVM Smart Accounts**: Solana / Sui smart account models are out of scope.

---

## 3. Background: The Space-Docking Multi-Chain Architecture

The TakumiPay mobile wallet supports multiple blockchain namespaces (EVM `eip155`, Solana `solana`, Sui `sui`) using a **space-docking architecture**. This design uses two primary registries to dispatch capabilities dynamically without branching on namespace strings in UI components:
1. **`ChainAdapter`** ([types.ts](file:///home/cstralpt/takumipay/mobile-app/services/chains/types.ts)): Handles dApp-originated requests in the WebView bridge.
2. **`WalletKitAdapter`** ([types.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts)): Handles first-party mobile wallet operations (native transfer, balances, formatting, key management).

To preserve this architecture:
* No `if (namespace === "eip155")` checks inside `app/wallet.tsx`, sheets, or common UI screens.
* Any EVM-specific capability (like EIP-7702 smart account upgrades) must dock onto `WalletKitAdapter` as an **optional method**.
* UI screens check for the presence of the method (e.g., `typeof walletKit.upgradeToSmartAccount === "function"`) before displaying the upgrade options.

---

## 4. Technical Mechanics & MetaMask Smart Account Integration

EIP-7702 introduces a Type 4 transaction that temporarily maps a contract's code to an EOA's storage context.

### 4.1 Resolving MetaMask Smart Account Delegator Addresses

MetaMask Smart Account contracts are deployed deterministically across all EVM networks via `CREATE2` and the salt `"GATOR"`. We resolve them in code using the SDK:
```typescript
import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';

const environment = getSmartAccountsEnvironment(chainId);
const delegatorAddress = environment.implementations.EIP7702StatelessDeleGatorImpl;
```
For fallback, the canonical address deployed on EVM chains (e.g. Base, Base Sepolia, Ethereum) is:
* **`0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B`**

### 4.2 Allowlisting & Guarding

1. We must add the address `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` to the `COMPILED_IN_DELEGATORS` in `services/chains/evm/eip7702Guard.ts`.
2. When the dApp/adapter requests `signAuthorization`, the guard will verify that the target matches this allowlist and check the bytecode to ensure it does not contain the `SELFDESTRUCT` (`0xff`) opcode.

### 4.3 Signing the Authorization

The EOA owner signs an EIP-7702 authorization tuple containing the chain ID, the delegator contract address, and the nonce.
```typescript
const authorization = await walletClient.signAuthorization({
  account,
  contractAddress: delegatorAddress,
  executor: 'self',
});
```

### 4.4 Submitting the Authorization (EOA Upgrade Execution)

The authorization is submitted to the blockchain inside an EIP-7702 set-code transaction alongside a dummy/empty call to finalize the upgrade:
```typescript
import { zeroAddress } from 'viem';

const hash = await walletClient.sendTransaction({
  authorizationList: [authorization],
  data: '0x',
  to: zeroAddress,
});
```

### 4.5 Wrapping the Upgraded Account

Once upgraded, subsequent wallet operations (e.g., sending ERC-4337 user operations) use the MetaMask Smart Account wrapper:
```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Stateless7702,
  address: eoaAddress,
  signer: { walletClient },
});
```

---

## 5. Interface Extensions (WalletKitAdapter Port)

To expose this capability in a space-docking compliant way, we extend the `WalletKitAdapter` interface in `services/walletKit/types.ts` with optional methods:

```typescript
export interface UpgradeToSmartAccountArgs {
  wallet: TWallet;
  chain: ChainConfig;
}

export interface UpgradeToSmartAccountResult {
  transactionHash: string;
  smartAccountAddress: string;
}

// In services/walletKit/types.ts:
export interface WalletKitAdapter {
  // ... existing methods ...

  /**
   * Optional EIP-7702 upgrade capability. Upgrades an EOA to a smart contract account.
   * EVM-only; Solana/Sui kits leave this undefined.
   */
  upgradeToSmartAccount?(args: UpgradeToSmartAccountArgs): Promise<UpgradeToSmartAccountResult>;

  /**
   * Optional check to verify if a wallet is already upgraded/active as a smart account.
   */
  isSmartAccountActive?(wallet: TWallet, chain: ChainConfig): Promise<boolean>;
}
```

### 5.1 Implementing in `EvmWalletKit.ts`

The EVM implementation inside `services/walletKit/evm/EvmWalletKit.ts` will implement these optional methods:
```typescript
    async upgradeToSmartAccount({ wallet, chain }): Promise<UpgradeToSmartAccountResult> {
      assertEvm(chain);
      const account = getAccountForWallet(wallet);
      if (!account) throw new Error("EvmWalletKit: unable to reconstruct signer");

      const publicClient = getPublicClient(chain.chain);
      const walletClient = getWalletClient(account, chain.chain);

      // 1. Resolve MetaMask delegator contract address
      const environment = getSmartAccountsEnvironment(chain.chain.id);
      const delegatorAddress = environment.implementations.EIP7702StatelessDeleGatorImpl;

      // 2. Sign Authorization tuple
      const authorization = await walletClient.signAuthorization({
        account,
        contractAddress: delegatorAddress,
        executor: 'self',
      });

      // 3. Submit EIP-7702 Transaction to deploy the delegation designator
      const hash = await walletClient.sendTransaction({
        authorizationList: [authorization],
        data: '0x',
        to: zeroAddress,
      });

      return {
        transactionHash: hash,
        smartAccountAddress: wallet.address,
      };
    },

    async isSmartAccountActive(wallet, chain): Promise<boolean> {
      assertEvm(chain);
      const pc = getPublicClient(chain.chain);
      const code = await pc.getCode({ address: wallet.address as `0x${string}` });
      if (!code || code === '0x') return false;
      
      // EIP-7702 upgraded code starts with 0xef0100 (delegation designator prefix)
      return code.startsWith('0xef0100');
    }
```

---

## 6. UI/UX & Flow Integration

### 6.1 Onboarding & Wallet View Changes
* Inside `app/wallet.tsx`, when displaying the active wallet, if the active kit supports smart account upgrades (`typeof walletKit.upgradeToSmartAccount === "function"`), we query `walletKit.isSmartAccountActive`.
* If the account is an EOA, display a premium-looking **"Upgrade to Smart Account"** action banner/card.
* Clicking the button launches an `UpgradeConfirmationSheet` presenting the benefits of account abstraction (gasless payments, AI-agent auto-execution, batched calls).

### 6.2 The Upgrade Flow
1. User clicks **"Upgrade"**.
2. Bottom sheet prompts for PIN/biometric authentication (secures the signing key).
3. The app invokes `walletKit.upgradeToSmartAccount`.
4. A full-screen loader with subtle micro-animations (matching our premium design system) indicates the upgrade transaction is pending.
5. Once confirmed, update UI state to show the smart account status badge, unlocking Phase 2 capabilities (delegations/caveats).

---

## 7. Security Invariants & Audit Guidelines

* **SI-1. Address allowlist enforcement**: The delegator address must pass the allowlist in `eip7702Guard.ts`. No co-signing of unknown delegators.
* **SI-2. Bytecode scanning (prologue sniff)**: The bytecode of the delegator must be scanned prior to signing the authorization list. A detection of `SELFDESTRUCT` (`0xff`) in the first 512 bytes triggers a hard rejection.
* **SI-3. Platform biometric confirmation**: Signing the EIP-7702 authorization requires explicit user confirmation via PIN or device biometrics, preventing silent background upgrades.

---

## 8. Test Plan & Acceptance Criteria

### Unit & Integration Tests
* **Test Allowlist**: Verify that `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` is allowed, and any other non-zero address is rejected.
* **Test Bytecode Scan**: Verify that `decideAuthorizationByBytecode` detects `0xff` and rejects, but passes for empty/valid bytecodes.
* **Test Docking Port**: Verify that `EvmWalletKit` successfully exposes `upgradeToSmartAccount` and `isSmartAccountActive`, while `SolanaWalletKit` / `SuiWalletKit` leave them `undefined`.
* **Test EIP-7702 Execution**: Mock `walletClient.signAuthorization` and `sendTransaction` to ensure the correct authorization tuple is generated and sent.
