import { describe, it, expect } from "vitest";
import { demoCloud, demoRequest, demoSeams } from "./demo";
import { parseCloud } from "./core";
describe("explicit synthetic demonstration data", () => {
  it("provides a valid mm cloud with nonzero semantic colors and 6 objects", () => {
    const cloud = parseCloud(demoCloud("DEMO_PIPE_A"));
    expect(cloud.header.n).toBeGreaterThan(60000);
    expect(cloud.header.n_instances).toBe(6);
    expect(cloud.header.source).toBe("demo");
    expect(cloud.rgb.slice(0, 3)).toEqual(new Uint8Array([70, 130, 230]));
    expect(demoSeams("DEMO_PIPE_A")).toHaveLength(3);
  });
  it("generates preview coordinates and a nonexecutable example document", async () => {
    const response = await demoRequest("/program", {
      body: JSON.stringify({ frame: "DEMO_PIPE_A", seam_id: 1 }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ls_text).toContain("NOT AN EXECUTABLE");
    expect(
      data.ls_text.split("\n").every((line: string) => line.startsWith(";")),
    ).toBe(true);
    expect(data.waypoints_cam_mm).toHaveLength(21);
    expect(data.waypoints_base_mm).toEqual([]);
  });
  it("simulates transfer with zero bytes and no destination connection", async () => {
    await demoRequest("/program", {
      body: JSON.stringify({ frame: "DEMO_PIPE_A", seam_id: 1 }),
    });
    const response = await demoRequest("/push", {
      body: JSON.stringify({
        frame: "DEMO_PIPE_A",
        seam_id: 1,
        host: "192.0.2.1",
      }),
    });
    const data = await response.json();
    expect(data.demo).toBe(true);
    expect(data.bytes).toBe(0);
    expect(data.remote_path).toContain("未发送到控制器");
  });
  it("rejects unknown frames", async () =>
    expect(
      (
        await demoRequest("/program", {
          body: JSON.stringify({ frame: "missing", seam_id: 1 }),
        })
      ).status,
    ).toBe(404));
});
