import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Multi-variant Expo config, used by the release-it skill.
 *
 * APP_VARIANT is set by each build profile in eas.json:
 *  - development : dev client build
 *  - preview     : APK shared with testers outside the Play Store
 *  - production  : AAB for Google Play / App Store build
 *
 * Each variant gets its own application id, so all three can be installed
 * side by side and the preview APK never conflicts with the Play Store install.
 *
 * Unset APP_VARIANT resolves to "production" on purpose: `eas update`,
 * `eas submit` and fingerprint computation must see the production config
 * unless told otherwise (publish preview updates with APP_VARIANT=preview).
 *
 * Keep `expo.version` in app.json: it is read here through `config.version`
 * and bumped by scripts/bump-version.mjs.
 */

// ---- EDIT ME ---------------------------------------------------------
const APP_NAME = 'MyApp';
const APP_SLUG = 'my-app';
const APP_ID = 'com.mycompany.myapp'; // permanent after the first Play upload
// ----------------------------------------------------------------------

type Variant = 'development' | 'preview' | 'production';

const VARIANTS: Record<Variant, { idSuffix: string; nameSuffix: string }> = {
  development: { idSuffix: '.dev', nameSuffix: ' (Dev)' },
  preview: { idSuffix: '.preview', nameSuffix: ' (Beta)' },
  production: { idSuffix: '', nameSuffix: '' },
};

const raw = process.env.APP_VARIANT;
const VARIANT: Variant = raw && raw in VARIANTS ? (raw as Variant) : 'production';
const { idSuffix, nameSuffix } = VARIANTS[VARIANT];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `${APP_NAME}${nameSuffix}`,
  slug: config.slug ?? APP_SLUG,
  version: config.version ?? '1.0.0',

  // OTA updates only reach builds with the exact same native code.
  runtimeVersion: { policy: 'fingerprint' },

  android: {
    ...config.android,
    package: `${APP_ID}${idSuffix}`,
  },
  ios: {
    ...config.ios,
    bundleIdentifier: `${APP_ID}${idSuffix}`,
  },
  extra: {
    ...config.extra,
    appVariant: VARIANT,
  },
});
