"use client";
import { useEffect, useSyncExternalStore } from "react";
let memoryDark = false;
const eventName = "weld-theme-change";
function getSnapshot() {
  try {
    const saved = localStorage.getItem("weld-vision-theme");
    return saved ? saved === "dark" : memoryDark;
  } catch {
    return memoryDark;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", callback);
  };
}
export function useTheme(): [boolean, (dark: boolean) => void] {
  const dark = useSyncExternalStore(subscribe, getSnapshot, () => false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  return [
    dark,
    (next) => {
      memoryDark = next;
      try {
        localStorage.setItem("weld-vision-theme", next ? "dark" : "light");
      } catch {
        /* Local file browsers may disable persistent storage. */
      }
      window.dispatchEvent(new Event(eventName));
    },
  ];
}
