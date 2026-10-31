import { describe, it, expect } from "vitest";
import { mergeCalibration } from "./calibration";
describe("calibration residual observations", () => {
  const previous = {
    calib_tag: "A",
    uncalibrated: false,
    max_dev_mm: 2,
    mean_dev_mm: 1,
  };
  it("retains residuals only for the same tag", () => {
    expect(
      mergeCalibration({ calib_tag: "A", uncalibrated: false }, previous)
        .max_dev_mm,
    ).toBe(2);
  });
  it("does not attach stale residuals to another calibration", () => {
    expect(
      mergeCalibration({ calib_tag: "B", uncalibrated: false }, previous)
        .max_dev_mm,
    ).toBeUndefined();
  });
  it("clearing calibration discards residuals", () => {
    expect(
      mergeCalibration({ calib_tag: "A", uncalibrated: true }, previous)
        .max_dev_mm,
    ).toBeUndefined();
  });
});
