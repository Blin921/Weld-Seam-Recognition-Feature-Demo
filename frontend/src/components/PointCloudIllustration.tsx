"use client";
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import CloudView from "./CloudView";
import { demoCloud, demoSeams } from "@/lib/demo";
import { parseCloud, type Vec } from "@/lib/core";
import { useTheme } from "@/lib/useTheme";
const empty: Vec[] = [];
export default function PointCloudIllustration() {
  const cloud = useMemo(() => parseCloud(demoCloud("DEMO_PIPE_A")), []);
  const seams = useMemo(() => demoSeams("DEMO_PIPE_A"), []);
  const [mode, setMode] = useState("semantic"),
    [size, setSize] = useState(2),
    [reset, setReset] = useState(0);
  const [dark] = useTheme();
  return (
    <div className="hero-cloud">
      <CloudView
        cloud={cloud}
        seams={seams}
        selected={1}
        mode={mode}
        size={size}
        reset={reset}
        points={empty}
        wpr={empty}
        distance={0}
        light={!dark}
      />
      <div className="hero-view-tools">
        <div>
          {[
            ["semantic", "语义"],
            ["instance", "实例"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={mode === value ? "active" : ""}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          点大小
          <input
            aria-label="首页点大小"
            type="range"
            min={1}
            max={6}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
          <span>{size}</span>
        </label>
        <button onClick={() => setReset((value) => value + 1)}>
          <RotateCcw size={14} />
          重置视角
        </button>
      </div>
      <small className="hero-cloud-caption">
        合成示例点云 · 左键旋转 / 滚轮缩放 / 右键平移
      </small>
    </div>
  );
}
