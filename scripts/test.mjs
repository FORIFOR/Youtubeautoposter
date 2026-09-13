import { build } from "esbuild";
import { readdir, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".test-build", { recursive: true });
const files = (await readdir("tests")).filter(f => f.endsWith(".test.ts"));
await build({ entryPoints: files.map(f => `tests/${f}`), outdir: ".test-build", outExtension: { ".js": ".cjs" }, platform: "node", format: "cjs", bundle: true, packages: "external", plugins: [{ name: "test-worker-env", setup(b) { b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "workers", namespace: "test-worker-env" })); b.onLoad({ filter: /.*/, namespace: "test-worker-env" }, () => ({ contents: "export const env = {};", loader: "js" })); } }] });
const result = spawnSync(process.execPath, ["--test", ...files.map(f => `.test-build/${f.replace(/\.ts$/, ".cjs")}`)], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
