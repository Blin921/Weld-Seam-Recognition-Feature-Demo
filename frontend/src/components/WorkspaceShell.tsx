"use client";
import { usePathname } from "next/navigation";
import Workstation from "./Workstation";
export default function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <>
      <div hidden={path === "/"}>
        <Workstation />
      </div>
      {children}
    </>
  );
}
