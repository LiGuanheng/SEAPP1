import { spawnSync } from "node:child_process";
for (const script of [
  "smart-orders-browser.mjs",
  "smart-campaign-browser.mjs",
  "smart-performance.mjs",
]) {
  const result = spawnSync(process.execPath, [`scripts/${script}`, ...process.argv.slice(2)], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
