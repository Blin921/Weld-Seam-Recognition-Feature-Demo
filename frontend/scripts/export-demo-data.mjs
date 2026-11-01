import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const result = await build({
  absWorkingDir: root,
  stdin: {
    contents: 'export { demoPcd, demoPcdFrames } from "./src/lib/demo.ts";',
    resolveDir: root,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { demoPcd, demoPcdFrames } = await import(
  "data:text/javascript;base64," +
    Buffer.from(result.outputFiles[0].text).toString("base64")
);
const directory = path.resolve(root, "../demo/data");
await mkdir(directory, { recursive: true });
for (const frame of demoPcdFrames) {
  const content = demoPcd(frame);
  await writeFile(path.join(directory, frame + ".pcd"), content);
  console.log(
    `${frame}.pcd: ${(Buffer.byteLength(content) / 1024 / 1024).toFixed(2)} MB`,
  );
}
