import type { CapacitorConfig } from "@capacitor/cli";

/**
 * AimHub Android wrapper.
 *
 * AimHub is a server-rendered app, so the Android shell loads the deployed
 * AimHub URL. Set AIMHUB_APP_URL in the GitHub Actions workflow (or locally)
 * to the published site before running `npx cap sync android`.
 */
const config: CapacitorConfig = {
  appId: "app.aimhub.client",
  appName: "AimHub",
  webDir: "dist/client",
  server: {
    url: process.env["AIMHUB_APP_URL"] ?? "https://project--d7d72102-37b0-42bc-a4d3-da166e8af56e.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#0b0e13",
  },
};

export default config;
