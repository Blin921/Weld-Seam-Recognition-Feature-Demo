import Link from "next/link";
export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-logo">
        <span>◈</span> WELD VISION
      </Link>
      <span className="site-subtitle">智能焊接视觉系统</span>
      <nav>
        <Link href="/">首页</Link>
        <Link href="/#features">功能中心</Link>
        <Link href="/#architecture">技术架构</Link>
        <Link href="/#about">关于系统</Link>
        <span>仅文件生成与传输</span>
      </nav>
    </header>
  );
}
