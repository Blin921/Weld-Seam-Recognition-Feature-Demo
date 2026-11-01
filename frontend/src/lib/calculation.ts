export type CalculationKind =
  | "upload"
  | "scan"
  | "recognize"
  | "calibration"
  | "program"
  | "transfer"
  | "inspect";
export type Calculation = {
  id: number;
  kind: CalculationKind;
  status: "running" | "done" | "error";
  startedAt: number;
  detail: string;
  demo: boolean;
  illustration?: boolean;
};
export const calculationStages: Record<
  CalculationKind,
  { title: string; stages: string[]; formula: string }
> = {
  upload: {
    title: "点云载入",
    stages: ["读取 PCD 文件", "校验点云数据", "构建三维视图"],
    formula: "PCD → XYZ / RGB → 三维场景",
  },
  scan: {
    title: "扫描采集",
    stages: ["准备扫描", "采集点云", "整理并载入帧"],
    formula: "扫描工件 → 点云帧 → 三维预览",
  },
  recognize: {
    title: "焊缝识别",
    stages: ["点云预处理", "工件语义分割", "提取焊缝轨迹", "汇总识别结果"],
    formula: "点云 → 工件实例 → 焊缝轨迹",
  },
  calibration: {
    title: "坐标标定",
    stages: ["读取对应点", "求解坐标变换", "核对标定结果"],
    formula: "p 基座 = R × p 相机 + t",
  },
  program: {
    title: "程序生成",
    stages: ["读取选中焊缝", "采样途经点", "配置姿态与参数", "生成程序文本"],
    formula: "焊缝轨迹 → TCP 途经点 → 程序文本",
  },
  transfer: {
    title: "程序文件传输",
    stages: ["检查目标程序", "建立传输连接", "传输并等待确认"],
    formula: "程序文件 → FTP → 控制器存储",
  },
  inspect: {
    title: "焊缝查看",
    stages: ["选择目标焊缝", "定位空间轨迹", "查看几何属性"],
    formula: "焊缝编号 → 轨迹高亮 → 长度与类型",
  },
};
// Only simulated operations have time-based stages. Real completion always comes from the API.
export function calculationPhase(operation: Calculation | null, now: number) {
  if (!operation) return 0;
  const count = calculationStages[operation.kind].stages.length;
  if (!operation.demo || operation.status === "error") return 0;
  if (operation.status === "done") return count;
  return Math.min(
    count - 1,
    Math.floor(Math.max(0, now - operation.startedAt) / 600),
  );
}
export async function holdDemoAnimation(
  demo: boolean,
  startedAt: number,
  minimum = 1900,
) {
  if (demo)
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.max(0, minimum - (Date.now() - startedAt))),
    );
}
