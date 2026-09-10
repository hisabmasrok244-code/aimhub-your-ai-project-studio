import type { CapacitorConfig } from "@capacitor/cli";

/**
 * AimHub Android configuration
 *
 * The Android app loads the published AimHub web app.
 * AIMHUB_APP_URL can be supplied by GitHub Actions.
 */

const DEFAULT_APP_URL =
  "https://project--d7d72102-37b0-42bc-a4d3-da166e8af56e.lovable.app";

const configuredUrl = process.env["AIMHUB_APP_URL"]?.trim();

const appUrl = configuredUrl || DEFAULT_APP_URL;

const config: CapacitorConfig = {
  appId: "app.aimhub.client",
  appName: "AimHub",

  // Capacitor requires this directory to exist during sync.
  webDir: "dist/client",

  server: {
    // Never allow an empty URL.
    url: appUrl,

    cleartext: false,
    androidScheme: "https",
  },

  android: {
    backgroundColor: "#0b0e13",
  },
};

export default config;
