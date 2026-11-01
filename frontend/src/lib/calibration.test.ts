import { describe, it, expect } from "vitest";
import { mergeCalibration, validatedMatrix } from "./calibration";
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

describe("read-only matrix shape", () => {
  it("accepts a finite 4x4 matrix", () => {
    const matrix = [
      [1, 0, 0, 320],
      [0, 1, 0, 125],
      [0, 0, 1, -20],
      [0, 0, 0, 1],
    ];
    expect(validatedMatrix(matrix)).toBe(matrix);
  });
  it("does not fabricate a matrix when it is missing or malformed", () => {
    for (const value of [
      null,
      undefined,
      [],
      [null, null, null, null],
      [
        [NaN, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    ])
      expect(validatedMatrix(value)).toBeUndefined();
  });
});
