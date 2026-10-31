import { describe, it, expect } from "vitest";
import {
  parseCloud,
  displayPoint,
  arcLengths,
  pathAtTime,
  pathDuration,
  samplePath,
  Vec,
} from "./core";
describe("binary cloud", () => {
  function fixture() {
    const buffer = new ArrayBuffer(2070);
    const h = {
      version: 1,
      units: "mm",
      frame: "camera",
      n: 1,
      offsets: { xyz: 2052, rgb: 2064, instance: 2068 },
    };
    const bytes = new TextEncoder().encode(JSON.stringify(h));
    new DataView(buffer).setUint32(0, bytes.length, true);
    new Uint8Array(buffer, 4, bytes.length).set(bytes);
    new Float32Array(buffer, 2052, 3).set([1, 2, 3]);
    new Uint8Array(buffer, 2064, 3).set([70, 130, 230]);
    new Uint16Array(buffer, 2068, 1)[0] = 2;
    return buffer;
  }
  it("reads absolute offsets without copying", () => {
    const buffer = fixture(),
      cloud = parseCloud(buffer);
    expect([...cloud.xyz]).toEqual([1, 2, 3]);
    expect([...cloud.rgb]).toEqual([70, 130, 230]);
    expect(cloud.instance[0]).toBe(2);
    expect(cloud.xyz.buffer).toBe(buffer);
  });
  it("rejects truncated and invalid headers", () => {
    expect(() => parseCloud(new ArrayBuffer(2))).toThrow();
    const b = fixture();
    new DataView(b).setUint32(0, 2049, true);
    expect(() => parseCloud(b)).toThrow();
    expect(() => parseCloud(fixture().slice(0, 2060))).toThrow();
  });
});
describe("camera and animation", () => {
  const points: Vec[] = [
    [0, 0, 0],
    [100, 0, 0],
    [200, 0, 0],
    [300, 0, 0],
    [400, 0, 0],
  ];
  it("flips only Y", () =>
    expect(displayPoint([10, 20, 30])).toEqual([10, -20, 30]));
  it("accumulates and interpolates", () => {
    expect(
      arcLengths([
        [0, 0, 0],
        [3, 4, 0],
        [3, 4, 12],
      ]),
    ).toEqual([0, 5, 17]);
    expect(samplePath(points, 150)).toEqual({ point: [150, 0, 0], segment: 1 });
  });
  it("holds FINE for .4s at third and penultimate points", () => {
    expect(pathAtTime(points, 2.2)).toBe(200);
    expect(pathAtTime(points, 2.5)).toBeCloseTo(210);
    expect(pathAtTime(points, 3.6)).toBe(300);
    expect(pathDuration(points)).toBe(4.8);
    expect(pathAtTime(points, 100)).toBe(400);
  });
  it("short paths have no pause", () => {
    expect(pathDuration(points.slice(0, 3))).toBe(2);
    expect(pathAtTime([], 10)).toBe(0);
  });
});
