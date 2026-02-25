import "../styles.css";
import { installPerfBridge } from "./telemetry/bridge";
import { installTelemetryDeckBridge } from "./ui/telemetryDeck";
import { installPvpRadarBridge } from "./ui/pvpRadarBridge";
import { installPvpEventBridge } from "./ui/pvpEventBridge";
import { installCombatHudBridge } from "./ui/combatHudBridge";
import { installPvpDirectorBridge } from "./ui/pvpDirectorBridge";
import { installPvpDuelBridge } from "./ui/pvpDuelBridge";
import { installCombatFxBridge } from "./ui/combatFxBridge";
import { installSceneTelemetryBridge } from "./ui/sceneTelemetryBridge";
import { installTokenTreasuryBridge } from "./ui/tokenTreasuryBridge";
import { installAdminTreasuryBridge } from "./ui/adminTreasuryBridge";
import { installNetSchedulerBridge } from "./net/schedulerBridge";
import { installNetApiBridge } from "./net/apiBridge";

installPerfBridge();
installTelemetryDeckBridge();
installPvpRadarBridge();
installPvpEventBridge();
installCombatHudBridge();
installPvpDirectorBridge();
installPvpDuelBridge();
installCombatFxBridge();
installSceneTelemetryBridge();
installTokenTreasuryBridge();
installAdminTreasuryBridge();
installNetSchedulerBridge();
installNetApiBridge();

// Legacy runtime stays source of truth while V3.2 TS bundle rolls out.
import("../app.js").catch((err) => {
  console.error("legacy-webapp-bootstrap-failed", err);
});
