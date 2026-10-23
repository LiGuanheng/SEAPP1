import { spawnSync } from "node:child_process";
for (const script of [
  "v2-browser.mjs",
  "v2-input.mjs",
  "v2-tour.mjs",
  "v2-performance.mjs",
  "v2-acceptance.mjs",
]) {
  const result = spawnSync(process.execPath, [`scripts/${script}`, ...process.argv.slice(2)], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
