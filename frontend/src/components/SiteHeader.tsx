import Link from "next/link";
import SystemLogo from "./SystemLogo";
import SystemInfoButton from "./SystemInfoButton";
export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-logo">
        <SystemLogo /> 焊缝识别系统
      </Link>
      <span className="site-subtitle">三维视觉 · 轨迹规划</span>
      <nav>
        <Link href="/">首页</Link>
        <Link href="/#features">功能中心</Link>
        <SystemInfoButton topic="architecture">技术架构</SystemInfoButton>
        <SystemInfoButton topic="about">关于系统</SystemInfoButton>
        <span>仅文件生成与传输</span>
      </nav>
    </header>
  );
}
