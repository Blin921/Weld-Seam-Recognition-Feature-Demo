"use client";
import Link from "next/link";
import {
  Home,
  ScanLine,
  ScanSearch,
  Crosshair,
  Layers,
  Workflow,
  Send,
  Moon,
  Sun,
} from "lucide-react";
import SystemLogo from "./SystemLogo";
import DisplaySettings from "./DisplaySettings";
import { useTheme } from "@/lib/useTheme";
import { useDemoMode } from "@/lib/useDemoMode";
export default function SiteHeader() {
  const [dark, setDark] = useTheme();
  const demo = useDemoMode();
  return (
    <header className="site-header">
      <Link href="/" className="site-logo">
        <SystemLogo />
        焊缝识别系统
      </Link>
      <nav className="home-navigation" aria-label="系统导航">
        <Link href="/" aria-current="page">
          <Home size={15} />
          首页
        </Link>
        {[
          ["/scan", "数据采集", ScanLine],
          ["/recognize", "AI识别", ScanSearch],
          ["/calibration", "坐标标定", Crosshair],
          ["/seams", "焊缝管理", Layers],
          ["/program", "程序与预演", Workflow],
          ["/transfer", "程序下发", Send],
        ].map(([href, label, Icon]) => (
          <Link key={String(href)} href={String(href)}>
            {typeof Icon !== "string" && <Icon size={15} />} {String(label)}
          </Link>
        ))}
      </nav>
      <div className="home-header-actions">
        <span className="mode-chip">{demo ? "离线演示" : "工作台"}</span>
        <button
          className="theme-toggle"
          aria-label="切换深浅主题"
          title={dark ? "切换为浅色模式" : "切换为深色模式"}
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <DisplaySettings dark={dark} onTheme={setDark} demo={demo} />
      </div>
    </header>
  );
}
