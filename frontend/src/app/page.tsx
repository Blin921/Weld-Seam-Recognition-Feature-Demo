import Link from "next/link";
import {
  ScanLine,
  ScanSearch,
  Crosshair,
  Workflow,
  Upload,
} from "lucide-react";
import DemoEntry from "@/components/DemoEntry";
import SiteHeader from "@/components/SiteHeader";
import SystemInfoButton from "@/components/SystemInfoButton";
import FeatureIllustration from "@/components/FeatureIllustration";
import PointCloudIllustration from "@/components/PointCloudIllustration";
const features = [
  {
    id: "SCAN",
    title: "数据采集与管理",
    description: "系统状态监测、点云帧管理与相机采集",
    href: "/scan",
    icon: ScanLine,
  },
  {
    id: "RECOGNIZE",
    title: "AI焊缝识别",
    description: "识别工件、定位焊缝并展示三维识别结果",
    href: "/recognize",
    icon: ScanSearch,
  },
  {
    id: "CALIBRATE",
    title: "坐标标定",
    description: "建立相机坐标与机器人坐标的转换关系",
    href: "/calibration",
    icon: Crosshair,
  },
  {
    id: "SIMULATE",
    title: "程序生成与轨迹预演",
    description: "生成 FANUC 程序并预演 TCP 运动轨迹",
    href: "/program",
    icon: Workflow,
  },
  {
    id: "TRANSFER",
    title: "机器人程序下发",
    description: "连接控制器并传输已校验的程序文件",
    href: "/transfer",
    icon: Upload,
  },
];
export default function Home() {
  return (
    <main className="design-home">
      <SiteHeader />
      <section className="home-hero">
        <div className="home-copy">
          <div className="home-kicker">3D VISION / INTELLIGENT WELDING</div>
          <h1>
            看见每一道焊缝
            <br />
            规划每一步轨迹
          </h1>
          <h2>从三维点云到焊接轨迹的可视化工作站</h2>
          <p>
            基于 3D 点云与人工智能，连接工件识别、焊缝定位、
            <br />
            坐标标定与机器人程序生成的完整流程。
          </p>
          <div className="home-actions">
            <Link className="home-cta" href="/scan">
              进入工作台 →
            </Link>
            <DemoEntry />
          </div>
          <p className="demo-entry-help">
            无需后端 · 合成点云与轨迹 · 不连接机器人
          </p>
        </div>
        <PointCloudIllustration />
      </section>
      <section id="features" className="feature-section">
        <h2>一条完整流程，五个核心能力</h2>
        <div className="feature-grid">
          {features.map((f, i) => (
            <Link className="feature-card" href={f.href} key={f.id}>
              <strong>
                {String(i + 1).padStart(2, "0")} / {f.id}
              </strong>
              <f.icon size={27} strokeWidth={1.4} />
              <h3>{f.title}</h3>
              <p>{f.description}</p>
              <FeatureIllustration kind={f.id} />
              <span>查看详情 →</span>
            </Link>
          ))}
        </div>
      </section>
      <footer className="home-footer">
        <p className="home-disclaimer" id="about">
          合成示例 · 真实模式以后台响应为准 · 只生成与传输文件，不启动机器人
        </p>
        <div className="home-information">
          <Link href="/#features">功能中心</Link>
          <SystemInfoButton topic="architecture">技术架构</SystemInfoButton>
          <SystemInfoButton topic="about">关于系统</SystemInfoButton>
        </div>
        <SystemInfoButton topic="architecture" className="architecture">
          技术架构与部署说明
        </SystemInfoButton>
      </footer>
    </main>
  );
}
