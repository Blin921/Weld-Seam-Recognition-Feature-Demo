"use client";
import { useCallback, useRef, useState } from "react";
import {
  holdDemoAnimation,
  type Calculation,
  type CalculationKind,
} from "./calculation";
export function useCalculation(demo: boolean) {
  const [operation, setOperation] = useState<Calculation | null>(null);
  const [paused, setPaused] = useState(false);
  const sequence = useRef(0);
  const begin = useCallback(
    (
      kind: CalculationKind,
      detail = "正在等待处理结果",
      illustration = false,
    ) => {
      const value: Calculation = {
        id: ++sequence.current,
        kind,
        status: "running",
        startedAt: Date.now(),
        detail,
        demo: illustration || demo,
        illustration,
      };
      setPaused(false);
      setOperation(value);
      return value;
    },
    [demo],
  );
  const finish = useCallback(
    (token: Calculation | null, status: "done" | "error", detail: string) => {
      if (token)
        setOperation((current) =>
          current?.id === token.id ? { ...current, status, detail } : current,
        );
    },
    [],
  );
  const update = useCallback((token: Calculation | null, detail: string) => {
    if (token)
      setOperation((current) =>
        current?.id === token.id ? { ...current, detail } : current,
      );
  }, []);
  const replay = useCallback(
    async (kind: CalculationKind) => {
      const token = begin(
        kind,
        "计算流程动画示意；未发起后台计算或设备操作",
        true,
      );
      await holdDemoAnimation(true, token.startedAt, 2500);
      finish(token, "done", "动画示意已完成；实际结果以任务返回为准");
    },
    [begin, finish],
  );
  return {
    operation,
    paused,
    togglePaused: () => setPaused((value) => !value),
    begin,
    finish,
    update,
    replay,
  };
}
