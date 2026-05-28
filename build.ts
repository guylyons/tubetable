#!/usr/bin/env bun
import plugin from "bun-plugin-tailwind";
import { rm } from "node:fs/promises";
import path from "node:path";

const outdir = path.resolve("dist");
const start = performance.now();

await rm(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [path.resolve("src/index.html")],
  outdir,
  plugins: [plugin],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

const rows = result.outputs.map((output) => ({
  file: path.relative(process.cwd(), output.path),
  type: output.kind,
  size: `${(output.size / 1024).toFixed(1)} KB`,
}));

console.table(rows);
console.log(`Built in ${(performance.now() - start).toFixed(0)}ms`);
