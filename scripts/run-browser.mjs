import { spawnSync } from "node:child_process";
for (const script of [
  "legion-orders-browser.mjs",
  "legion-campaign-browser.mjs",
  "legion-performance.mjs",
]) {
  const result = spawnSync(process.execPath, [`scripts/${script}`, ...process.argv.slice(2)], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
