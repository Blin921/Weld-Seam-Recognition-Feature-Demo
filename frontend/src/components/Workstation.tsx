"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { requestApi } from "@/lib/transport";
import { useDemoMode } from "@/lib/useDemoMode";
import { setDemoMode, isDemoMode, isStaticDemo } from "@/lib/demo";
import { useTheme } from "@/lib/useTheme";
import DisplaySettings from "./DisplaySettings";
import { useCompactLayout } from "@/lib/useCompactLayout";
import { mergeCalibration, validatedMatrix } from "@/lib/calibration";
import { CalibrationControls, CalibrationResults } from "./CalibrationPanel";
import { samplePath } from "@/lib/core";
import SystemLogo from "./SystemLogo";
import CalculationProcess from "./CalculationProcess";
import { useCalculation } from "@/lib/useCalculation";
import {
  holdDemoAnimation,
  type Calculation,
  type CalculationKind,
} from "@/lib/calculation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Box,
  ChevronDown,
  CloudUpload,
  Crosshair,
  Download,
  FileCode2,
  Layers,
  Play,
  Radio,
  RotateCcw,
  ScanLine,
  ScanSearch,
  Send,
  Settings2,
  ShieldCheck,
  Terminal,
  Workflow,
  Home,
  Grid3X3,
  Sun,
  Moon,
} from "lucide-react";
import {
  api,
  ApiError,
  arcLengths,
  Calib,
  Cloud,
  Frame,
  Job,
  parseCloud,
  requireOk,
  pathAtTime,
  pathDuration,
  Program,
  Seam,
} from "@/lib/core";
const CloudView = dynamic(() => import("@/components/CloudView"), {
  ssr: false,
});
const initialProgram = {
  name: "",
  comment: "",
  utool: 1,
  uframe: 0,
  weld: false,
  inst: "Weld",
  weld_prog: 1,
  weld_set: 1,
  speed_weld: 30,
  eps: 0.5,
  max_seg: 50,
  wpr: "180,0,0",
};
const initialFtp = {
  host: "",
  port: 21,
  user: "anonymous",
  password: "",
  remote_dir: "MD:",
  passive: true,
  timeout_s: 15,
};
const initialRecognition = {
  voxel: 1.5,
  tile: 200,
  stride: 120,
  smooth_k: 16,
  smooth_r: 3,
  max_gap: 0.008,
  min_len: 50,
};
function Fields({
  value,
  onChange,
  labels = {},
}: {
  value: Record<string, string | number | boolean>;
  onChange: (v: Record<string, string | number | boolean>) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="fields">
      {Object.entries(value).map(([key, v]) => (
        <label key={key}>
          {labels[key] ?? key}
          {typeof v === "boolean" ? (
            <input
              type="checkbox"
              checked={v}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            />
          ) : (
            <input
              type={
                typeof v === "number"
                  ? "number"
                  : key === "password"
                    ? "password"
                    : "text"
              }
              step="any"
              autoComplete={key === "password" ? "new-password" : "off"}
              value={v}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]:
                    typeof v === "number"
                      ? Number(e.target.value)
                      : e.target.value,
                })
              }
            />
          )}
        </label>
      ))}
    </div>
  );
}
export default function Workstation() {
  const pathname = usePathname(),
    router = useRouter();
  const routes = [
    "/recognize",
    "/calibration",
    "/seams",
    "/program",
    "/transfer",
  ];
  const tab = Math.max(0, routes.indexOf(pathname));
  const acquisition = pathname === "/scan";
  const demo = useDemoMode();
  const [dark, setDark] = useTheme();
  const [grid, setGrid] = useState(true);
  const process = useCalculation(demo);
  const { update: updateCalculation, finish: finishCalculation } = process;
  const taskCalculation = useRef<Calculation | null>(null);
  const calculationKind: CalculationKind = acquisition
    ? "scan"
    : (["recognize", "calibration", "inspect", "program", "transfer"][
        tab
      ] as CalculationKind);

  const [focusView, setFocusView] = useState(false);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusView(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const compact = useCompactLayout();
  const [panelChoice, setPanelChoice] = useState({
    path: pathname,
    tab: "controls",
  });
  const showDetails =
    compact && panelChoice.path === pathname && panelChoice.tab === "details";
  const [connectionIssue, setConnectionIssue] = useState<string | null>(null);
  const setTab = (i: number) => router.push(routes[i]);
  const pageTitle = acquisition
    ? "数据采集与管理"
    : [
        "AI焊缝识别",
        "坐标标定",
        "焊缝管理",
        "程序生成与轨迹预演",
        "机器人程序下发",
      ][tab];
  const pageNumber = acquisition ? 1 : tab + 2;
  const PageIcon = acquisition
    ? ScanLine
    : [ScanSearch, Crosshair, Layers, Workflow, Send][tab];
  const pagePurpose = acquisition
    ? "管理点云帧 · 采集工件数据"
    : [
        "识别工件 · 定位焊缝 · 查看三维结果",
        "建立坐标转换 · 查看标定结果",
        "筛选焊缝 · 查看轨迹 · 选择目标",
        "生成程序 · 预演轨迹 · 查看运动进度",
        "确认程序 · 传输文件 · 查看下发结果",
      ][tab];
  const [frames, setFrames] = useState<Frame[]>([]),
    [fid, setFid] = useState(""),
    [cloud, setCloud] = useState<Cloud | null>(null),
    [seams, setSeams] = useState<Seam[]>([]),
    [selectedId, setSelectedId] = useState<number | null>(null),
    [health, setHealth] = useState<{
      model_ok: boolean;
      cpp_ok: boolean;
      model_error?: string;
    } | null>(null),
    [calib, setCalib] = useState<Calib>({
      calib_tag: "未标定",
      uncalibrated: true,
    });
  const [mode, setMode] = useState("semantic"),
    [size, setSize] = useState(2),
    [reset, setReset] = useState(0),
    [reuse, setReuse] = useState(false),
    [recognition, setRecognition] = useState(initialRecognition),
    [scan, setScan] = useState({
      scan_ms: 2500,
      exp_us: 300,
      near: 400,
      far: 800,
      loose: false,
    }),
    [programForm, setProgramForm] = useState(initialProgram),
    [ftp, setFtp] = useState(initialFtp),
    [program, setProgram] = useState<Program | null>(null),
    [programSeam, setProgramSeam] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]),
    [active, setActive] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [drawerState, setDrawerState] = useState({ path: pathname, open: false }),
    [toast, setToast] = useState(""),
    [events, setEvents] = useState<string[]>([]),
    [playing, setPlaying] = useState(false),
    [seconds, setSeconds] = useState(0),
    [speed, setSpeed] = useState(1),
    [pending, setPending] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [transferResult, setTransfer] = useState<{
      frame: string;
      seam: number | null;
      minLength: number;
      program: Program;
      bytes: number;
      remote_path: string;
      existed_before: boolean;
    } | null>(null);
  const visibleSeams = useMemo(
    () => seams.filter((s) => s.length_mm >= recognition.min_len),
    [seams, recognition.min_len],
  );
  const selected = visibleSeams.some((s) => s.id === selectedId)
    ? selectedId
    : (visibleSeams[0]?.id ?? null);
  const transfer =
    transferResult &&
    transferResult.frame === fid &&
    transferResult.seam === selected &&
    transferResult.minLength === recognition.min_len &&
    transferResult.program === program
      ? transferResult
      : null;
  function selectSeam(id: number | null) {
    if (id !== selected) {
      setTransfer(null);
      if (id !== null && !busy && !active) {
        const calculation = process.begin(
          "inspect",
          `定位焊缝 #${id} 并显示已返回的轨迹与属性`,
        );
        void holdDemoAnimation(demo, calculation.startedAt, 1800).then(() =>
          process.finish(
            calculation,
            "done",
            `焊缝 #${id} 已选中；长度与轨迹来自当前识别结果`,
          ),
        );
      }
    }
    setSelectedId(id);
    setPlaying(false);
    setSeconds(0);
  }
  const drawer = drawerState.path === pathname && drawerState.open;
  const setDrawer = (open: boolean) => setDrawerState({ path: pathname, open });
  const [pairs, setPairs] = useState<number[][]>(
      Array.from({ length: 3 }, () => [0, 0, 0, 0, 0, 0]),
    ),
    [advanced, setAdvanced] = useState(""),
    [calibMode, setCalibMode] = useState(false);
  const calibrationCache = useRef(new Map<string, Calib>());
  const cache = useRef(new Map<string, Cloud>()),
    generation = useRef(0),
    taskLock = useRef(false),
    currentFrame = useRef(fid);
  useEffect(() => {
    currentFrame.current = fid;
  }, [fid]);
  const notify = useCallback(
    (message: string) => {
      setToast(message);
      setEvents((old) => [
        ...old,
        `${new Date().toLocaleTimeString()}  ${message}`,
      ]);
    },
    [setToast, setEvents],
  );
  const fail = useCallback(
    (error: unknown) =>
      notify(
        error instanceof ApiError && error.status === 409
          ? "当前已有采集或识别任务，请稍候再试"
          : error instanceof Error
            ? error.message
            : "操作失败",
      ),
    [notify],
  );
  const refreshFrames = useCallback(async () => {
    const data = await api<{ frames: Frame[] }>("/frames");
    setFrames(data.frames);
    return data.frames;
  }, []);
  const loadFrame = useCallback(
    async (id: string, invalidate = false) => {
      const version = ++generation.current;
      setLoading(true);
      setCloud(null);
      setSeams([]);
      setSelectedId(null);
      setProgram(null);
      setTransfer(null);
      setProgramSeam(null);
      setPlaying(false);
      setSeconds(0);
      setCalib({ calib_tag: "未标定", uncalibrated: true });
      if (invalidate) cache.current.delete(id);
      const encoded = encodeURIComponent(id);
      const results = await Promise.allSettled([
        cache.current.has(id)
          ? Promise.resolve(cache.current.get(id)!)
          : requestApi("/view/" + encoded).then(async (r) => {
              await requireOk(r);
              const value = parseCloud(await r.arrayBuffer());
              cache.current.set(id, value);
              return value;
            }),
        api<{ seams: Seam[] }>("/seams/" + encoded),
        api<Calib>("/calib/" + encoded),
      ]);
      if (version !== generation.current) return;
      const [view, list, cal] = results;
      if (view.status === "fulfilled") setCloud(view.value);
      else if (!(view.reason instanceof ApiError && view.reason.status === 404))
        fail(view.reason);
      if (list.status === "fulfilled") {
        setSeams(list.value.seams);
        setSelectedId(list.value.seams[0]?.id ?? null);
      } else if (!(
        list.reason instanceof ApiError && list.reason.status === 404
      ))
        fail(list.reason);
      if (cal.status === "fulfilled") {
        const status = mergeCalibration(
          cal.value,
          calibrationCache.current.get(id),
        );
        calibrationCache.current.set(id, status);
        setCalib(status);
      } else fail(cal.reason);
      setLoading(false);
    },
    [fail],
  );
  useEffect(() => {
    void Promise.resolve().then(() => {
      api<typeof health>("/health")
        .then(setHealth)
        .catch(() =>
          notify("无法连接 FastAPI 后端，请检查 8000 端口与 BACKEND_ORIGIN"),
        );
      refreshFrames()
        .then((list) => {
          if (list.length) setFid(list[0].id);
        })
        .catch(fail);
      const saved = isDemoMode() ? null : localStorage.getItem("weld-ftp");
      if (saved)
        try {
          const data = JSON.parse(saved);
          queueMicrotask(() =>
            setFtp({ ...initialFtp, ...data, password: "" }),
          );
        } catch {
          /* ignore invalid local settings */
        }
    });
  }, [refreshFrames, fail, notify]);
  useEffect(() => {
    if (fid) void Promise.resolve().then(() => loadFrame(fid));
  }, [fid, loadFrame]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!active) return;
    let stopped = false,
      inFlight = false,
      finished = false,
      retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (!stopped && !finished) timer = setTimeout(() => void poll(), delay);
    };
    const poll = async () => {
      if (stopped || finished || inFlight) return;
      if (document.hidden) return;
      inFlight = true;
      request = new AbortController();
      const timeout = setTimeout(() => request?.abort(), 10000);
      try {
        const job = await api<Job>(
          "/jobs/" + encodeURIComponent(active),
          undefined,
          undefined,
          request.signal,
        );
        if (stopped) return;
        if (retries) notify("任务连接已恢复，继续跟踪原任务");
        retries = 0;
        setConnectionIssue(null);
        setJobs((old) =>
          [job, ...old.filter((j) => j.id !== job.id)].slice(0, 20),
        );
        updateCalculation(
          taskCalculation.current,
          job.log.at(-1) ?? "等待后台任务结果",
        );
        if (job.state === "done" || job.state === "error") {
          finishCalculation(
            taskCalculation.current,
            job.state === "error" ? "error" : "done",
            job.error ?? job.log.at(-1) ?? "任务完成",
          );
          finished = true;
          setActive(null);
          taskLock.current = false;
          if (job.state === "error")
            notify(
              (job.error ?? job.log.at(-1) ?? "任务失败") +
                (job.kind === "scan" ? "；本机可能未接相机，请检查连接" : ""),
            );
          else {
            notify(
              `任务完成 · 焊缝 ${job.result?.n_seams ?? "—"} 条 · ${job.result?.seconds ?? job.seconds ?? "—"} 秒`,
            );
            void refreshFrames()
              .then(async (list) => {
                if (currentFrame.current)
                  await loadFrame(currentFrame.current, true);
                else if (list.length) setFid(list[0].id);
              })
              .catch(fail);
          }
        }
      } catch (error) {
        if (stopped) return;
        retries++;
        const message =
          error instanceof ApiError && error.status === 404
            ? "后端暂时无法查询该任务，请确认后端未重启"
            : "任务连接中断，正在重试";
        setConnectionIssue(message + "；保留原任务，采集与识别继续锁定");
        if (retries === 1) notify(message + "，不会重复提交任务");
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (!stopped && !finished)
          schedule(Math.min(1500 * 2 ** Math.min(retries, 3), 12000));
      }
    };
    const resume = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      request?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [
    active,
    notify,
    fail,
    refreshFrames,
    loadFrame,
    updateCalculation,
    finishCalculation,
  ]);
  useEffect(() => {
    if (!playing || !program) return;
    let last = performance.now(),
      raf = 0;
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setSeconds((t) => {
        const next = Math.min(
          t + delta * speed,
          pathDuration(program.waypoints_cam_mm),
        );
        if (next >= pathDuration(program.waypoints_cam_mm)) setPlaying(false);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, program, speed]);
  async function task(kind: "scan" | "recognize") {
    if (taskLock.current) return;
    taskLock.current = true;
    taskCalculation.current = process.begin(
      kind,
      demo
        ? "正在展示配套模拟处理流程"
        : "任务请求已提交，等待后台报告处理结果",
    );
    setConnectionIssue(null);
    setBusy(true);
    try {
      const payload =
        kind === "scan"
          ? {
              scan_ms: scan.scan_ms,
              exp_us: scan.exp_us,
              dist: [scan.near, scan.far],
              loose: scan.loose,
            }
          : { frame: fid, reuse_artifacts: reuse, ...recognition };
      const { job_id } = await api<{ job_id: string }>("/" + kind, payload);
      setJobs((old) =>
        [
          {
            id: job_id,
            kind,
            state: "running",
            log: ["任务已受理，等待后端返回日志…"],
          },
          ...old,
        ].slice(0, 20),
      );
      setActive(job_id);
    } catch (e) {
      taskLock.current = false;
      process.finish(
        taskCalculation.current,
        "error",
        e instanceof Error ? e.message : "任务提交失败",
      );
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pcd"))
      return notify("请选择 .pcd 点云文件");
    if (demo && file.size > 8 * 1024 * 1024)
      return notify("离线演示文件上限为 8MB；真实大点云需接入后端上传");
    if (file.size > 300 * 1024 * 1024) return notify("文件超过 300MB 上限");
    const calculation = process.begin(
      "upload",
      demo ? "在浏览器内校验配套 PCD 文件" : "正在上传点云，等待后台确认",
    );
    setBusy(true);
    try {
      const id = (demo ? "UPLOAD_" : "") + file.name.replace(/\.pcd$/i, "");
      await api("/frames/" + encodeURIComponent(id), file, "PUT");
      await holdDemoAnimation(demo, calculation.startedAt);
      await refreshFrames();
      if (fid === id) await loadFrame(id, true);
      else setFid(id);
      process.finish(calculation, "done", `点云 ${id} 已载入三维视图`);
      notify(
        demo
          ? "演示点云已导入本地，未上传服务器；识别使用配套示例结果"
          : "点云上传成功",
      );
    } catch (e) {
      process.finish(
        calculation,
        "error",
        e instanceof Error ? e.message : "载入失败",
      );
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function saveCalib(clear = false, samplePairs?: number[][]) {
    const calculation = clear
      ? null
      : process.begin(
          "calibration",
          demo ? "演示对应点与坐标转换关系" : "已提交标定数据，等待后端求解",
        );
    setBusy(true);
    try {
      const payload = clear
        ? { frame: fid, clear: true }
        : calibMode && !samplePairs
          ? {
              frame: fid,
              ...(() => {
                const parsed = JSON.parse(advanced);
                return Array.isArray(parsed) ? { matrix: parsed } : parsed;
              })(),
            }
          : {
              frame: fid,
              pairs: (samplePairs ?? pairs).map((row) => ({
                cam: row.slice(0, 3),
                base: row.slice(3, 6),
              })),
            };
      const result = await api<Calib>("/calib", payload);
      if (calculation) await holdDemoAnimation(demo, calculation.startedAt);
      const status: Calib = {
        ...result,
        matrix: clear
          ? undefined
          : validatedMatrix(
              result.matrix ??
                ("matrix" in payload ? payload.matrix : undefined),
            ),
        uncalibrated: clear,
        has_calib: !clear,
        pair_count:
          clear || (!samplePairs && calibMode)
            ? undefined
            : (samplePairs ?? pairs).length,
        input_kind: clear
          ? undefined
          : samplePairs || !calibMode
            ? "pairs"
            : "matrix",
      };
      calibrationCache.current.set(fid, status);
      setCalib(status);
      process.finish(
        calculation,
        "done",
        `标定结果已返回；最大残差 ${result.max_dev_mm ?? "未知"} mm`,
      );
      setProgram(null);
      setTransfer(null);
      setPlaying(false);
      setSeconds(0);
      notify(
        clear
          ? "标定已清除"
          : `标定已保存 · 最大残差 ${result.max_dev_mm ?? "—"} mm`,
      );
    } catch (e) {
      process.finish(
        calculation,
        "error",
        e instanceof Error ? e.message : "标定失败",
      );
      fail(e);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }
  async function generate(confirmed = false) {
    if (selected === null) return notify("请先选择焊缝");
    if (programForm.name && !/^[A-Z][A-Z0-9_]{0,7}$/.test(programForm.name))
      return notify(
        "程序名须为大写字母开头，最多 8 位，仅含大写字母、数字及下划线",
      );
    if (
      programForm.wpr.split(",").length !== 3 ||
      programForm.wpr
        .split(",")
        .some((v) => !v.trim() || !Number.isFinite(Number(v)))
    )
      return notify("WPR 须为逗号分隔的三个数字");
    if (calib.uncalibrated && !confirmed) return setPending("uncalibrated");
    const calculation = process.begin(
      "program",
      demo ? "根据示例焊缝生成不可执行的演示文本" : "等待后台生成程序与途经点",
    );
    setBusy(true);
    try {
      const result = await api<Program>("/program", {
        frame: fid,
        seam_id: selected,
        ...programForm,
      });
      await holdDemoAnimation(demo, calculation.startedAt, 2200);
      setProgram(result);
      process.finish(
        calculation,
        "done",
        `已返回 ${result.waypoints_cam_mm.length} 个途经点与程序文本`,
      );
      setTransfer(null);
      setProgramSeam(selected);
      setSeconds(0);
      notify(
        demo
          ? "演示程序已生成，仅供预演与文本下载，不可上机"
          : "程序已生成，仅供预演、下载与文件下发",
      );
    } catch (e) {
      process.finish(
        calculation,
        "error",
        e instanceof Error ? e.message : "程序生成失败",
      );
      if (
        e instanceof ApiError &&
        e.status === 400 &&
        /5000|坐标|超限/.test(e.message)
      )
        notify("坐标超出允许范围，请先完成标定");
      else fail(e);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }
  async function downloadProgram(currentProgram: Program) {
    try {
      const name = currentProgram.ls_name.replace(/\.ls$/i, "");
      const blob = demo
        ? new Blob([currentProgram.ls_text], {
            type: "text/plain;charset=utf-8",
          })
        : await (
            await requireOk(
              await requestApi(
                "/program/" + encodeURIComponent(name) + "/download",
              ),
            )
          ).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = demo ? "DEMO_ONLY.demo.txt" : name + ".ls";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      fail(error);
    }
  }
  async function push() {
    if (!program || programSeam !== selected)
      return notify("请先为当前焊缝生成程序");
    const calculation = process.begin(
      "transfer",
      demo ? "模拟传输流程，不连接设备" : "正在请求 FTP 文件传输，等待后台确认",
    );
    setBusy(true);
    try {
      const result = await api<{
        bytes: number;
        remote_path: string;
        existed_before: boolean;
      }>("/push", { frame: fid, seam_id: selected, ...ftp });
      await holdDemoAnimation(demo, calculation.startedAt, 2100);
      process.finish(
        calculation,
        "done",
        demo
          ? "模拟结束，实际传输 0 字节"
          : `后台确认已传输 ${result.bytes} 字节`,
      );
      setTransfer({
        ...result,
        frame: fid,
        seam: selected,
        minLength: recognition.min_len,
        program,
      });
      const { password: _, ...safe } = ftp;
      void _;
      if (!demo) localStorage.setItem("weld-ftp", JSON.stringify(safe));
      notify(
        `${demo ? "模拟完成，未发送文件" : "已下发"} ${result.bytes} 字节 → ${result.remote_path}${result.existed_before ? "；已覆盖控制器同名程序" : ""}`,
      );
    } catch (e) {
      process.finish(
        calculation,
        "error",
        e instanceof Error ? e.message : "传输失败",
      );
      fail(e);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }
  const selectedSeam = seams.find((s) => s.id === selected),
    hasProgram = program && programSeam === selected;
  const points = hasProgram ? program.waypoints_cam_mm : [],
    total = arcLengths(points).at(-1) ?? 0,
    distance = pathAtTime(points, seconds),
    duration = pathDuration(points);
  const busyStep = busy ? (acquisition ? 0 : tab) : -1;
  const stepStates = [
    active || busyStep === 0 ? "running" : cloud ? "ready" : "idle",
    busyStep === 1 ? "running" : calib.uncalibrated ? "idle" : "ready",
    loading ? "running" : seams.length ? "ready" : "idle",
    busyStep === 3 ? "running" : hasProgram ? "ready" : "idle",
    busyStep === 4 ? "running" : transfer ? "ready" : "idle",
  ];
  const stateLabels = { idle: "未就绪", running: "进行中", ready: "就绪" };
  const stepNames = [
    "AI焊缝识别",
    "坐标标定",
    "焊缝管理",
    "程序与预演",
    "程序下发",
  ];
  const seamList = (
    <div
      className="seam-list"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault();
        const index = visibleSeams.findIndex((s) => s.id === selected);
        selectSeam(
          visibleSeams[
            Math.max(
              0,
              Math.min(
                visibleSeams.length - 1,
                index + (e.key === "ArrowDown" ? 1 : -1),
              ),
            )
          ]?.id ?? null,
        );
        setPlaying(false);
      }}
    >
      {visibleSeams.length ? (
        visibleSeams.map((s) => (
          <div
            className={"seam-card " + (s.id === selected ? "selected" : "")}
            key={s.id}
          >
            <button
              className="seam-title"
              onClick={() => {
                selectSeam(s.id);
                setPlaying(false);
              }}
            >
              <span>
                <i />
                焊缝 #{String(s.id).padStart(2, "0")}
              </span>
              <strong>
                {s.length_mm.toFixed(1)} <small>mm</small>
              </strong>
            </button>
            <p>
              {s.shape} <span>·</span> {s.type}
            </p>
            <div className="seam-actions">
              {["查看", "预演", "生成 .LS", "下发"].map((action, i) => (
                <button
                  key={action}
                  onClick={() => {
                    selectSeam(s.id);
                    setPlaying(false);
                    if (i === 1) {
                      setTab(3);
                      if (programSeam !== s.id)
                        notify("请先生成当前焊缝程序，以获取真实预演途经点");
                    }
                    if (i === 2) setTab(3);
                    if (i === 3) setTab(4);
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="empty-small">
          {seams.length
            ? "没有满足最短长度的焊缝，请调整过滤值"
            : "暂无焊缝，请先选择有结果的帧或执行识别。"}
          <button
            className="secondary full"
            disabled={busy || !!active}
            onClick={() =>
              seams.length
                ? setRecognition({ ...recognition, min_len: 0 })
                : fid
                  ? void task("recognize")
                  : router.push("/scan")
            }
          >
            {seams.length ? "显示全部焊缝" : fid ? "识别当前帧" : "上传点云"}
          </button>
        </div>
      )}
    </div>
  );
  const programPreview = (
    <section className="program-preview">
      <h3>
        <FileCode2 size={16} />
        程序预览<span>{demo ? "示例文本（不可执行）" : "后台程序文本"}</span>
      </h3>
      {hasProgram ? (
        <>
          <div className="section-divider" />
          {!!program.issues?.length && (
            <details className="program-issues">
              <summary>规避提示，不阻断（{program.issues.length}）</summary>{" "}
              {program.issues?.map((issue, i) => (
                <div key={i} className="warning">
                  提示（不阻断）：
                  {typeof issue === "string" ? issue : JSON.stringify(issue)}
                </div>
              ))}
            </details>
          )}
          <div className="code-header">
            <strong>{program.ls_name}</strong>
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(program.ls_text)
                  .then(() => notify("程序已复制"))
                  .catch(fail)
              }
            >
              复制
            </button>
            <a
              href={
                "/api/program/" +
                encodeURIComponent(program.ls_name.replace(/\.ls$/i, "")) +
                "/download"
              }
              download={demo ? "DEMO_ONLY.demo.txt" : undefined}
              onClick={(e) => {
                e.preventDefault();
                void downloadProgram(program);
              }}
            >
              <Download size={15} />
              下载
            </a>
          </div>
          <pre className="program-code">{program.ls_text}</pre>
          {calib.uncalibrated && (
            <div className="warning danger-box">
              禁止上机：当前程序使用相机系坐标。
            </div>
          )}
        </>
      ) : (
        <div className="empty-small">请先生成当前焊缝的程序。</div>
      )}
    </section>
  );
  const contextContent = (
    <div className="context-content">
      {acquisition ? (
        <>
          <h3>当前帧信息</h3>
          <h2 className="teal-heading">{fid || "尚未选择帧"}</h2>
          <p>点数 {cloud?.header.n.toLocaleString() ?? "—"}</p>
          <p>来源 {frames.find((f) => f.id === fid)?.source ?? "—"}</p>
          <p>
            识别状态{" "}
            {frames.find((f) => f.id === fid)?.has_artifacts
              ? "有历史结果"
              : "待识别"}
          </p>
          <p>
            大小{" "}
            {(
              (frames.find((f) => f.id === fid)?.bytes ?? 0) /
              1024 /
              1024
            ).toFixed(1)}{" "}
            MB
          </p>
        </>
      ) : tab === 1 ? (
        <CalibrationResults
          calib={calib}
          demo={demo}
          onNext={() => setTab(3)}
        />
      ) : tab === 3 ? (
        <>
          {programPreview}
          <h3>TCP 坐标位置</h3>
          {hasProgram ? (
            <>
              <h2 className="teal-heading">
                X {samplePath(points, distance).point[0].toFixed(2)} mm
              </h2>
              <p>Y {samplePath(points, distance).point[1].toFixed(2)} mm</p>
              <p>Z {samplePath(points, distance).point[2].toFixed(2)} mm</p>
              <p>
                W / P / R{" "}
                {(
                  program.wpr_list[samplePath(points, distance).segment] ?? [
                    180, 0, 0,
                  ]
                ).join(" / ")}{" "}
                °
              </p>
              <p>
                路径 {distance.toFixed(1)} / {total.toFixed(1)} mm
              </p>
              <p>坐标系：相机系</p>
            </>
          ) : (
            <div className="empty-small">
              生成当前焊缝的程序后显示真实 TCP 途经点及姿态。
            </div>
          )}
          {calib.uncalibrated && (
            <div className="warning danger-box">坐标仍是相机系，禁止上机。</div>
          )}
        </>
      ) : tab === 4 ? (
        <>
          <h3>当前帧与选中焊缝</h3>
          <dl>
            <dt>当前帧</dt>
            <dd>{fid || "—"}</dd>
            <dt>选中焊缝</dt>
            <dd>
              {selectedSeam
                ? `#${selectedSeam.id} · ${selectedSeam.shape}`
                : "—"}
            </dd>
            <dt>路径点数</dt>
            <dd>{hasProgram ? points.length : "—"}</dd>
          </dl>
          <h3>任务状态</h3>
          <ul className="context-task-states">
            {[
              ["点云载入", !!cloud],
              ["识别结果", seams.length > 0],
              ["坐标标定", !calib.uncalibrated],
              ["程序生成", !!hasProgram],
              ["文件传输", !!transfer],
            ].map(([label, ready]) => (
              <li key={String(label)} className={ready ? "ready" : ""}>
                <span>{ready ? "✓" : "○"}</span>
                {label}
                <small>{ready ? "已就绪" : "未完成"}</small>
              </li>
            ))}
          </ul>
          <h3>传输结果</h3>
          {transfer ? (
            <>
              <h2 className="teal-heading">
                {demo ? "✓ 模拟完成，未发送文件" : "✓ 文件传输成功"}
              </h2>
              <p>远端路径 {transfer.remote_path}</p>
              <p>字节数 {transfer.bytes}</p>
              {transfer.existed_before && (
                <p className="warning">已覆盖控制器同名程序</p>
              )}
            </>
          ) : (
            <div className="empty-small">
              尚未传输文件，请先生成程序并确认控制器连接参数。
            </div>
          )}
          <p>机器人启动：未执行</p>
        </>
      ) : (
        <>
          {" "}
          <div className="context-summary">
            <div>
              <strong>{seams.length.toString().padStart(2, "0")}</strong>
              <small>识别焊缝</small>
            </div>
            <div>
              <strong>
                {seams.reduce((a, s) => a + s.length_mm, 0).toFixed(0)}
                <em> mm</em>
              </strong>
              <small>焊缝总长</small>
            </div>
          </div>
          <h3>
            识别结果 <span>↑ ↓ 切换</span>
          </h3>
          {tab !== 2 && seamList}
          <div className="section-divider" />
          <h3>
            <Crosshair size={16} />
            所选焊缝详情
          </h3>
          {selectedSeam ? (
            <dl>
              <dt>焊缝编号</dt>
              <dd>#{selectedSeam.id}</dd>
              <dt>工件形状</dt>
              <dd>{selectedSeam.shape}</dd>
              <dt>连接类型</dt>
              <dd>{selectedSeam.type}</dd>
              <dt>长度</dt>
              <dd>{selectedSeam.length_mm.toFixed(2)} mm</dd>
              <dt>坐标系</dt>
              <dd>相机坐标系</dd>
              <dt>起点坐标（X,Y,Z）</dt>
              <dd>
                {selectedSeam.trajectory_mm[0]
                  ?.map((v) => v.toFixed(2))
                  .join(", ") ?? "—"}
              </dd>
              <dt>终点坐标（X,Y,Z）</dt>
              <dd>
                {selectedSeam.trajectory_mm
                  .at(-1)
                  ?.map((v) => v.toFixed(2))
                  .join(", ") ?? "—"}
              </dd>
            </dl>
          ) : (
            <div className="empty-small">
              选择焊缝后查看几何详情，并进行程序生成与预演。
            </div>
          )}
          <div className="tip">
            <ShieldCheck size={19} />
            <p>
              让轨迹先被看见
              <small>
                生成程序后，在三维视图中预演 TCP 轨迹，确认标定与途经点。
              </small>
            </p>
          </div>
        </>
      )}
    </div>
  );
  const processPanel = (
    <CalculationProcess
      operation={process.operation}
      kind={calculationKind}
      paused={process.paused}
      onPause={process.togglePaused}
      onReplay={() => void process.replay(calculationKind)}
      disabled={busy || !!active || process.operation?.status === "running"}
    />
  );
  const recentLog = (
    <section className="recent-log" aria-label="最近任务日志">
      <h3>
        <Terminal size={15} />
        任务日志<span>最近记录</span>
      </h3>
      <ul>
        {(events.length
          ? events.slice(-3).reverse()
          : ["系统就绪，等待操作"]
        ).map((event, i) => (
          <li key={`${i}-${event}`}>
            <i />
            {event}
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <main
      className={
        (dark ? "workstation dark" : "workstation") +
        (focusView ? " presentation" : "")
      }
      data-page={acquisition ? "scan" : routes[tab].slice(1)}
    >
      <div className="workspace-topbar">
        <Link href="/" className="site-logo workspace-brand" title="返回首页">
          <SystemLogo /> <span>焊缝识别系统</span>
        </Link>
        <nav className="steps" aria-label="工作流导航">
          <Link href="/" className="nav-home" aria-label="返回首页">
            <Home size={15} />
            首页
          </Link>
          <Link
            className={acquisition ? "active" : ""}
            href="/scan"
            aria-label="数据采集与管理"
            aria-current={acquisition ? "page" : undefined}
          >
            <span className="workflow-number" aria-hidden="true">
              01
            </span>
            数据采集
          </Link>
          {stepNames.map((name, i) => (
            <button
              key={name}
              className={!acquisition && tab === i ? "active" : ""}
              onClick={() => setTab(i)}
              aria-label={name}
              aria-current={!acquisition && tab === i ? "page" : undefined}
              aria-describedby={"workflow-step-state-" + i}
            >
              <span className="workflow-number" aria-hidden="true">
                {String(i + 2).padStart(2, "0")}
              </span>
              {name}
              <span id={"workflow-step-state-" + i} className="sr-only">
                {stateLabels[stepStates[i] as keyof typeof stateLabels]}
                {i >= 3 && calib.uncalibrated ? "；未标定，禁止上机" : ""}
              </span>
            </button>
          ))}
        </nav>
        <div className="workspace-actions">
          {" "}
          <div className="health">
            <span
              title={health?.model_error ?? "模型健康状态"}
              className={health?.model_ok ? "ok" : "warn"}
            >
              <i />
              {demo
                ? "模拟模型"
                : `模型${health?.model_ok ? "就绪" : "未就绪"}`}
            </span>
            <span
              title="缺失时请编译后端 C++ 解算器"
              className={health?.cpp_ok ? "ok" : "warn"}
            >
              <i />
              {demo ? "模拟解算" : "C++ 解算器"}
            </span>
            <span
              title={
                calib.uncalibrated
                  ? "未标定：坐标仍是相机系，禁止上机"
                  : calib.max_dev_mm === undefined
                    ? "已标定；后端未提供本次残差"
                    : `最大残差 ${calib.max_dev_mm} mm${calib.max_dev_mm > 1.5 ? "，超过 1.5mm，请检查标定点对" : ""}`
              }
              className={
                calib.uncalibrated
                  ? "danger"
                  : (calib.max_dev_mm ?? 0) > 1.5
                    ? "warn"
                    : "ok"
              }
            >
              <i />
              {demo
                ? calib.uncalibrated
                  ? "演示未标定"
                  : "模拟标定"
                : calib.uncalibrated
                  ? "未标定"
                  : "已标定"}
            </span>
          </div>
          <button
            className="icon-button theme-toggle"
            aria-label="切换深浅主题"
            aria-pressed={dark}
            title={dark ? "切换为浅色模式" : "切换为深色模式"}
            onClick={() => setDark(!dark)}
          >
            {dark ? (
              <Sun size={19} aria-hidden="true" />
            ) : (
              <Moon size={19} aria-hidden="true" />
            )}
          </button>
          <DisplaySettings dark={dark} onTheme={setDark} demo={demo} />
          {demo && (
            <div className="demo-banner">
              <strong>离线演示</strong>
              <span className="demo-badge-detail"> · 合成示例数据</span>
            </div>
          )}
          {demo && !isStaticDemo && (
            <button
              className="exit-demo"
              aria-label="退出演示，连接后端"
              disabled={!!active || busy}
              onClick={() => {
                setDemoMode(false);
                router.push("/recognize");
              }}
            >
              <span aria-hidden="true">连接后端</span>
            </button>
          )}
        </div>
      </div>

      {connectionIssue && (
        <div role="status" className="connection-warning">
          {connectionIssue}。恢复网络后自动继续，也可切回浏览器标签页立即重试。
        </div>
      )}
      <div className="panels">
        <aside className="control-panel">
          <div className="panel-title">
            <Workflow size={17} />
            {acquisition
              ? "点云帧管理"
              : ["识别任务", "标定控制", "焊缝管理", "程序参数", "控制器连接"][
                  tab
                ]}
            <span>STEP {String(pageNumber).padStart(2, "0")}</span>
          </div>
          {compact && (
            <div
              className="compact-tabs"
              role="tablist"
              aria-label="工作区面板"
            >
              <button
                id="controls-tab"
                role="tab"
                aria-selected={!showDetails}
                aria-controls="workflow-controls"
                onClick={() =>
                  setPanelChoice({ path: pathname, tab: "controls" })
                }
              >
                操作设置
              </button>
              <button
                id="context-tab"
                role="tab"
                aria-selected={showDetails}
                aria-controls="workflow-context"
                onClick={() =>
                  setPanelChoice({ path: pathname, tab: "details" })
                }
              >
                详情与结果
              </button>
            </div>
          )}
          <div
            id="workflow-controls"
            role={compact ? "tabpanel" : undefined}
            aria-labelledby={compact ? "controls-tab" : undefined}
            hidden={showDetails}
            className={
              "control-content " +
              (acquisition ? "acquisition-controls" : "recognition-controls")
            }
          >
            {tab === 0 && (
              <>
                <h3 className="frames-heading">
                  点云帧 <span>{frames.length} FRAMES</span>
                </h3>
                <label className="upload">
                  <CloudUpload size={24} />
                  <strong>{demo ? "上传演示点云" : "上传点云文件"}</strong>
                  <small>
                    {demo
                      ? "配套 DEMO_PIPE_A / B.pcd · 仅在本地导入 · 最大 8 MB"
                      : "PCD 格式 · 最大 300 MB"}
                  </small>
                  <input
                    type="file"
                    accept=".pcd"
                    disabled={busy || !!active}
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                </label>
                <div className="frame-list">
                  {frames.length ? (
                    frames.map((f) => (
                      <button
                        key={f.id}
                        className={fid === f.id ? "chosen" : ""}
                        onClick={() => setFid(f.id)}
                        disabled={!!active || busy}
                      >
                        <Box size={18} />
                        <div>
                          <strong>{f.id}</strong>
                          <small>
                            <span className={"source-badge source-" + f.source}>
                              {f.source}
                            </span>{" "}
                            · {(f.bytes / 1024 / 1024).toFixed(1)} MB
                          </small>
                        </div>
                        {f.has_artifacts && (
                          <span className="artifact">有结果</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="empty-small">
                      没有可用帧，上传 .pcd 文件开始；离线演示需后端提供 sw2_e30
                      历史产物。
                    </div>
                  )}
                </div>
                {!acquisition && (
                  <div className="recognition-settings">
                    <div className="section-divider" />
                    <h3>
                      <ScanLine size={16} />
                      识别设置
                    </h3>
                    <label className="toggle-row">
                      <div>
                        {demo ? "复用示例轨迹" : "复用历史结果"}
                        <small>离线演示 · 无需加载模型</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={reuse}
                        onChange={(e) => setReuse(e.target.checked)}
                      />
                    </label>
                    <details>
                      <summary>
                        <Settings2 size={15} />
                        高级参数
                        <ChevronDown size={14} />
                      </summary>
                      <Fields
                        value={recognition}
                        labels={{
                          voxel: "voxel 大小（mm）",
                          tile: "tile 大小（mm）",
                          stride: "stride 步长（mm）",
                          smooth_k: "smooth_k 邻域",
                          smooth_r: "smooth_r 半径（mm）",
                          max_gap: "max_gap 最大间隙（m）",
                          min_len: "min_len 最小长度（mm）",
                        }}
                        onChange={(v) =>
                          setRecognition(v as typeof recognition)
                        }
                      />
                    </details>
                    <button
                      className="primary full"
                      disabled={!fid || busy || !!active}
                      onClick={() => void task("recognize")}
                    >
                      <ScanLine size={17} />
                      {active ? "任务进行中…" : "开始识别"}
                    </button>
                  </div>
                )}
                {acquisition && (
                  <details className="camera" open>
                    <summary>
                      <Radio size={16} />
                      相机采集
                      <ChevronDown size={14} />
                    </summary>
                    <Fields
                      value={scan}
                      onChange={(v) => setScan(v as typeof scan)}
                      labels={{
                        scan_ms: "扫描时长 ms",
                        exp_us: "曝光 μs",
                        near: "最近距离 mm",
                        far: "最远距离 mm",
                        loose: "散点输出",
                      }}
                    />
                    <button
                      className="secondary full"
                      disabled={
                        busy ||
                        !!active ||
                        scan.scan_ms < 500 ||
                        scan.scan_ms > 20000 ||
                        scan.exp_us < 10 ||
                        scan.exp_us > 5000 ||
                        scan.near >= scan.far
                      }
                      onClick={() => void task("scan")}
                    >
                      {demo ? "模拟采集点云" : "采集点云"}
                    </button>
                  </details>
                )}
              </>
            )}
            {tab === 1 && (
              <CalibrationControls
                demo={demo}
                fid={fid}
                frames={frames}
                calib={calib}
                busy={busy}
                locked={!!active}
                pairs={pairs}
                setPairs={setPairs}
                matrixMode={calibMode}
                setMatrixMode={setCalibMode}
                matrix={advanced}
                setMatrix={setAdvanced}
                onFrame={setFid}
                onSave={(sample) => void saveCalib(false, sample)}
                onClear={() => setPending("clear")}
              />
            )}
            {tab === 2 && (
              <>
                <h3>焊缝筛选</h3>
                <label>
                  最短长度 (mm)
                  <input
                    type="number"
                    value={recognition.min_len}
                    onChange={(e) =>
                      setRecognition({
                        ...recognition,
                        min_len: Number(e.target.value),
                      })
                    }
                  />
                </label>
                {seamList}
              </>
            )}
            {tab === 3 && (
              <>
                <h3>FANUC 程序参数</h3>
                <p className="help">
                  当前焊缝 #{selected ?? "—"} · 默认生成空跑版
                </p>
                {calib.uncalibrated && (
                  <div className="warning danger-box">
                    未标定：坐标仍是相机系，禁止上机。
                  </div>
                )}
                <Fields
                  value={programForm}
                  onChange={(v) => setProgramForm(v as typeof programForm)}
                  labels={{
                    name: "程序名（可留空）",
                    utool: "工具坐标（UTOOL）",
                    uframe: "工件坐标（UFRAME）",
                    inst: "指令类型",
                    weld_prog: "焊接程序号",
                    weld_set: "焊接集合",
                    speed_weld: "焊接速度（cm/min）",
                    eps: "轨迹精度（mm）",
                    max_seg: "最大分段长度（mm）",
                    comment: "备注（≤60字符）",
                    weld: "包含焊接指令",
                    wpr: "姿态 W,P,R（度）",
                  }}
                />
                <button
                  className="primary full"
                  disabled={
                    selected === null || busy || programForm.comment.length > 60
                  }
                  onClick={() => void generate()}
                >
                  <FileCode2 size={16} />
                  {demo ? "生成演示程序" : "生成 .LS 程序"}
                </button>
              </>
            )}
            {tab === 4 && (
              <>
                <h3>控制器 FTP 连接</h3>
                <p className="help">
                  只传输 .LS 文件。程序选择和启动须由操作者在示教器上人工确认。
                </p>
                <Fields
                  value={ftp}
                  onChange={(v) => setFtp(v as typeof ftp)}
                  labels={{
                    host: "控制器地址",
                    port: "FTP 端口",
                    user: "用户名",
                    password: "密码（不保存）",
                    remote_dir: "目标目录",
                    passive: "被动模式",
                    timeout_s: "超时（秒）",
                  }}
                />
                <div className="info-box">
                  待发送程序：{hasProgram ? program.ls_name : "尚未生成"}
                  <br />
                  帧：{fid || "—"} / 焊缝：{selected ?? "—"}
                </div>
                <button
                  className="primary full"
                  disabled={busy || (!demo && !ftp.host)}
                  onClick={() =>
                    hasProgram
                      ? setPending("push")
                      : notify("请先为当前焊缝生成程序")
                  }
                >
                  <Send size={16} />
                  {demo ? "模拟下发（不连接设备）" : "确认下发文件"}
                </button>
                <div className="warning">
                  同名程序将被覆盖。T1 倍率不高于 10%、单段模式、手不离急停。
                </div>
              </>
            )}
          </div>
          {compact && (
            <div
              id="workflow-context"
              role="tabpanel"
              aria-labelledby="context-tab"
              hidden={!showDetails}
              className="compact-context"
            >
              {contextContent}
              {processPanel}
              {recentLog}
            </div>
          )}
          <div className="panel-bottom">
            <ShieldCheck size={14} /> 所有点云与轨迹均以毫米为单位
          </div>
        </aside>
        <section
          className={"viewport " + (tab === 4 ? "transfer-viewport" : "")}
        >
          <div className="viewport-heading">
            {" "}
            <div className="workspace-function">
              <div className="function-icon" aria-hidden="true">
                <PageIcon size={28} strokeWidth={1.8} />
              </div>
              <div className="function-heading">
                <div className="function-title-line">
                  <h1>{pageTitle}</h1>
                  <span
                    className="function-number"
                    aria-label={`第 ${pageNumber} 个功能`}
                  >
                    {String(pageNumber).padStart(2, "0")}
                  </span>
                </div>
                <p className="function-purpose">{pagePurpose}</p>
              </div>
            </div>
          </div>
          <div className="view-toolbar">
            <div>
              <Layers size={17} />
              <strong>
                {acquisition
                  ? "点云预览"
                  : [
                      "三维识别结果",
                      "坐标系与点对关系",
                      "3D 焊缝视图",
                      "轨迹预演 / 程序代码",
                      "程序传输",
                    ][tab]}
              </strong>
              <span className="live-dot" />
              实时视图
            </div>
            <div className="view-switch">
              <button
                className="focus-toggle"
                aria-pressed={focusView}
                title="展开演示区，按 Esc 可恢复"
                onClick={() => setFocusView(!focusView)}
              >
                {focusView ? "恢复面板" : "展开演示区"}
              </button>
              {[
                ["raw", "点云"],
                ["semantic", "语义"],
                ["instance", "实例"],
              ].map(([v, label]) => (
                <button
                  className={mode === v ? "active" : ""}
                  key={v}
                  onClick={() => setMode(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <CloudView
            cloud={cloud}
            seams={visibleSeams}
            selected={selected}
            mode={mode}
            size={size}
            reset={reset}
            points={points}
            wpr={hasProgram ? program.wpr_list : []}
            distance={distance}
            light={!dark}
            calculation={process.operation}
            motionPaused={process.paused}
            grid={grid}
            calibrationPairs={
              tab === 1 && pairs.some((row) => row.some((value) => value !== 0))
                ? pairs
                : undefined
            }
          />
          {process.operation?.status === "running" && (
            <div
              className="scene-processing"
              data-paused={process.paused}
              role="note"
              aria-label="计算动画状态"
            >
              <Activity size={16} />
              <div>
                <strong>
                  {process.operation.demo ? "模拟计算展示" : "后台处理中"}
                </strong>
                <span>{process.operation.detail}</span>
              </div>
              <i />
            </div>
          )}
          {!cloud && (
            <div className="viewport-empty">
              <div className="empty-orbit">
                <Box size={48} strokeWidth={1} />
              </div>
              <h2>{loading ? "正在加载点云…" : "准备探索三维焊缝"}</h2>
              <p>
                {fid
                  ? "该帧尚无可用视图，请先完成识别"
                  : "选择或上传点云帧，开始识别与轨迹规划"}
              </p>
              {!loading && (
                <button
                  className="primary empty-action"
                  disabled={busy || !!active}
                  onClick={() =>
                    fid ? void task("recognize") : router.push("/scan")
                  }
                >
                  {fid ? "识别当前帧" : "前往上传点云"}
                </button>
              )}
              <span>POINT CLOUD · CAMERA COORDINATES · mm</span>
            </div>
          )}
          <div className="view-controls">
            <label>
              点大小
              <input
                type="range"
                min={1}
                max={6}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
              <span>{size}</span>
            </label>
            <button
              className="grid-toggle"
              aria-label="网格"
              title="显示或隐藏网格"
              aria-pressed={grid}
              onClick={() => setGrid(!grid)}
            >
              <Grid3X3 size={15} />
            </button>
            <button onClick={() => setReset(reset + 1)}>
              <RotateCcw size={15} />
              重置视角
            </button>
          </div>
          <div className="legend">
            <strong>语义标注</strong>
            <span>
              <i style={{ background: "#4682e6" }} />
              钢管
            </span>
            <span>
              <i style={{ background: "#32c850" }} />
              钢筋
            </span>
            <span>
              <i style={{ background: "#b432b4" }} />
              扁钢
            </span>
            <span>
              <i style={{ background: "#b4b4b4" }} />
              背景
            </span>
          </div>
          <div className="view-status">
            <span>{cloud?.header.frame_id ?? "未加载帧"}</span>
            <span>
              {cloud?.header.n.toLocaleString() ?? 0} 点 / 原始{" "}
              {cloud?.header.n_full.toLocaleString() ?? 0}
            </span>
            <span>{cloud?.header.n_instances ?? 0} 个实例</span>
            <span>{cloud?.header.source ?? "—"}</span>
          </div>
          {tab === 4 && (
            <section className="transfer-main">
              <h3>
                <FileCode2 size={17} />
                文件信息与传输结果
              </h3>
              <div className="transfer-file">
                <small>待发送文件</small>
                <h2>{hasProgram ? program.ls_name : "尚未生成程序"}</h2>
                <p>
                  {hasProgram
                    ? new TextEncoder().encode(program.ls_text).length
                    : 0}{" "}
                  字节 · {fid || "未选择帧"}
                </p>
                <p>{demo ? "演示文本，不可执行" : "FANUC ASCII 程序"}</p>
              </div>
              <div className="transfer-result">
                <h2 className="teal-heading">
                  {transfer
                    ? demo
                      ? "模拟完成，未发送文件"
                      : "文件传输完成"
                    : "等待文件传输"}
                </h2>
                <div
                  className={
                    "transfer-progress " +
                    (transfer
                      ? "complete"
                      : process.operation?.kind === "transfer" &&
                          process.operation.status === "running"
                        ? "transferring"
                        : "")
                  }
                />
                <p>
                  {transfer
                    ? `${transfer.bytes} 字节 · ${transfer.remote_path}`
                    : "请先生成程序，再确认下发。"}
                </p>
                <small>只传输文件，不启动机器人</small>
              </div>
            </section>
          )}
        </section>
        <aside className="context-panel">
          <div className="panel-title">
            <Activity size={17} />
            {acquisition
              ? "当前帧信息"
              : tab === 1
                ? "标定结果"
                : tab === 3
                  ? "程序预览"
                  : tab === 4
                    ? "上下文信息"
                    : tab === 2
                      ? "焊缝几何详情"
                      : "识别结果"}
            <span>
              {!acquisition && tab === 0 ? `${visibleSeams.length} 条` : ""}
            </span>
          </div>
          {!compact && (
            <>
              {(acquisition || tab === 0 || tab === 2) && (
                <div className="result-metrics">
                  <div>
                    <small>焊缝数量</small>
                    <strong>{seams.length}</strong>
                  </div>
                  <div>
                    <small>点云总数</small>
                    <strong>{cloud?.header.n.toLocaleString() ?? "—"}</strong>
                  </div>
                  {!acquisition && (
                    <div>
                      <small>实例数</small>
                      <strong>{cloud?.header.n_instances ?? "—"}</strong>
                    </div>
                  )}
                </div>
              )}
              {contextContent}
              {processPanel}
              {recentLog}
            </>
          )}
        </aside>
      </div>
      <section
        className={"playback " + (tab !== 3 ? "playback-secondary" : "")}
      >
        <div>
          <Play size={18} />
          <strong>TCP 轨迹预演</strong>
          <span>{hasProgram ? "相机系 · 100 mm/s" : "生成程序后解锁预演"}</span>
        </div>
        <button
          aria-label={playing ? "暂停" : "播放"}
          disabled={!hasProgram}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <button
          aria-label="重播"
          disabled={!hasProgram}
          onClick={() => {
            setSeconds(0);
            setPlaying(true);
          }}
        >
          <RotateCcw size={16} />
        </button>
        <input
          aria-label="预演进度"
          type="range"
          min={0}
          max={duration || 1}
          step={0.001}
          value={seconds}
          disabled={!hasProgram}
          onChange={(e) => setSeconds(Number(e.target.value))}
        />
        <code>
          {distance.toFixed(1)} / {total.toFixed(1)} mm
        </code>
        <select
          aria-label="预演速度"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          {[0.2, 0.5, 1, 1.5, 2, 3].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
      </section>
      <section className={"task-drawer " + (drawer ? "open" : "")}>
        <button
          className="drawer-heading"
          aria-expanded={drawer}
          aria-controls="task-center-content"
          onClick={() => setDrawer(!drawer)}
        >
          <Terminal size={16} />
          <strong>任务中心</strong>
          <span>{active ? "任务执行中" : "当前无运行任务"}</span>
          <small>{jobs.length} 个会话任务</small>
          <ChevronDown size={16} />
        </button>
        {drawer && (
          <div className="task-body" id="task-center-content">
            <div className="task-history">
              {jobs.length ? (
                jobs.map((j) => (
                  <details key={j.id} open={j.id === active}>
                    <summary>
                      {j.kind === "scan" ? "相机采集" : "焊缝识别"}{" "}
                      <span>{j.state}</span>
                    </summary>
                    <pre>
                      {j.log?.join("\n")}
                      {j.error && "\n" + j.error}
                    </pre>
                  </details>
                ))
              ) : (
                <span>本次会话暂无任务</span>
              )}
            </div>
            <pre className="event-log">
              {events.length
                ? events.join("\n")
                : "系统就绪，等待操作。\n所有任务日志与错误信息将在此保留。"}
            </pre>
          </div>
        )}
      </section>

      <div className="workstation-footnote">
        <span>
          <i className={active || busy ? "working" : ""} />
          {active || busy ? "处理中" : "就绪"}
        </span>
        <span>{cloud?.header.n.toLocaleString() ?? 0} 点</span>
        <span>{fid || "未选择帧"}</span>
        <span>旋转 / 平移 / 缩放 · 毫米</span>
        <strong>{demo ? "离线演示 · 合成数据" : "真实模式 · 后台响应"}</strong>
      </div>
      {toast && (
        <div role="status" className="toast">
          {toast}
          <button onClick={() => setToast("")}>×</button>
        </div>
      )}
      {pending && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <ShieldCheck size={30} />
            <h2 id="dialog-title">
              {pending === "uncalibrated"
                ? "未标定程序警告"
                : pending === "clear"
                  ? "清除当前帧标定？"
                  : demo
                    ? "确认模拟下发（不连接设备）"
                    : "确认下发程序文件"}
            </h2>
            <p>
              {pending === "uncalibrated"
                ? "坐标仍是相机系，禁止上机。该程序仅可用于离线检查。确认继续生成？"
                : pending === "clear"
                  ? "清除后程序将使用相机系坐标，需要重新标定。"
                  : demo
                    ? "仅模拟界面流程，不会连接任何设备，也不会发送文件。演示程序不是可执行机器人程序。"
                    : `目标：${ftp.host}:${ftp.port}\n目录：${ftp.remote_dir}\n程序：${program?.ls_name}\n同名程序将被覆盖。本操作只传输文件，不启动机器人。`}
            </p>
            <div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                取消
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  pending === "uncalibrated"
                    ? void generate(true)
                    : pending === "clear"
                      ? void saveCalib(true)
                      : void push()
                }
              >
                {busy ? "处理中…" : "确认继续"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
