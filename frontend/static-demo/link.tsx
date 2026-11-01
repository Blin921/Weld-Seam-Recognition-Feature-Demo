import type { AnchorHTMLAttributes } from "react";
import { routeHash } from "./navigation";
export default function Link({
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} href={routeHash(href)} />;
}
