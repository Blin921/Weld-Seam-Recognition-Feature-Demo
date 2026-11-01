import type { Metadata } from "next";
import "./globals.css";
import "./industrial.css";
import WorkspaceShell from "@/components/WorkspaceShell";
export const metadata: Metadata = {
  title: "焊缝识别系统 · 三维视觉工作站",
  description: "点云识别、标定与机器人程序预演",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <WorkspaceShell>{children}</WorkspaceShell>
      </body>
    </html>
  );
}
