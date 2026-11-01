import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const outputDir = path.resolve(root, "../demo");
const result = await build({
  absWorkingDir: root,
  entryPoints: ["static-demo/entry.tsx"],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["chrome110", "edge110", "firefox115", "safari16.4"],
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_STATIC_DEMO": '"1"',
  },
  alias: {
    "next/link": path.join(root, "static-demo/link.tsx"),
    "next/navigation": path.join(root, "static-demo/navigation.ts"),
    "next/dynamic": path.join(root, "static-demo/dynamic.tsx"),
  },
  legalComments: "eof",
});
const css = (
  await Promise.all(
    ["globals.css", "industrial.css"].map((file) =>
      readFile(path.join(root, "src/app", file), "utf8"),
    ),
  )
).join("\n");
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="焊缝识别系统离线交互演示，内置合成数据，无需安装或联网。">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; worker-src blob:; base-uri 'none'; form-action 'none'">
<title>焊缝识别系统 · 离线演示</title>
<style>${css}</style></head><body><div id="root"></div>
<noscript>请使用启用 JavaScript 的 Edge 或 Chrome 浏览器打开本文件。</noscript>
<script>${js}</script></body></html>`;
await mkdir(outputDir, { recursive: true });
const file = path.join(outputDir, "WELD-VISION.html");
await writeFile(file, html);
console.log(
  `离线演示已生成：${file}（${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB）`,
);
