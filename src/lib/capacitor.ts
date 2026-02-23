/**
 * Capacitor Native Bridge Utilities
 *
 * Provides safe wrappers around Capacitor plugins that gracefully
 * degrade when running in a normal browser (non-native) context.
 *
 * Usage:
 *   import { isNative, takePhoto, getCurrentPosition, vibrate } from "@/lib/capacitor";
 */

import { Capacitor } from "@capacitor/core";

// ──────────────────────────────────────────────
// Platform Detection
// ──────────────────────────────────────────────

/** True when running inside a Capacitor native shell (iOS / Android). */
export const isNative = Capacitor.isNativePlatform();

/** Returns "ios" | "android" | "web" */
export const platform = Capacitor.getPlatform();

// ──────────────────────────────────────────────
// Camera
// ──────────────────────────────────────────────

export interface PhotoResult {
  /** Base-64 encoded image data or a file URI depending on resultType. */
  dataUrl: string;
  /** MIME format, e.g. "image/jpeg" */
  format: string;
}

/**
 * Take a photo using the device camera (native) or file picker (web fallback).
 * Returns null if the plugin is unavailable or the user cancels.
 */
export async function takePhoto(): Promise<PhotoResult | null> {
  if (!Capacitor.isPluginAvailable("Camera")) return null;

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      "@capacitor/camera"
    );
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt, // Let user choose camera or gallery
      width: 1920,
      height: 1920,
      correctOrientation: true,
    });
    return photo.dataUrl
      ? { dataUrl: photo.dataUrl, format: photo.format }
      : null;
  } catch {
    // User cancelled or permission denied
    return null;
  }
}

// ──────────────────────────────────────────────
// Geolocation
// ──────────────────────────────────────────────

export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

/**
 * Get the device's current GPS position.
 * Falls back to browser Geolocation API on web.
 * Returns null if unavailable or denied.
 */
export async function getCurrentPosition(): Promise<Position | null> {
  if (!Capacitor.isPluginAvailable("Geolocation")) {
    // Web fallback via browser API
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp,
            }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10_000 }
        );
      });
    }
    return null;
  }

  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// Haptics
// ──────────────────────────────────────────────

/**
 * Trigger a light haptic vibration. No-op on web.
 */
export async function vibrate(
  style: "light" | "medium" | "heavy" = "light"
): Promise<void> {
  if (!Capacitor.isPluginAvailable("Haptics")) return;

  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] });
  } catch {
    // Silently ignore on unsupported platforms
  }
}

// ──────────────────────────────────────────────
// Push Notifications
// ──────────────────────────────────────────────

/**
 * Request push notification permission and register for remote notifications.
 * Returns the FCM/APNS token or null if unavailable/denied.
 */
export async function registerPushNotifications(): Promise<string | null> {
  if (!Capacitor.isPluginAvailable("PushNotifications")) return null;

  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return null;

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener("registration", (token) => {
        resolve(token.value);
      });
      PushNotifications.addListener("registrationError", () => {
        resolve(null);
      });
      // Timeout after 10 s
      setTimeout(() => resolve(null), 10_000);
    });
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// Status Bar
// ──────────────────────────────────────────────

/**
 * Set the device status bar style. No-op on web.
 */
export async function setStatusBarDark(dark: boolean): Promise<void> {
  if (!Capacitor.isPluginAvailable("StatusBar")) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  } catch {
    // Ignore
  }
}
