"use client";
import { usePathname } from "next/navigation";
import Workstation from "./Workstation";
import { useDemoMode } from "@/lib/useDemoMode";
export default function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  const demo = useDemoMode();
  return (
    <>
      <div hidden={path === "/"}>
        <Workstation key={demo ? "demo" : "backend"} />
      </div>
      {children}
    </>
  );
}
