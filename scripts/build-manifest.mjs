import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, join, sep } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
const files = walk("dist")
  .filter((p) => !p.endsWith("build-manifest.json"))
  .sort()
  .map((p) => {
    const bytes = readFileSync(p);
    return {
      path: relative("dist", p).split(sep).join("/"),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
const sourceCommit =
  process.env.GITHUB_SHA ??
  (spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim() || "uncommitted");
const gitStatus = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
writeFileSync(
  "dist/build-manifest.json",
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      sourceCommit,
      dirtyWorkingTree: gitStatus.status !== 0 || !!gitStatus.stdout.trim(),
      buildTime: new Date().toISOString(),
      files,
    },
    null,
    2,
  ),
);
console.log(
  `Build manifest: ${files.length} files, ${files.reduce((s, f) => s + f.bytes, 0)} bytes`,
);
