"use client";
import { useEffect, useRef } from "react";
import { Settings2, Moon, Sun } from "lucide-react";
export default function DisplaySettings({
  dark,
  onTheme,
  demo = false,
}: {
  dark: boolean;
  onTheme: (dark: boolean) => void;
  demo?: boolean;
}) {
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node))
        panel.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panel.current) panel.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const choose = (value: boolean) => {
    onTheme(value);
    if (panel.current) panel.current.open = false;
  };
  return (
    <details ref={panel} className="display-settings">
      <summary aria-label="显示设置" title="显示设置">
        <Settings2 size={19} />
      </summary>
      <div role="group" aria-label="主题设置">
        <strong>显示主题</strong>
        <button onClick={() => choose(false)} aria-pressed={!dark}>
          <Sun size={15} />
          浅色
        </button>
        <button onClick={() => choose(true)} aria-pressed={dark}>
          <Moon size={15} />
          暗色
        </button>
        <small>主题会在页面切换后保留</small>
        {demo && (
          <details className="workspace-help">
            <summary>演示说明</summary>
            <div>
              使用合成点云与示例轨迹，无真实推理、无真实标定。模拟下发不会连接设备，下载的演示文本不可用于机器人。
            </div>
          </details>
        )}
      </div>
    </details>
  );
}
