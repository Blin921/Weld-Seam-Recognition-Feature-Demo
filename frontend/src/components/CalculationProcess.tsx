"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  Check,
  Circle,
  Pause,
  Play,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import {
  calculationPhase,
  calculationStages,
  type Calculation,
  type CalculationKind,
} from "@/lib/calculation";
export default function CalculationProcess({
  operation,
  kind,
  paused,
  onPause,
  onReplay,
  disabled,
}: {
  operation: Calculation | null;
  kind: CalculationKind;
  paused: boolean;
  onPause: () => void;
  onReplay: () => void;
  disabled: boolean;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!operation || operation.status !== "running" || !operation.demo) return;
    const timer = setInterval(() => {
      if (!document.hidden && !paused) setNow(Date.now());
    }, 180);
    return () => clearInterval(timer);
  }, [operation, paused]);
  const spec = calculationStages[operation?.kind ?? kind];
  const phase = calculationPhase(operation, now || operation?.startedAt || 0);
  const running = operation?.status === "running";
  return (
    <section
      className="calculation-card"
      aria-label="计算过程展示"
      data-kind={operation?.kind ?? kind}
      data-state={operation?.status ?? "idle"}
      data-paused={paused}
    >
      <div className="calculation-heading">
        <Activity size={16} />
        <strong>计算过程</strong>
        <span>
          {operation?.illustration
            ? "动画示意"
            : operation?.demo
              ? "模拟过程"
              : operation
                ? "后台任务"
                : "流程说明"}
        </span>
      </div>
      <div className="calculation-title">
        <b>{spec.title}</b>
        <span>
          {running
            ? "进行中"
            : operation?.status === "done"
              ? "已完成"
              : operation?.status === "error"
                ? "未完成"
                : "等待操作"}
        </span>
      </div>
      <div className="calculation-diagram" aria-hidden="true">
        {(operation?.kind ?? kind) === "calibration" ? (
          <svg viewBox="0 0 300 48">
            <path
              className="process-wire"
              d="M50 34h70M50 34V6m140 28h70m-70 0V6M68 23Q150 -12 232 23"
            />
            <text x="13" y="46">
              相机系
            </text>
            <text x="239" y="46">
              基座系
            </text>
            <circle
              className={running ? "coordinate-dot animated" : "coordinate-dot"}
              cx="68"
              cy="23"
              r="5"
            />
            <circle cx="232" cy="23" r="4" />
          </svg>
        ) : (operation?.kind ?? kind) === "transfer" ? (
          <svg viewBox="0 0 300 48">
            <rect x="18" y="8" width="55" height="33" rx="4" />
            <rect x="227" y="8" width="55" height="33" rx="4" />
            <path className="process-wire" d="M73 24h154" />
            <path d="M33 17h24m-24 8h16m192-8h24m-24 8h16" />
            <rect
              className={running ? "file-packet animated" : "file-packet"}
              x="90"
              y="17"
              width="13"
              height="14"
              rx="2"
            />
          </svg>
        ) : ["program", "inspect"].includes(operation?.kind ?? kind) ? (
          <svg viewBox="0 0 300 48">
            <path
              className="process-wire trajectory-wire"
              d="M18 35L80 14 143 32 214 12 282 30"
            />
            {[
              [18, 35],
              [80, 14],
              [143, 32],
              [214, 12],
              [282, 30],
            ].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="4" />
                <text x={x} y={y - 7}>
                  P{i + 1}
                </text>
              </g>
            ))}
            <circle
              className={running ? "trajectory-dot animated" : "trajectory-dot"}
              r="5"
              cx="18"
              cy="35"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 300 48">
            <path className="process-wire" d="M22 24H278" />
            {[32, 110, 190, 268].map((x, i) => (
              <g
                key={x}
                className={running ? "process-node animated" : "process-node"}
                style={{ animationDelay: `${i * 180}ms` }}
              >
                <circle cx={x} cy="24" r={i === 0 || i === 3 ? 13 : 7} />
                <path d={`M${x - 4} 24h8m-4-4v8`} />
              </g>
            ))}
            <circle
              className={running ? "process-packet animated" : "process-packet"}
              cx="32"
              cy="24"
              r="4"
            />
          </svg>
        )}
        <span>{spec.formula}</span>
      </div>
      <details
        className="calculation-step-details"
        open={running || operation?.status === "error"}
      >
        <summary>
          {operation && !operation.demo ? "参考流程" : "处理步骤"}{" "}
          <span>
            {operation && !operation.demo
              ? "未提供阶段进度"
              : operation?.status === "done"
                ? "已完成"
                : running
                  ? "正在处理"
                  : "查看流程"}
          </span>
        </summary>
        <ol className="calculation-stages">
          {spec.stages.map((stage, i) => (
            <li
              key={stage}
              className={
                operation?.status === "error"
                  ? "failed"
                  : i < phase
                    ? "complete"
                    : running && i === phase
                      ? "current"
                      : ""
              }
            >
              {i < phase ? (
                <Check size={13} />
              ) : operation?.status === "error" && i === 0 ? (
                <AlertTriangle size={13} />
              ) : (
                <Circle size={11} />
              )}
              <span>{stage}</span>
              <small>
                {i < phase
                  ? "完成"
                  : running && i === phase
                    ? operation?.demo
                      ? "模拟中"
                      : "等待后台"
                    : ""}
              </small>
            </li>
          ))}
        </ol>
      </details>
      <p className="calculation-detail" aria-live="polite">
        {operation?.detail || "执行操作后展示处理过程与结果。"}
      </p>
      <div className="calculation-actions">
        <button
          type="button"
          onClick={onPause}
          aria-pressed={paused}
          title="仅暂停展示动画，不中断后台任务"
        >
          {paused ? <Play size={13} /> : <Pause size={13} />}{" "}
          {paused ? "继续动画" : "暂停动画"}
        </button>
        <button type="button" onClick={onReplay} disabled={disabled}>
          <RotateCcw size={13} /> 演示计算过程
        </button>
      </div>
    </section>
  );
}
