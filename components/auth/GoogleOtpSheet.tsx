import { MailCheck } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import {
  type GoogleAuthError,
  type TGoogleAuthErrorCode,
  type TGoogleAuthResponse,
  type TGoogleChallenge,
  useResendGoogleOtp,
  useVerifyGoogleOtp,
} from "@/hooks/queries/useGoogleAuth";

const CODE_LENGTH = 6;
/** Seconds the user must wait before a resend is offered. */
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Fixed copy for every curated failure code. No server text, status line, or
 * SDK error string is ever rendered — see CLAUDE.md.
 */
const ERROR_COPY: Record<TGoogleAuthErrorCode, string> = {
  invalid_code: "That code isn't right. Check your email and try again.",
  session_expired: "This session expired. Please sign in again.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  email_undeliverable: "We couldn't send the email. Please try again.",
  account_conflict: "We couldn't sign you in with this account.",
  cancelled: "Sign-in was cancelled.",
  in_progress: "Sign-in is already in progress.",
  play_services_unavailable: "Google Play Services isn't available.",
  unknown: "Something went wrong. Please try again.",
};

const formatCountdown = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

interface GoogleOtpSheetProps {
  visible: boolean;
  challenge: TGoogleChallenge | null;
  onClose: () => void;
  onVerified: (response: TGoogleAuthResponse) => void;
  /** Raised when the challenge dies — the parent restarts sign-in from scratch. */
  onExpired: () => void;
}

/**
 * Second step of Google sign-in. The challenge grants nothing on its own; the
 * session is minted only when the emailed code is accepted here.
 */
export default function GoogleOtpSheet({
  visible,
  challenge,
  onClose,
  onVerified,
  onExpired,
}: GoogleOtpSheetProps) {
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const verifyOtp = useVerifyGoogleOtp();
  const resendOtp = useResendGoogleOtp();

  const isBusy = verifyOtp.isPending || resendOtp.isPending;
  const expired = secondsLeft <= 0;

  // Reset every time a new challenge opens the sheet, so a retry never
  // inherits the previous attempt's code, error, or countdown.
  useEffect(() => {
    if (!visible || !challenge) return;
    setCode("");
    setError(null);
    setSecondsLeft(challenge.expiresInSeconds);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const focus = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(focus);
  }, [visible, challenge]);

  useEffect(() => {
    if (!visible) return;
    const tick = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(tick);
  }, [visible]);

  const handleFailure = useCallback(
    (err: GoogleAuthError) => {
      setError(ERROR_COPY[err.code] ?? ERROR_COPY.unknown);
      setCode("");
      if (err.code === "session_expired") onExpired();
    },
    [onExpired],
  );

  const submit = useCallback(
    (value: string) => {
      if (!challenge || value.length !== CODE_LENGTH) return;
      setError(null);
      verifyOtp.mutate(
        { challengeId: challenge.challengeId, code: value },
        {
          onSuccess: onVerified,
          onError: handleFailure,
        },
      );
    },
    [challenge, verifyOtp, onVerified, handleFailure],
  );

  const handleChange = useCallback(
    (next: string) => {
      const digits = next.replace(/\D/g, "").slice(0, CODE_LENGTH);
      setCode(digits);
      if (error) setError(null);
      // Auto-submit the moment the last digit lands — no confirm tap needed.
      if (digits.length === CODE_LENGTH) submit(digits);
    },
    [error, submit],
  );

  const handleResend = useCallback(() => {
    if (!challenge || cooldown > 0) return;
    setError(null);
    setCode("");
    resendOtp.mutate(
      { challengeId: challenge.challengeId },
      {
        onSuccess: (next) => {
          setSecondsLeft(next.expiresInSeconds);
          setCooldown(RESEND_COOLDOWN_SECONDS);
          inputRef.current?.focus();
        },
        onError: handleFailure,
      },
    );
  }, [challenge, cooldown, resendOtp, handleFailure]);

  const boxes = useMemo(
    () => Array.from({ length: CODE_LENGTH }, (_, i) => i),
    [],
  );

  const resendLabel = resendOtp.isPending
    ? "Sending…"
    : cooldown > 0
      ? `Resend in ${cooldown}s`
      : "Resend code";

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      closeButtonDisabled={isBusy}
      height="auto"
      contentClassName="px-5"
    >
      <ModalHeader title="Verify your email" />

      <View className="pb-2">
        <View className="items-center mb-6">
          <View className="w-16 h-16 bg-light-primary-red/10 rounded-full items-center justify-center mb-4">
            <MailCheck color="#c71c4b" size={28} />
          </View>
          <Text className="text-light-matte-black/70 text-center text-sm leading-5 max-w-72">
            Enter the 6-digit code we sent to{" "}
            <Text className="text-light-matte-black font-semibold">
              {challenge?.emailMasked ?? "your email"}
            </Text>
            .
          </Text>
        </View>

        {/* One real input behind six painted boxes — keeps caret handling, */}
        {/* paste, and OTP autofill working without six-way focus juggling. */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          className="flex-row gap-2 mb-4"
        >
          {boxes.map((index) => {
            const char = code[index] ?? "";
            const isCursor = index === code.length && !expired;
            return (
              <View
                key={index}
                className={`flex-1 h-14 rounded-2xl items-center justify-center border ${
                  error
                    ? "border-light-primary-red bg-light-primary-red/5"
                    : isCursor
                      ? "border-light-primary-red bg-light"
                      : "border-light-matte-black/10 bg-light"
                }`}
              >
                <Text className="text-light-matte-black text-2xl font-bold">
                  {char}
                </Text>
              </View>
            );
          })}

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            editable={!isBusy && !expired}
            autoComplete={Platform.OS === "ios" ? "one-time-code" : "sms-otp"}
            textContentType="oneTimeCode"
            autoCorrect={false}
            spellCheck={false}
            caretHidden
            className="absolute w-full h-full opacity-0"
          />
        </Pressable>

        <View className="min-h-10 items-center justify-center mb-2">
          {verifyOtp.isPending ? (
            <ActivityIndicator size="small" color="#c71c4b" />
          ) : error ? (
            <Text className="text-light-primary-red text-sm text-center">
              {error}
            </Text>
          ) : expired ? (
            <Text className="text-light-primary-red text-sm text-center">
              This code expired. Request a new one.
            </Text>
          ) : (
            <Text className="text-light-matte-black/50 text-sm text-center">
              Code expires in {formatCountdown(secondsLeft)}
            </Text>
          )}
        </View>

        <View className="flex-row items-center justify-center">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleResend}
            disabled={cooldown > 0 || resendOtp.isPending}
            hitSlop={8}
          >
            <Text
              className={`text-sm font-semibold ${
                cooldown > 0 || resendOtp.isPending
                  ? "text-light-matte-black/30"
                  : "text-light-primary-red"
              }`}
            >
              {resendLabel}
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-light-matte-black/40 text-xs text-center mt-6 max-w-80 self-center">
          Never share this code. TakumiPay will never ask you for it.
        </Text>
      </View>
    </BaseModal>
  );
}
