import { isDemoMode, demoRequest } from "./demo";
export function requestApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return isDemoMode() ? demoRequest(path, init) : fetch("/api" + path, init);
}
