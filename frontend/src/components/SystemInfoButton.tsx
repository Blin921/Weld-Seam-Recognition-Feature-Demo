"use client";
import { useId, useRef, type ReactNode } from "react";
import {
  X,
  Monitor,
  Server,
  Workflow,
  Camera,
  ShieldCheck,
} from "lucide-react";
type Topic = "architecture" | "about";
export default function SystemInfoButton({
  topic,
  children,
  className = "",
}: {
  topic: Topic;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    titleId = useId();
  const title =
    topic === "architecture" ? "技术架构与部署说明" : "关于焊缝识别系统";
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={"system-info-trigger " + className}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        {children}
      </button>
      <dialog
        ref={dialog}
        className="system-info-dialog"
        aria-labelledby={titleId}
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="system-info-sheet">
          <div className="system-info-heading">
            <div>
              <span>焊缝识别系统</span>
              <h2 id={titleId}>{title}</h2>
            </div>
            <button
              type="button"
              className="info-close"
              aria-label="关闭说明"
              onClick={() => dialog.current?.close()}
            >
              <X size={20} />
            </button>
          </div>
          <div className="system-info-body">
            {topic === "architecture" ? (
              <>
                <p className="system-info-lead">
                  浏览器负责展示与交互，后端负责计算与设备连接。前端和后端是两个独立服务。
                </p>
                <ol className="architecture-cards">
                  {[
                    {
                      icon: Monitor,
                      label: "01 · 浏览器与前端",
                      title: "Next.js · 3000 端口",
                      text: "展示点云、焊缝、标定结果及轨迹预演。浏览器通常访问 localhost:3000。",
                    },
                    {
                      icon: Workflow,
                      label: "02 · 同源接口代理",
                      title: "/api/* 统一入口",
                      text: "浏览器通过前端请求接口，由 Next.js 转发给后端。后端地址可用 BACKEND_ORIGIN 配置。",
                    },
                    {
                      icon: Server,
                      label: "03 · 计算与业务服务",
                      title: "FastAPI · 8000 端口",
                      text: "负责识别任务、标定计算、程序生成和 FTP 文件传输。真实服务需要单独启动。",
                    },
                  ].map((item) => (
                    <li key={item.label}>
                      <item.icon size={24} />
                      <small>{item.label}</small>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </li>
                  ))}
                </ol>
                <div className="info-device-row">
                  <Camera size={23} />
                  <div>
                    <h3>现场设备由后端连接</h3>
                    <p>
                      相机采集、C++ 解算器与机器人控制器的通信不在浏览器中执行。
                    </p>
                  </div>
                </div>
                <div className="info-callout">
                  <strong>演示模式走另一条路径</strong>
                  <p>
                    内置合成点云和示例轨迹在浏览器中处理，无需
                    FastAPI、模型、相机或机器人。不会向设备发送文件。
                  </p>
                </div>
                <p className="info-footnote">
                  当前仓库提供前端。连接真实设备前，仍需部署并联调项目组的
                  FastAPI 后端与设备环境。
                </p>
              </>
            ) : (
              <>
                <p className="system-info-lead">
                  焊缝识别系统
                  是焊缝识别与机器人轨迹规划的可视化展示前端，用于讲解完整业务流程，并为后端联调提供操作界面。
                </p>
                <h3>可以展示什么？</h3>
                <ul className="info-capabilities">
                  <li>管理点云帧，查看三维工件与焊缝位置。</li>
                  <li>展示相机坐标到机器人坐标的标定过程与误差。</li>
                  <li>生成程序预览，播放 TCP 工具尖端运动轨迹。</li>
                  <li>在真实后端接入后，确认并传输程序文件。</li>
                </ul>
                <div className="info-modes">
                  <section>
                    <h3>演示模式</h3>
                    <p>
                      点击首页“体验演示数据”即可进入。点云是合成数据，识别与标定结果是示例，不代表模型推理或现场精度。
                    </p>
                  </section>
                  <section>
                    <h3>真实模式</h3>
                    <p>
                      从 FastAPI
                      获取帧、任务与计算结果。后端未启动时会提示连接失败，不会自动用演示数据冒充真实结果。
                    </p>
                  </section>
                </div>
                <div className="info-callout">
                  <ShieldCheck size={22} />
                  <div>
                    <strong>只生成与传输文件，不启动机器人</strong>
                    <p>
                      演示下载为不可执行的示例文本。真实程序的坐标、姿态及现场运行，需要调试人员和操作者另行确认。
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="system-info-actions">
            <button
              type="button"
              className="primary"
              onClick={() => dialog.current?.close()}
            >
              知道了
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
