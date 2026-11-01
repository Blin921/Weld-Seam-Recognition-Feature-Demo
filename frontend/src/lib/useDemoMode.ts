"use client";
import { useSyncExternalStore } from "react";
import { isDemoMode } from "./demo";
const subscribe = (onChange: () => void) => {
  window.addEventListener("weld-demo-mode", onChange);
  return () => window.removeEventListener("weld-demo-mode", onChange);
};
export function useDemoMode() {
  return useSyncExternalStore(subscribe, isDemoMode, () => false);
}
