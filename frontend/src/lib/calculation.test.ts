import { describe, expect, it } from "vitest";
import {
  calculationPhase,
  calculationStages,
  type Calculation,
} from "./calculation";
describe("calculation display never fabricates backend completion", () => {
  const operation: Calculation = {
    id: 1,
    kind: "recognize",
    status: "running",
    startedAt: 1000,
    detail: "waiting",
    demo: false,
  };
  it("does not advance real jobs based on elapsed time", () => {
    expect(calculationPhase(operation, 1000000)).toBe(0);
    expect(calculationPhase({ ...operation, status: "done" }, 1000000)).toBe(0);
  });
  it("demo stages stop before completion until the actual operation finishes", () => {
    const simulated = { ...operation, demo: true };
    expect(calculationPhase(simulated, 1700)).toBe(1);
    expect(calculationPhase(simulated, 1000000)).toBe(
      calculationStages.recognize.stages.length - 1,
    );
    expect(calculationPhase({ ...simulated, status: "done" }, 1800)).toBe(
      calculationStages.recognize.stages.length,
    );
  });
  it("does not turn failure into completion", () => {
    expect(
      calculationPhase({ ...operation, demo: true, status: "error" }, 1000000),
    ).toBe(0);
  });
});
