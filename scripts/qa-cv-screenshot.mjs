import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const strict = process.env.QA_CV_STRICT === "true";
const port = process.env.QA_CV_PORT ?? "3025";
const baseUrl = `http://127.0.0.1:${port}`;
const outputPath = "artifacts/cv-screenshots/ben-smith-final-cv.png";

function softFail(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CV screenshot QA failed: ${message}`);
  if (strict) process.exit(1);
  process.exit(0);
}

async function waitForServer(url, timeoutMs = 45_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Playwright is not installed. Run npm install first.");
  }

  const server = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", port],
    {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let serverOutput = "";
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    await waitForServer(`${baseUrl}/dev/cv-preview/ben-smith`);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
    await page.goto(`${baseUrl}/dev/cv-preview/ben-smith`, {
      waitUntil: "networkidle",
    });
    const document = page.locator("[data-cv-document]");
    await document.waitFor({ state: "visible", timeout: 10_000 });
    await mkdir("artifacts/cv-screenshots", { recursive: true });
    await document.screenshot({ path: outputPath });
    await browser.close();
    console.log(`Saved CV screenshot to ${outputPath}`);
  } catch (error) {
    if (serverOutput) console.error(serverOutput.slice(-4000));
    throw error;
  } finally {
    server.kill();
  }
}

main().catch(softFail);
