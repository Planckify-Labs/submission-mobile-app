// TWV-2026-059 — Expo config plugin that wires the backup-exclusion
// XMLs into the managed Android project at prebuild time. Runs during
// `expo prebuild` / EAS build; a no-op for pure dev-client runs.
//
// Responsibilities:
//   1. Copy `./plugins/resources/data_extraction_rules.xml` into
//      `android/app/src/main/res/xml/data_extraction_rules.xml`.
//   2. Copy `./plugins/resources/backup_rules.xml` into
//      `android/app/src/main/res/xml/backup_rules.xml`.
//   3. Stamp `android:dataExtractionRules="@xml/data_extraction_rules"`
//      and `android:fullBackupContent="@xml/backup_rules"` onto the
//      `<application>` node in AndroidManifest.xml.
//   4. Stamp `android:allowBackup="false"` (belt-and-suspenders with
//      the `android.allowBackup: false` field in `app.config.ts`).

const fs = require("node:fs");
const path = require("node:path");
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("expo/config-plugins");

const EXTRACTION_SRC = path.join(
  __dirname,
  "resources",
  "data_extraction_rules.xml",
);
const BACKUP_SRC = path.join(__dirname, "resources", "backup_rules.xml");

function copyIfNewer(src, dst) {
  if (!fs.existsSync(src)) {
    throw new Error(`[withAndroidBackupRules] missing source ${src}`);
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const srcBuf = fs.readFileSync(src);
  if (fs.existsSync(dst)) {
    const dstBuf = fs.readFileSync(dst);
    if (srcBuf.equals(dstBuf)) return;
  }
  fs.writeFileSync(dst, srcBuf);
}

const withBackupXmlResources = (config) =>
  withDangerousMod(config, [
    "android",
    (cfg) => {
      const resXmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      copyIfNewer(
        EXTRACTION_SRC,
        path.join(resXmlDir, "data_extraction_rules.xml"),
      );
      copyIfNewer(BACKUP_SRC, path.join(resXmlDir, "backup_rules.xml"));
      return cfg;
    },
  ]);

const withBackupManifestAttrs = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
      cfg.modResults,
    );
    app.$["android:allowBackup"] = "false";
    app.$["android:dataExtractionRules"] = "@xml/data_extraction_rules";
    app.$["android:fullBackupContent"] = "@xml/backup_rules";
    return cfg;
  });

module.exports = function withAndroidBackupRules(config) {
  config = withBackupXmlResources(config);
  config = withBackupManifestAttrs(config);
  return config;
};
