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
