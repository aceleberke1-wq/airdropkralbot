"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function startProcess(name, scriptPath, extraEnv = {}) {
  const child = spawn(process.execPath, [scriptPath], {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    console.log(`[start:all] ${name} exited (code=${code}, signal=${signal || "none"})`);
  });

  child.on("error", (err) => {
    console.error(`[start:all] ${name} spawn error`, err);
  });

  return child;
}

let shuttingDown = false;
const admin = startProcess("admin-api", "apps/admin-api/src/index.js");
const bot = startProcess("bot", "apps/bot/src/index.js", {
  BOT_DRY_RUN: process.env.BOT_DRY_RUN || "0"
});

function stopAll(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[start:all] shutting down (${reason})`);
  for (const proc of [admin, bot]) {
    if (proc && !proc.killed) {
      try {
        proc.kill("SIGTERM");
      } catch {}
    }
  }
  setTimeout(() => process.exit(0), 700);
}

admin.on("exit", (code) => {
  if (!shuttingDown) {
    stopAll(`admin-api-exit-${code}`);
    process.exit(typeof code === "number" ? code : 1);
  }
});

bot.on("exit", (code) => {
  if (!shuttingDown) {
    stopAll(`bot-exit-${code}`);
    process.exit(typeof code === "number" ? code : 1);
  }
});

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
