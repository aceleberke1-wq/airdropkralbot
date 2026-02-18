import "../styles.css";
import { installPerfBridge } from "./telemetry/bridge";
import { installTelemetryDeckBridge } from "./ui/telemetryDeck";

installPerfBridge();
installTelemetryDeckBridge();

// Legacy runtime stays source of truth while V3.2 TS bundle rolls out.
import("../app.js").catch((err) => {
  console.error("legacy-webapp-bootstrap-failed", err);
});
