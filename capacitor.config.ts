import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.accudone.app",
  appName: "AccuDone",
  webDir: "out",
  server: {
    // In development, load from the live Vercel URL instead of the local build.
    // Comment this out and use `npx next build && npx next export` for production builds.
    url: "https://construction-pm-theta.vercel.app",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#111010", // AccuDone dark — matches nav chrome
      showSpinner: true,
      spinnerColor: "#F5C800", // AccuDone yellow accent
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#111010",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Camera: {
      // Used for construction site photo capture
    },
    Geolocation: {
      // Used for GPS-tagged photos
    },
  },
  ios: {
    scheme: "AccuDone",
    contentInset: "automatic",
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
