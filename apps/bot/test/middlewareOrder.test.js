const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("slash telemetry middleware is registered before command handlers", () => {
  const sourcePath = path.join(process.cwd(), "apps", "bot", "src", "index.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  const safeMarkdownIdx = source.indexOf("bot.use(createSafeMarkdownReplyMiddleware");
  const slashTelemetryIdx = source.indexOf("bot.use(\n    createSlashCommandTelemetryMiddleware");
  const registerCommandsIdx = source.indexOf("const registration = registerRegistryCommandHandlers");

  assert.ok(safeMarkdownIdx >= 0, "safe markdown middleware registration missing");
  assert.ok(slashTelemetryIdx >= 0, "slash telemetry middleware registration missing");
  assert.ok(registerCommandsIdx >= 0, "command registry registration missing");
  assert.ok(slashTelemetryIdx > safeMarkdownIdx, "slash telemetry should run after markdown patch middleware");
  assert.ok(slashTelemetryIdx < registerCommandsIdx, "slash telemetry should run before command handlers");
});
