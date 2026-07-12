import { router } from "expo-router";
import { ChevronRight, KeyRound, Plus, ShieldCheck } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AccountFoundSheet from "@/components/auth/AccountFoundSheet";
import GoogleOtpSheet from "@/components/auth/GoogleOtpSheet";
import LoadinngSpinnerPopup from "@/components/common/LoadinngSpinnerPopup";
import RestoreBackupSheet from "@/components/wallet/backup/RestoreBackupSheet";
import ImportPrivateKeySheet from "@/components/wallet/create/ImportPrivateKeySheet";
import ImportSeedPhraseSheet from "@/components/wallet/create/ImportSeedPhraseSheet";
import type { TWallet } from "@/constants/types/walletTypes";
import {
  configureGoogleSignIn,
  type GoogleAuthError,
  registerGoogleWallet,
  type TGoogleAuthResponse,
  type TGoogleChallenge,
  useGoogleSignIn,
} from "@/hooks/queries/useGoogleAuth";
import { useLoadingSteps } from "@/hooks/useLoadingSteps";
import { useWallet } from "@/hooks/useWallet";
import { track } from "@/services/analytics/posthog";
import { authenticateWallet } from "@/services/auth/authenticateWallet";
import {
  getGoogleAccountForWallet,
  linkGoogleAccountToWallet,
} from "@/services/auth/googleAccountLink";
import {
  googleWalletPrefix,
  tagWalletsAsGoogle,
} from "@/services/auth/googleWallets";
import { hasDriveScope } from "@/services/backup/driveAppData";
import { BACKUP_ERROR_COPY, BackupError } from "@/services/backup/errors";
import {
  hasRemoteBackup,
  recordBackupTimestamp,
} from "@/services/backup/seedBackup";
import {
  bootstrapFirstLoginWallets,
  restoreWalletsFromMnemonic,
} from "@/services/walletKit/bootstrap";
import { loadWalletsFromStorage } from "@/services/walletService";

// The five post-OTP outcomes that end in a usable wallet — see
// `google_signin_completed` in services/analytics/events.ts.
type GoogleSignInPath =
  | "existing_wallet"
  | "drive_restore"
  | "new_account"
  | "account_found_new_wallet"
  | "account_found_recovery_phrase";

