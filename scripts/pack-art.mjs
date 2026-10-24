import puppeteer from "puppeteer-core";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
// Asset encoding only: original generated PNGs stay in art-source for audit and re-export.
const executablePath =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
  defaultViewport: { width: 100, height: 100 },
});
const page = await browser.newPage(),
  manifest = [];
mkdirSync("public/art", { recursive: true });
try {
  for (const name of readdirSync("art-source").filter(
    (n) => n.endsWith(".png") && n !== "heroes.png",
  )) {
    const source = resolve("art-source", name),
      target = resolve("public/art", name.replace(".png", ".webp"));
    const input = readFileSync(source);
    const output = await page.evaluate(
      async (data) => {
        const img = new Image();
        img.src = data;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        return {
          data: canvas.toDataURL("image/webp", 0.92).split(",")[1],
          width: canvas.width,
          height: canvas.height,
        };
      },
      `data:image/png;base64,${input.toString("base64")}`,
    );
    writeFileSync(target, Buffer.from(output.data, "base64"));
    manifest.push({
      name: target.split(/[\\/]/).pop(),
      width: output.width,
      height: output.height,
      sourceBytes: input.length,
      packedBytes: statSync(target).size,
    });
  }
  const output = JSON.parse(readFileSync("package.json", "utf8")).version.startsWith("3.")
    ? "docs/v3/ART_MANIFEST.json"
    : "docs/V2_ART_MANIFEST.json";
  writeFileSync(output, JSON.stringify(manifest, null, 2));
  console.log(
    JSON.stringify({
      assets: manifest.length,
      sourceBytes: manifest.reduce((s, a) => s + a.sourceBytes, 0),
      packedBytes: manifest.reduce((s, a) => s + a.packedBytes, 0),
    }),
  );
} finally {
  await browser.close();
}
