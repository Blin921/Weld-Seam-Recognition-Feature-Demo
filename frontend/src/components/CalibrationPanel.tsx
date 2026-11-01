"use client";
import { useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  AlertTriangle,
  Settings2,
  ArrowRight,
} from "lucide-react";
import type { Calib, Frame } from "@/lib/core";
export const DEMO_CALIBRATION_PAIRS = [
  [0, 0, 500, 320, 125, 480],
  [100, 0, 500, 420, 125, 480],
  [0, 100, 500, 320, 225, 480],
];
type ControlsProps = {
  demo: boolean;
  fid: string;
  frames: Frame[];
  calib: Calib;
  busy: boolean;
  locked: boolean;
  pairs: number[][];
  setPairs: (pairs: number[][]) => void;
  matrixMode: boolean;
  setMatrixMode: (matrix: boolean) => void;
  matrix: string;
  setMatrix: (text: string) => void;
  onFrame: (id: string) => void;
  onSave: (sample?: number[][]) => void;
  onClear: () => void;
};
export function CalibrationControls(p: ControlsProps) {
  const [open, setOpen] = useState(false);
  const saved = !p.calib.uncalibrated;
  const warning = (p.calib.max_dev_mm ?? 0) > 1.5;
  return (
    <section className="calibration-controls">
      <p className="calibration-intro">
        把相机识别的位置，转换为机器人可使用的位置。
      </p>
      <label className="calibration-frame">
        选择标定工件
        <select
          aria-label="选择标定工件"
          value={p.fid}
          disabled={p.busy || p.locked}
          onChange={(e) => p.onFrame(e.target.value)}
        >
          <option value="" disabled>
            请选择点云帧
          </option>
          {p.frames.map((f) => (
            <option key={f.id} value={f.id}>
              {f.id}
            </option>
          ))}
        </select>
      </label>
      <ol className="calibration-flow">
        {["准备对应位置", "建立坐标关系", "检查标定精度"].map((label, i) => (
          <li
            key={label}
            className={
              saved
                ? i === 2 && warning
                  ? "needs-review"
                  : "complete"
                : i === 0
                  ? "current"
                  : ""
            }
          >
            <span>{saved && !(i === 2 && warning) ? "✓" : i + 1}</span>
            <div>
              <strong>{label}</strong>
              <p>
                {
                  [
                    "选取同一位置的对应点",
                    "建立相机到机器人的转换",
                    "查看误差并确认精度",
                  ][i]
                }
              </p>
            </div>
          </li>
        ))}
      </ol>
      <button
        className="primary full"
        disabled={!p.fid || p.busy || p.locked}
        onClick={() => {
          if (p.demo) {
            p.setPairs(DEMO_CALIBRATION_PAIRS.map((row) => [...row]));
            p.setMatrixMode(false);
            p.onSave(DEMO_CALIBRATION_PAIRS);
          } else setOpen(true);
        }}
      >
        {p.busy
          ? "正在保存…"
          : p.demo
            ? saved
              ? "重新演示标定"
              : "开始演示标定"
            : saved
              ? "重新标定"
              : "配置标定数据"}
      </button>
      <p className="calibration-note">
        {p.demo
          ? "演示只展示流程与示例结果，不进行真实标定。"
          : "真实标定需调试人员提供测量数据，请在高级调试中配置。"}
      </p>
      <details
        className="calibration-advanced"
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary>
          <Settings2 size={16} />
          高级调试 · 点对与矩阵
        </summary>
        <div className="calibration-editor">
          <p className="help">
            每帧独立标定。至少 3
            组非共线对应点，坐标单位为毫米；相机坐标不是相机内参。
          </p>
          {p.demo && (
            <button
              className="secondary full"
              disabled={p.busy}
              onClick={() => {
                p.setMatrixMode(false);
                p.setPairs(DEMO_CALIBRATION_PAIRS.map((row) => [...row]));
              }}
            >
              填入示例点对
            </button>
          )}
          <label className="toggle-row">
            JSON / 4×4 矩阵模式
            <input
              type="checkbox"
              checked={p.matrixMode}
              onChange={(e) => p.setMatrixMode(e.target.checked)}
            />
          </label>
          {p.matrixMode ? (
            <textarea
              aria-label="标定矩阵 JSON"
              rows={8}
              placeholder='{"matrix": [[1,0,0,0], ...]}'
              value={p.matrix}
              onChange={(e) => p.setMatrix(e.target.value)}
            />
          ) : (
            <div className="pair-list">
              {p.pairs.map((row, i) => (
                <div key={i}>
                  <h4>
                    点对 {i + 1}
                    <button
                      disabled={p.busy}
                      onClick={() =>
                        p.setPairs(p.pairs.filter((_, j) => j !== i))
                      }
                    >
                      删除
                    </button>
                  </h4>
                  <small>相机 X / Y / Z　→　基座 X / Y / Z</small>
                  <div className="pair-grid">
                    {row.map((v, j) => (
                      <input
                        aria-label={`点对${i + 1}坐标${j + 1}`}
                        key={j}
                        type="number"
                        step="any"
                        value={v}
                        onChange={(e) =>
                          p.setPairs(
                            p.pairs.map((r, k) =>
                              k === i
                                ? r.map((n, l) =>
                                    l === j ? Number(e.target.value) : n,
                                  )
                                : r,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
              <button
                className="secondary full"
                disabled={p.busy}
                onClick={() => p.setPairs([...p.pairs, [0, 0, 0, 0, 0, 0]])}
              >
                ＋ 添加点对
              </button>
            </div>
          )}
          <button
            className="primary full"
            disabled={
              !p.fid ||
              p.busy ||
              p.locked ||
              (!p.matrixMode && p.pairs.length < 3)
            }
            onClick={() => p.onSave()}
          >
            保存标定
          </button>
          <dl className="calibration-technical">
            <dt>标定标签</dt>
            <dd>{p.calib.calib_tag}</dd>
            <dt>输入方式</dt>
            <dd>
              {p.calib.input_kind === "matrix"
                ? "矩阵"
                : p.calib.input_kind === "pairs"
                  ? "对应点"
                  : "尚未提供"}
            </dd>
          </dl>
          <button
            className="text-danger"
            disabled={!p.fid || p.busy || p.locked}
            onClick={p.onClear}
          >
            清除当前帧标定
          </button>
        </div>
      </details>
    </section>
  );
}
export function CalibrationResults({
  calib,
  demo,
  onNext,
}: {
  calib: Calib;
  demo: boolean;
  onNext: () => void;
}) {
  const saved = !calib.uncalibrated,
    hasResidual = calib.max_dev_mm !== undefined,
    warning = (calib.max_dev_mm ?? 0) > 1.5;
  return (
    <section className="calibration-results">
      <div
        className={
          "calibration-result-icon " +
          (!saved ? "pending" : warning ? "needs-review" : "complete")
        }
      >
        {!saved ? (
          <CircleDashed size={30} />
        ) : warning ? (
          <AlertTriangle size={30} />
        ) : (
          <CheckCircle2 size={30} />
        )}
      </div>
      <h2>
        {!saved
          ? "等待标定"
          : warning
            ? "标定已保存，需检查精度"
            : demo
              ? "模拟标定已完成"
              : "标定已保存"}
      </h2>
      <p className="calibration-result-caption">
        {demo
          ? "以下数值为演示示例"
          : saved
            ? "当前工件的后端标定结果"
            : "完成标定后显示转换精度"}
      </p>
      <div className="calibration-metrics">
        {[
          [
            "最大误差",
            !saved || calib.max_dev_mm === undefined
              ? "—"
              : calib.max_dev_mm.toFixed(2),
            "mm",
          ],
          [
            "平均误差",
            !saved || calib.mean_dev_mm === undefined
              ? "—"
              : calib.mean_dev_mm.toFixed(2),
            "mm",
          ],
          [
            "对应点",
            !saved || calib.pair_count === undefined
              ? "—"
              : String(calib.pair_count),
            "组",
          ],
        ].map(([label, value, unit]) => (
          <div className="calibration-metric" key={label}>
            <span>{label}</span>
            <strong>
              {value}
              <small>{value === "—" ? "" : unit}</small>
            </strong>
          </div>
        ))}
      </div>
      {saved && hasResidual && (
        <div className={warning ? "warning" : "calibration-success"}>
          {warning
            ? "最大误差超过 1.5mm，请检查对应点后重新标定。"
            : demo
              ? "示例精度在演示阈值内"
              : "最大误差未超过 1.5mm 阈值"}
        </div>
      )}
      {saved && !hasResidual && (
        <div className="info-box">后端未返回精度数据，暂不能判断标定误差。</div>
      )}
      {demo && (
        <p className="calibration-note">
          演示结果不代表现场标定精度，不可据此执行机器人程序。
        </p>
      )}
      {saved && calib.input_kind === "matrix" && (
        <p className="calibration-note">本次采用矩阵输入，不提供对应点组数。</p>
      )}
      <button className="secondary full" onClick={onNext}>
        下一步：轨迹预演
        <ArrowRight size={16} />
      </button>
    </section>
  );
}
