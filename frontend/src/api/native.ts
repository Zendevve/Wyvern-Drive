/**
 * Native-runtime detection.
 *
 * Grounded in @wailsio/runtime's own transport probe: dist/system.js builds
 * `_invoke` by looking for exactly these host-injected message channels, and
 * falls back to null (with a "Browser Environment Detected" warning) when
 * none exists, in which case binding calls cannot reach Go:
 * - Windows WebView2 injects window.chrome.webview.postMessage
 * - macOS/iOS WKWebView injects window.webkit.messageHandlers.external.postMessage
 * - Android injects window.wails.invoke
 *
 * Deliberately NOT window._wails: the runtime JS creates that namespace
 * unconditionally on import (dist/calls.js, dist/index.js set
 * `window._wails = window._wails || {}` whenever a DOM exists), so its
 * presence proves only that the script loaded, not that a native host is
 * behind it.
 */
export const BROWSER_DISABLED_MESSAGE =
  "Open this build in Wyvern Drive desktop. Browser access is not enabled in this milestone.";

interface ChromeWebView {
  webview?: { postMessage?: unknown };
}

interface WebKitHandlers {
  messageHandlers?: { external?: { postMessage?: unknown } };
}

interface WailsAndroid {
  invoke?: unknown;
  invokeAsync?: unknown;
}

export function isNativeRuntime(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window as unknown as Record<string, unknown>;
    const chrome = w["chrome"] as ChromeWebView | undefined;
    if (typeof chrome?.webview?.postMessage === "function") return true;
    const webkit = w["webkit"] as WebKitHandlers | undefined;
    if (
      typeof webkit?.messageHandlers?.external?.postMessage === "function"
    ) {
      return true;
    }
    const wails = w["wails"] as WailsAndroid | undefined;
    if (
      typeof wails?.invoke === "function" ||
      typeof wails?.invokeAsync === "function"
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
