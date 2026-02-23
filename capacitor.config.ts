import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.constructionpm.app",
  appName: "Construction PM",
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
      backgroundColor: "#1e293b", // slate-800 — matches app theme
      showSpinner: true,
      spinnerColor: "#3b82f6", // blue-500
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1e293b",
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
    scheme: "ConstructionPM",
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
