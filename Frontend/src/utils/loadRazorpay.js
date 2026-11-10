/**
 * Utility to load the official Razorpay Standard Checkout SDK dynamically.
 * Prevents loading duplicate scripts and provides a clean promise interface.
 */

let loadPromise = null;

export function loadRazorpayScript() {
  // Guard against server-side rendering
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new Error("Razorpay Checkout can only be initialized in a browser environment.")
    );
  }

  // If Razorpay SDK is already loaded on the window, resolve immediately
  if (typeof window.Razorpay === "function") {
    return Promise.resolve(true);
  }

  // If already loading, return existing promise to avoid duplicate script tags
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

    // Check if script tag was already injected elsewhere
    const existingScript = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existingScript) {
      if (typeof window.Razorpay === "function") {
        resolve(true);
        return;
      }
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener(
        "error",
        () => {
          loadPromise = null;
          reject(new Error("Failed to load Razorpay checkout SDK."));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      if (typeof window.Razorpay === "function") {
        resolve(true);
      } else {
        loadPromise = null;
        reject(new Error("Razorpay SDK loaded but window.Razorpay is undefined."));
      }
    };

    script.onerror = () => {
      loadPromise = null;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      reject(
        new Error(
          "Failed to load Razorpay payment gateway. Please check your internet connection or ad blocker."
        )
      );
    };

    document.body.appendChild(script);
  });

  return loadPromise;
}

export default loadRazorpayScript;
