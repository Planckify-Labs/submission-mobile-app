import type { ConfigContext, ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getBundleId = () => {
  if (IS_DEV) return "com.planckify.takumiwallet.dev";
  if (IS_PREVIEW) return "com.planckify.takumiwallet.preview";
  return "com.planckify.takumiwallet";
};

const getAppName = () => {
  if (IS_DEV) return "Takumi Wallet (Dev)";
  if (IS_PREVIEW) return "Takumi Wallet (Preview)";
  return "Takumi Wallet";
};

const getScheme = () => {
  if (IS_DEV) return "takumiwallet-dev";
  if (IS_PREVIEW) return "takumiwallet-preview";
  return "takumiwallet";
};

// TWV-2026-055 — EAS Update code signing is REQUIRED in production.
// The production channel's private signing key lives in AWS KMS (or an
// HSM); the CI role is sign-only. Two-person approval is enforced via
// the KMS IAM policy. See `docs/runbooks/eas-update-signing.md` for the
// ceremony. Do NOT inline the private key anywhere in this file, the
// repo, or CI env vars. A checked-in private key is an emergency.
//
// The public certificate + metadata below are referenced per the Expo
// docs: https://docs.expo.dev/eas-update/code-signing/. The bundle
// refuses any manifest whose signature does not verify against the
// shipped certificate; client-side additionally rejects non-monotonic
// timestamps (see `services/security/updateVerifier.ts`).

const CODE_SIGNING_CERTIFICATE = "./certs/eas-update-prod.pem";
const CODE_SIGNING_METADATA = {
  keyid: "eas-update-prod-2026",
  alg: "rsa-v1_5-sha256",
} as const;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: "takumiwallet",
  version: "2.2.0",
  runtimeVersion: { policy: "fingerprint" },
  updates: {
    fallbackToCacheTimeout: 0,
    // Only the production binary requires code signing. Dev / Preview
    // build without signing so engineers can still iterate, but those
    // variants are never shipped to end users.
    ...(IS_DEV || IS_PREVIEW
      ? {}
      : {
          codeSigningCertificate: CODE_SIGNING_CERTIFICATE,
          codeSigningMetadata: CODE_SIGNING_METADATA,
        }),
  },
  orientation: "portrait",
  icon: "./assets/images/takumipay-logo.png",
  scheme: getScheme(),
  userInterfaceStyle: "automatic",
  jsEngine: "hermes",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    jsEngine: "hermes",
    bundleIdentifier: getBundleId(),
    icon: {
      light: "./assets/icons/light.png",
      dark: "./assets/icons/dark.png",
    },
    // TWV-2026-024 — Universal Links. Custom URL schemes
    // (`takumiwallet://`) are NOT exclusively registrable; a phishing
    // app can register the same scheme and intercept WalletConnect
    // pairing URIs. AASA hosted at
    // `https://takumi.wallet/.well-known/apple-app-site-association`
    // verifies this app as the sole opener for `https://takumi.wallet/*`.
    associatedDomains: ["applinks:takumi.wallet"],
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#f5f6f9",
    },
    jsEngine: "hermes",
    edgeToEdgeEnabled: true,
    package: getBundleId(),
    // TWV-2026-059 — disable `adb backup` and Auto Backup. The wallet's
    // credentials live in Android Keystore via SecureStore, which is
    // excluded from `adb backup` by default, but a wallet binary must
    // not let any side-file (MMKV, AsyncStorage, Expo FileSystem) leak
    // via the USB debugging surface either. `dataExtractionRules` (API
    // 31+) and `fullBackupContent` (legacy) are referenced via
    // `manifestPlaceholders` / `extraManifestAttrs`; the ruleset XML
    // files live under `./android/data_extraction_rules.xml` and
    // `./android/backup_rules.xml` in the config-plugin output.
    allowBackup: false,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
    ],
    // TWV-2026-024 — verified Android App Links. assetlinks.json at
    // `https://takumi.wallet/.well-known/assetlinks.json` is verified
    // by Play / Android on first install; until verification succeeds,
    // the system shows a disambiguation dialog instead of opening the
    // wallet — never auto-routes to a phishing app that registered the
    // same `https` host.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "takumi.wallet" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "server",
    favicon: "./assets/images/takumipay-no-bg.png",
  },
  plugins: [
    "./plugins/withAndroidBackupRules",
    "expo-router",
    [
      "expo-camera",
      {
        image: "./assets/images/takumipay-logo.png",
        imageWidth: 100,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#f5f6f9",
        image: "./assets/images/splash-icon-light.png",
        dark: {
          image: "./assets/images/splash-icon-dark.png",
          backgroundColor: "#000000",
        },
        light: {
          image: "./assets/images/splash-icon-light.png",
          backgroundColor: "#f5f6f9",
        },
        imageWidth: 150,
      },
    ],
    "expo-secure-store",
    [
      "expo-web-browser",
      {
        experimentalLauncherActivity: true,
      },
    ],
    "expo-font",
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme:
          "com.googleusercontent.apps.744419386674-851aigcjotu3nakge5l3drbk9dpij9ah",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  owner: "cstralpt",
  extra: {
    router: {},
    eas: {
      projectId: "b9724893-72a7-440c-98a9-950ff3537f30",
    },
    // TWV-2026-065 — commit hash shown on the About screen. EAS sets
    // `EAS_BUILD_GIT_COMMIT_HASH`; GitHub Actions sets `GITHUB_SHA`.
    // Local dev falls back to "local-dev" so the screen still renders.
    commitHash:
      process.env.EAS_BUILD_GIT_COMMIT_HASH ??
      process.env.GITHUB_SHA ??
      "local-dev",
    // TWV-2026-065 — which EAS profile produced this binary. Consumed
    // by `constants/about.ts` / `app/about.tsx` to pick the right
    // signing-cert fingerprint row.
    appVariant: IS_DEV ? "development" : IS_PREVIEW ? "preview" : "production",
  },
});
