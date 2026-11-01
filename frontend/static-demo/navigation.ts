import { useSyncExternalStore } from "react";

export function routeHash(href: string) {
  return href.startsWith("#") ? "#/#" + href.slice(1) : "#" + href;
}
function currentPath() {
  const path = window.location.hash.slice(1).split("#")[0];
  return path.startsWith("/") ? path : "/";
}
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
export function usePathname() {
  return useSyncExternalStore(subscribe, currentPath, () => "/");
}
const router = {
  push(href: string) {
    window.location.hash = routeHash(href);
  },
  back() {
    window.history.back();
  },
};
export function useRouter() {
  return router;
}
