"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function envFlag(key, defaultValue = false) {
  const raw = String(process.env[key] ?? "");
  if (!raw) {
    return defaultValue;
  }
  const normalized = raw.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

const isRender = envFlag("RENDER", false);
const botEnabled = envFlag("BOT_ENABLED", true);
const keepAdminOnBotExit = envFlag("KEEP_ADMIN_ON_BOT_EXIT", isRender || !botEnabled);
const botAutoRestart = envFlag("BOT_AUTO_RESTART", isRender && botEnabled);
const botRestartDelayMs = Math.max(1000, Number(process.env.BOT_RESTART_DELAY_MS || 5000));

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
let bot = null;
let botRestartTimer = null;

function clearBotRestartTimer() {
  if (botRestartTimer) {
    clearTimeout(botRestartTimer);
    botRestartTimer = null;
  }
}

function maybeStartBot() {
  if (!botEnabled) {
    console.log("[start:all] BOT_ENABLED=0, bot process disabled for this service");
    return;
  }
  clearBotRestartTimer();
  bot = startProcess("bot", "apps/bot/src/index.js", {
    BOT_DRY_RUN: process.env.BOT_DRY_RUN || "0"
  });
  bot.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }
    if (botAutoRestart) {
      console.log(
        `[start:all] bot exited; restart in ${botRestartDelayMs}ms (code=${code}, auto_restart=${botAutoRestart})`
      );
      botRestartTimer = setTimeout(() => {
        if (!shuttingDown) {
          maybeStartBot();
        }
      }, botRestartDelayMs);
      return;
    }
    if (keepAdminOnBotExit) {
      console.log("[start:all] bot exited; admin-api will stay up (KEEP_ADMIN_ON_BOT_EXIT=1)");
      return;
    }
    stopAll(`bot-exit-${code}`);
    process.exit(typeof code === "number" ? code : 1);
  });
}

maybeStartBot();

function stopAll(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[start:all] shutting down (${reason})`);
  clearBotRestartTimer();
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

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
