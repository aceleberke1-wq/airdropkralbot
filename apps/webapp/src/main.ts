import "../styles.css";
import { installPerfBridge } from "./telemetry/bridge";
import { installTelemetryDeckBridge } from "./ui/telemetryDeck";
import { installPvpRadarBridge } from "./ui/pvpRadarBridge";
import { installPvpEventBridge } from "./ui/pvpEventBridge";
import { installCombatHudBridge } from "./ui/combatHudBridge";
import { installPvpDirectorBridge } from "./ui/pvpDirectorBridge";

installPerfBridge();
installTelemetryDeckBridge();
installPvpRadarBridge();
installPvpEventBridge();
installCombatHudBridge();
installPvpDirectorBridge();

// Legacy runtime stays source of truth while V3.2 TS bundle rolls out.
import("../app.js").catch((err) => {
  console.error("legacy-webapp-bootstrap-failed", err);
});
