import type { Calib } from "./core";
/** GET status may omit residuals: retain only observations for the same calibration tag. */
export function mergeCalibration(status: Calib, previous?: Calib): Calib {
  if (
    status.uncalibrated ||
    !previous ||
    status.calib_tag !== previous.calib_tag
  )
    return status;
  return { ...previous, ...status };
}

/** Only render matrices whose numeric shape is confirmed; never substitute an identity matrix. */
export function validatedMatrix(value: unknown): number[][] | undefined {
  return Array.isArray(value) &&
    value.length === 4 &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 4 &&
        row.every(
          (number) => typeof number === "number" && Number.isFinite(number),
        ),
    )
    ? value
    : undefined;
}