export default function Login() {
  const { height } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const googleSignIn = useGoogleSignIn();
  const {
    addWallets,
    activeChain,
    wallets: liveWallets,
    setActiveWallet,
  } = useWallet();
  const [creating, setCreating] = useState(false);
  const [seedSheetVisible, setSeedSheetVisible] = useState(false);
  // Whether the seed sheet was opened from the Google "Account found" recovery
  // path (so imported wallets get tagged to the account) vs. a plain import.
  const [seedSheetForGoogle, setSeedSheetForGoogle] = useState(false);
  const [pkSheetVisible, setPkSheetVisible] = useState(false);
  const [googleChallenge, setGoogleChallenge] =
    useState<TGoogleChallenge | null>(null);
  const [googleAccount, setGoogleAccount] = useState<
    TGoogleAuthResponse["user"] | null
  >(null);
  // Google access token, kept out of state so it never renders and doesn't
  // retrigger the async sign-in callbacks. Used to link the wallet server-side.
  const googleTokenRef = useRef<string | null>(null);
  // Server-masked email from the challenge, kept so the Account-found sheet can
  // still show it after `googleChallenge` is cleared.
  const emailMaskedRef = useRef<string | undefined>(undefined);
  const [restoreSheetVisible, setRestoreSheetVisible] = useState(false);
  const [accountFoundSheetVisible, setAccountFoundSheetVisible] =
    useState(false);
  const {
    isLoading: isCreatingSpinner,
    currentMessage: creatingMessage,
    completeStep,
    start: startCreating,
    stop: stopCreating,
    delay,
  } = useLoadingSteps([
    "Setting things up for you...",
    "Generating your wallets...",
    "Securing your keys...",
    "You're all set! 🎉",
  ]);

  // Separate step track for the Google path — a returning user isn't
  // "generating wallets", so the create-wallet copy would be a lie.
  const {
    isLoading: isSigningInSpinner,
    currentMessage: signingInMessage,
    completeStep: completeSignInStep,
    start: startSigningIn,
    stop: stopSigningIn,
    delay: signInDelay,
  } = useLoadingSteps([
    "Verifying your account...",
    "Setting up your wallet...",
    "Signing you in...",
    "You're all set! 🎉",
  ]);

  // Configure Google Sign-In on mount
  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const handleCreateWallet = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    startCreating();
    try {
      completeStep(0);
      await delay(200);

      completeStep(1);
      const minted = await bootstrapFirstLoginWallets();
      if (minted.length === 0) {
        stopCreating();
        Alert.alert(
          "Create Failed",
          "Could not create a wallet. Please try again.",
        );
        return;
      }

      completeStep(2);
      await addWallets(minted);

      completeStep(3);
      await delay(300);

      router.replace("/");
    } catch (error) {
      console.error("create wallet failed:", error);
      stopCreating();
      Alert.alert(
        "Create Failed",
        "Could not create a wallet. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  }, [creating, addWallets, startCreating, stopCreating, completeStep, delay]);

  const handleSeedWalletsAdded = useCallback(
    (added: TWallet[]) => {
      setSeedSheetVisible(false);

      // Only tie the wallet to the account when the import was the Google
      // "Account found" recovery path (not a plain import that happens to
      // follow a Google session). The sheet has already tagged the wallets in
      // that case; here we record the identity link + server registration so
      // the next device recognises the account. Best-effort.
      const primary = added[0];
      const token = googleTokenRef.current;
      if (primary && seedSheetForGoogle && googleAccount) {
        linkGoogleAccountToWallet(primary.address, {
          userId: googleAccount.id,
          email: googleAccount.email,
          name: googleAccount.name,
        });
        if (token) void registerGoogleWallet(token, primary.address);
        track("google_signin_completed", {
          path: "account_found_recovery_phrase",
        });
      }

      setSeedSheetForGoogle(false);
      router.replace("/");
    },
    [googleAccount, seedSheetForGoogle],
  );

  const handlePrivateKeyWalletAdded = useCallback((_: unknown) => {
    setPkSheetVisible(false);
    router.replace("/");
  }, []);

  const handleImportSeedPhraseInstead = useCallback(() => {
    setPkSheetVisible(false);
    setSeedSheetForGoogle(false);
    setSeedSheetVisible(true);
  }, []);

  /**
   * Step 1. Verifies the Google account and asks the server to email a code.
   * No session exists yet — the challenge only opens the OTP sheet.
   */
  const handleGoogleSignIn = useCallback(() => {
    track("google_signin_started");
    googleSignIn.mutate(undefined, {
      onSuccess: (challenge) => {
        track("google_signin_otp_requested");
        emailMaskedRef.current = challenge.emailMasked;
        setGoogleChallenge(challenge);
      },
      onError: (error: GoogleAuthError) => {
        // A cancelled picker is a normal outcome, not a failure to report.
        if (error.code === "in_progress") return;
        if (error.code === "cancelled") {
          track("google_signin_cancelled");
          return;
        }
        track("google_signin_failed", { reason: error.code });

        Alert.alert(
          "Sign In Failed",
          error.code === "account_conflict"
            ? "We couldn't sign you in with this account. Please use the method you originally signed up with."
            : error.code === "rate_limited"
              ? "Too many sign-in attempts. Please wait a moment and try again."
              : error.code === "email_undeliverable"
                ? "We couldn't send your verification email. Please try again."
                : error.code === "play_services_unavailable"
                  ? "Google Play Services isn't available on this device."
                  : "We couldn't sign you in with Google. Please try again.",
        );
      },
    });
  }, [googleSignIn]);

  /**
   * Shared tail of every path that ends with a usable wallet on this device:
   * link the Google identity locally, run the chain-agnostic wallet handshake,
   * and land on home.
   *
   * The mnemonic never leaves the device — `linkGoogleAccountToWallet` stores
   * identity only, never key material.
   */
  const finishSignIn = useCallback(
    async (
      accountWallets: TWallet[],
      account: TGoogleAuthResponse["user"] | null,
      opts: { path: GoogleSignInPath; activateExisting?: boolean },
    ) => {
      // The kit registry derives wallets EVM-first, so index 0 is the EVM row
      // — what the auth handshake and EVM-first surfaces (agent, send) default
      // to. Kept index-based (not a namespace check) to stay chain-agnostic.
      const primary = accountWallets[0];

      if (account) {
        // Device-local identity only, so the association survives even if the
        // wallet handshake below fails and the user re-auths from home.
        linkGoogleAccountToWallet(primary.address, {
          userId: account.id,
          email: account.email,
          name: account.name,
        });

        // Record the wallet against the account server-side so a future
        // new-device login can recognise it ("Account found"). Best-effort:
        // uses the Google token captured at OTP time, and never blocks the
        // UI or fails the sign-in. Idempotent, so it also backfills accounts
        // that predate this feature.
        const googleToken = googleTokenRef.current;
        if (googleToken) {
          void registerGoogleWallet(googleToken, primary.address);
        }
      }

      // Returning account whose wallet already lives in storage: make it the
      // active wallet so home opens on this Google account's wallet, not
      // whatever happened to be selected last. (Mint / restore paths already
      // activate via `addWallets`.)
      if (opts.activateExisting) {
        const idx = liveWallets.findIndex(
          (w) => w.address.toLowerCase() === primary.address.toLowerCase(),
        );
        if (idx >= 0) setActiveWallet(idx);
      }

      completeSignInStep(2);

      // A failed handshake is not fatal: the wallet exists on device and every
      // authed surface falls back to its inline sign-in CTA.
      await authenticateWallet(primary, activeChain);

      completeSignInStep(3);
      track("google_signin_completed", { path: opts.path });
      await signInDelay(300);
      router.replace("/");
    },
    [
      liveWallets,
      setActiveWallet,
      activeChain,
      completeSignInStep,
      signInDelay,
    ],
  );

  /**
   * Brand-new Google account (nothing on this device, no Drive backup, server
   * doesn't recognise it): mint a wallet that BELONGS to this account and add
   * it alongside whatever's already on the phone. A Google login gives the
   * account its own wallet — it never co-opts an unrelated wallet, and signing
   * in with a different account mints a different one.
   */
  const mintGoogleWalletAndFinish = useCallback(
    async (
      account: TGoogleAuthResponse["user"],
      path: Extract<
        GoogleSignInPath,
        "new_account" | "account_found_new_wallet"
      >,
    ) => {
      const minted = tagWalletsAsGoogle(
        await bootstrapFirstLoginWallets(googleWalletPrefix(account)),
        account,
      );
      if (minted.length === 0) {
        throw new Error("wallet bootstrap produced no wallets");
      }
      // Append — never replace the user's existing wallets.
      await addWallets(minted);
      await finishSignIn(minted, account, { path });
    },
    [addWallets, finishSignIn],
  );

  /**
   * Step 2 succeeded. The Google session proves who the user is; the app's own
   * session is wallet-bound, so we need a wallet before we can authenticate.
   *
   * The wallet is scoped to the **Google account**, not to the device. One
   * account = one wallet: signing in always lands on this account's own wallet,
   * and signing in with a different account gives a different wallet — even if
   * the device already holds other (seed-phrase / imported) wallets. So the
   * decision keys off "does *this account* have a wallet", never "does the
   * device have *any* wallet", and it never co-opts an unrelated wallet.
   */
  const handleOtpVerified = useCallback(
    async (response: TGoogleAuthResponse) => {
      setGoogleChallenge(null);
      setGoogleAccount(response.user);
      // Held in a ref, not state, because it's read inside async callbacks
      // that shouldn't re-run when it changes and it must never render.
      googleTokenRef.current = response.access_token;
      startSigningIn();

      try {
        completeSignInStep(0);
        await signInDelay(200);

        // Spec §14.1 / §14.8: login is auth-only. Wallet setup runs post-auth.
        completeSignInStep(1);
        const account = response.user;
        const localWallets = await loadWalletsFromStorage();

        // Wallets already tied to THIS Google account on THIS device.
        const linked = localWallets.filter(
          (w) => getGoogleAccountForWallet(w.address)?.userId === account.id,
        );
        if (linked.length > 0) {
          // Returning account, same device — open its wallet, never mint.
          await finishSignIn(linked, account, {
            path: "existing_wallet",
            activateExisting: true,
          });
          return;
        }

        // This account has no wallet on this device yet. Get one that BELONGS
        // to it — never silently mint over, and never co-opt, an unrelated
        // wallet already on the phone:
        //   1. Encrypted Drive backup → restore it.
        //   2. Server knows this account has a wallet elsewhere → prompt for
        //      the recovery phrase ("Account found").
        //   3. Nothing on record → brand-new account; mint its own wallet.
        //
        // Drive is optional (Google's granular-consent checkbox), so only look
        // for a backup when the scope was actually granted. A user who
        // unchecked it opted out of Drive — they must never be blocked from
        // signing in, nor re-prompted for the permission mid-login.
        let hasBackup = false;
        if (hasDriveScope()) {
          try {
            hasBackup = await hasRemoteBackup();
          } catch (backupError) {
            // A permission problem means Drive isn't usable for this account
            // (the scope check can false-positive on some Android builds where
            // it reports requested rather than granted scopes) — treat as "no
            // Drive backup" and continue. Genuine transient failures still
            // block, so we never mint over a backup we simply couldn't read.
            if (
              backupError instanceof BackupError &&
              backupError.code === "drive_permission_denied"
            ) {
              hasBackup = false;
            } else {
              throw backupError;
            }
          }
        }

        if (hasBackup) {
          stopSigningIn();
          setRestoreSheetVisible(true);
        } else if (response.hasWallet) {
          stopSigningIn();
          setAccountFoundSheetVisible(true);
        } else {
          await mintGoogleWalletAndFinish(account, "new_account");
        }
      } catch (error) {
        if (__DEV__) console.warn("post-OTP wallet setup failed:", error);
        stopSigningIn();
        track("google_signin_setup_failed", {
          stage: "post_otp",
          reason: error instanceof BackupError ? error.code : "unknown",
        });

        // On a Drive read failure we do NOT fall through to minting: guessing
        // "no backup" would hand the user a new, empty wallet while their real
        // one sits in a backup we simply failed to read.
        Alert.alert(
          "Sign In Failed",
          error instanceof BackupError
            ? BACKUP_ERROR_COPY[error.code]
            : "We couldn't finish setting up your wallet. Please try again.",
        );
      }
    },
    [
      startSigningIn,
      stopSigningIn,
      completeSignInStep,
      signInDelay,
      finishSignIn,
      mintGoogleWalletAndFinish,
    ],
  );

  const handleOtpExpired = useCallback(() => {
    setGoogleChallenge(null);
  }, []);

  /**
   * Drive backup decrypted — rebuild the exact same addresses from it and add
   * them (tagged to this Google account) alongside any wallets already on the
   * device. Append, never replace: the backup is this account's wallet, not a
   * device wipe.
   */
  const handleBackupRestored = useCallback(
    async (mnemonic: string, createdAt: number) => {
      setRestoreSheetVisible(false);
      startSigningIn();

      try {
        completeSignInStep(0);
        completeSignInStep(1);
        const restored = googleAccount
          ? tagWalletsAsGoogle(
              await restoreWalletsFromMnemonic(
                mnemonic,
                googleWalletPrefix(googleAccount),
              ),
              googleAccount,
            )
          : await restoreWalletsFromMnemonic(mnemonic);
        if (restored.length === 0) {
          throw new Error("restore produced no wallets");
        }
        await addWallets(restored);
        // This wallet came *from* a Drive backup, so cache that status locally
        // (with the backup's real creation date, across all sibling chains) —
        // otherwise the wallet screen would show "Back up to Google Drive" and
        // offer to create one over the top of the backup we just restored.
        for (const w of restored) recordBackupTimestamp(w.address, createdAt);
        await finishSignIn(restored, googleAccount, { path: "drive_restore" });
      } catch (error) {
        if (__DEV__) console.warn("restore from backup failed:", error);
        stopSigningIn();
        track("google_signin_setup_failed", { stage: "drive_restore" });
        Alert.alert(
          "Restore Failed",
          "We couldn't rebuild your wallet from that backup. Please try your seed phrase.",
        );
      }
    },
    [
      googleAccount,
      finishSignIn,
      addWallets,
      startSigningIn,
      stopSigningIn,
      completeSignInStep,
    ],
  );

  const handleRestoreWithSeedInstead = useCallback(() => {
    setRestoreSheetVisible(false);
    setSeedSheetForGoogle(true);
    setSeedSheetVisible(true);
  }, []);

  const handleEnterRecoveryPhrase = useCallback(async () => {
    // Mirror the create-new path: close "Account found" and let it slide out
    // before the import sheet slides in, so the two sheets don't overlap
    // mid-transition. (The friendly "Signing In" popup comes later, once the
    // entered phrase is actually deriving wallets, inside the import sheet.)
    setSeedSheetForGoogle(true);
    setAccountFoundSheetVisible(false);
    await signInDelay(220);
    setSeedSheetVisible(true);
  }, [signInDelay]);

  /**
   * "Account found" → restore from the Drive backup. Hands off to the same
   * `RestoreBackupSheet` the auto-detect path uses; its passphrase submit runs
   * the *interactive* restore, which requests Drive access (for the user who
   * skipped it at sign-in) before decrypting. If no backup turns up or the
   * passphrase is wrong, that sheet offers the seed-phrase fallback.
   */
  const handleRestoreFromDrive = useCallback(() => {
    setAccountFoundSheetVisible(false);
    setRestoreSheetVisible(true);
  }, []);

  /**
   * Last resort: the account has a wallet, but the user has neither the seed
   * phrase nor a Drive backup. Non-custodial means that wallet is unrecoverable
   * — by anyone — but that's already spelled out on the recovery-options view
   * that hosts this action, so we don't gate it behind a second dialog. Mint a
   * fresh (empty) wallet so they're not stranded.
   */
  const handleCreateNewFromAccountFound = useCallback(async () => {
    const account = googleAccount;
    if (!account) return;
    // Close the sheet and let it slide out, then bring up the spinner, and only
    // then run the CPU-heavy wallet derivation. Doing the derivation first
    // blocks the JS thread before the close/spinner can paint — it looks frozen.
    setAccountFoundSheetVisible(false);
    await signInDelay(220);
    startSigningIn();
    try {
      completeSignInStep(0);
      await signInDelay(120);
      completeSignInStep(1);
      await mintGoogleWalletAndFinish(account, "account_found_new_wallet");
    } catch (error) {
      if (__DEV__) {
        console.warn("create-new after lost recovery failed:", error);
      }
      stopSigningIn();
      track("google_signin_setup_failed", {
        stage: "account_found_new_wallet",
      });
      Alert.alert(
        "Sign In Failed",
        "We couldn't set up a new wallet. Please try again.",
      );
    }
  }, [
    googleAccount,
    mintGoogleWalletAndFinish,
    startSigningIn,
    stopSigningIn,
    completeSignInStep,
    signInDelay,
  ]);

  return (
    <>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <SafeAreaView
        className="flex-1 bg-light-main-container"
        style={{ paddingTop: 0 }}
      >
        <View style={[StyleSheet.absoluteFill]} className="overflow-hidden">
          <View className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-light-primary-red/10" />
          <View className="absolute top-40 -left-40 w-80 h-80 rounded-full bg-light-primary-red/5" />
          <View className="absolute -bottom-10 -right-14 w-40 h-40 rounded-full bg-light-primary-red/10" />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            { minHeight: height },
            styles.scrollViewContent,
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          onContentSizeChange={(_, contentHeight) => {
            if (scrollViewRef.current) {
              scrollViewRef.current.setNativeProps({
                scrollEnabled: contentHeight > height,
              });
            }
          }}
        >
          <View className="flex-1 p-6">
            <View className="items-center mb-16">
              <View className="bg-light shadow-lg- py-5 justify-center items-center aspect-square rounded-3xl mb-6">
                <Image
                  source={require("@/assets/images/takumipay-no-bg.png")}
                  style={{ width: 65, height: 60 }}
                  className="object-contain w-full"
                />
              </View>

              <Text className="text-light-matte-black text-4xl font-bold text-center mb-2">
                TakumiPay
              </Text>
              <Text className="text-light-matte-black/70 text-base text-center max-w-72">
                Your Financial AI Companion
              </Text>
            </View>

            <View className="bg-light rounded-3xl p-6 shadow-md- mb-4">
              <Text className="text-light-matte-black/80 font-medium mb-4">
                GET STARTED
              </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                className="bg-light border border-light-matte-black/10 py-4 px-5 rounded-xl flex-row items-center justify-between mb-3"
                onPress={handleGoogleSignIn}
                disabled={googleSignIn.isPending || creating}
              >
                <View className="flex-row items-center">
                  <View className="w-11 h-11 bg-light-primary-red/10 rounded-full items-center justify-center mr-3">
                    {googleSignIn.isPending ? (
                      <ActivityIndicator size="small" color="#c71c4b" />
                    ) : (
                      <Image
                        source={require("@/assets/images/google-takumipay.png")}
                        style={{ width: 20, height: 20 }}
                      />
                    )}
                  </View>
                  <Text className="text-light-matte-black font-medium">
                    {googleSignIn.isPending
                      ? "Signing in..."
                      : "Continue with Google"}
                  </Text>
                </View>
                <ChevronRight color="#20222c" size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                className="bg-light-primary-red py-4 px-5 rounded-xl flex-row items-center justify-between mb-3"
                onPress={handleCreateWallet}
                disabled={creating}
              >
                <View className="flex-row items-center">
                  <View className="w-11 h-11 bg-light/20 rounded-full items-center justify-center mr-3">
                    {creating ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Plus color="#ffffff" size={20} />
                    )}
                  </View>
                  <Text className="text-light font-semibold">
                    {creating ? "Creating wallet…" : "Create New Wallet"}
                  </Text>
                </View>
                <ChevronRight color="#ffffff" size={18} />
              </TouchableOpacity>
            </View>

            <View className="bg-light rounded-3xl p-6 shadow-md- mb-8">
              <Text className="text-light-matte-black/80 font-medium mb-4">
                IMPORT EXISTING WALLET
              </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                className="bg-light border border-light-matte-black/10 py-4 px-5 rounded-xl flex-row items-center justify-between mb-3"
                onPress={() => {
                  setSeedSheetForGoogle(false);
                  setSeedSheetVisible(true);
                }}
                disabled={creating}
              >
                <View className="flex-row items-center">
                  <View className="w-11 h-11 bg-light-primary-red/10 rounded-full items-center justify-center mr-3">
                    <ShieldCheck color="#c71c4b" size={20} />
                  </View>
                  <View>
                    <Text className="text-light-matte-black font-medium">
                      Import Seed Phrase
                    </Text>
                    <Text className="text-light-matte-black/50 text-xs">
                      12 or 24 words, derives every chain
                    </Text>
                  </View>
                </View>
                <ChevronRight color="#20222c" size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                className="bg-light border border-light-matte-black/10 py-4 px-5 rounded-xl flex-row items-center justify-between"
                onPress={() => setPkSheetVisible(true)}
                disabled={creating}
              >
                <View className="flex-row items-center">
                  <View className="w-11 h-11 bg-light-primary-red/10 rounded-full items-center justify-center mr-3">
                    <KeyRound color="#c71c4b" size={20} />
                  </View>
                  <View>
                    <Text className="text-light-matte-black font-medium">
                      Import Private Key
                    </Text>
                    <Text className="text-light-matte-black/50 text-xs">
                      One chain: EVM or Solana
                    </Text>
                  </View>
                </View>
                <ChevronRight color="#20222c" size={18} />
              </TouchableOpacity>
            </View>

            <View className="items-center mt-auto">
              <Text className="text-light-matte-black/50 text-xs text-center max-w-80">
                By continuing, you agree to our Terms of Service and Privacy
                Policy
              </Text>
            </View>
          </View>
        </ScrollView>

        <ImportSeedPhraseSheet
          visible={seedSheetVisible}
          onClose={() => {
            setSeedSheetVisible(false);
            setSeedSheetForGoogle(false);
          }}
          onWalletsAdded={handleSeedWalletsAdded}
          tagSocial={seedSheetForGoogle ? googleAccount : null}
        />
        <ImportPrivateKeySheet
          visible={pkSheetVisible}
          onClose={() => setPkSheetVisible(false)}
          onWalletAdded={handlePrivateKeyWalletAdded}
          onImportSeedPhraseInstead={handleImportSeedPhraseInstead}
        />

        <GoogleOtpSheet
          visible={googleChallenge !== null}
          challenge={googleChallenge}
          onClose={() => setGoogleChallenge(null)}
          onVerified={handleOtpVerified}
          onExpired={handleOtpExpired}
        />

        <RestoreBackupSheet
          visible={restoreSheetVisible}
          onClose={() => setRestoreSheetVisible(false)}
          onRestored={handleBackupRestored}
          onUseSeedPhraseInstead={handleRestoreWithSeedInstead}
        />

        <AccountFoundSheet
          visible={accountFoundSheetVisible}
          onClose={() => setAccountFoundSheetVisible(false)}
          onRestoreFromDrive={handleRestoreFromDrive}
          onEnterRecoveryPhrase={handleEnterRecoveryPhrase}
          onCreateNewInstead={handleCreateNewFromAccountFound}
          emailMasked={emailMaskedRef.current}
        />

        <LoadinngSpinnerPopup
          visible={isCreatingSpinner}
          title="Creating Wallet"
          message={creatingMessage}
        />

        <LoadinngSpinnerPopup
          visible={isSigningInSpinner}
          title="Signing In"
          message={signingInMessage}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollViewContent: {
    flexGrow: 1,
  },
});
