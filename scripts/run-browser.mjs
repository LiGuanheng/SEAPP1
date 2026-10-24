import { spawnSync } from "node:child_process";
for (const script of ["v3-input.mjs", "v3-tour.mjs", "v3-performance.mjs"]) {
  const result = spawnSync(process.execPath, [`scripts/${script}`, ...process.argv.slice(2)], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
