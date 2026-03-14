import type { ReactNode } from "react";
import { t, type Lang } from "../../i18n";

type SceneBridgeDockProps = {
  lang: Lang;
  workspace: "player" | "admin";
  tab: "home" | "pvp" | "tasks" | "vault";
  advanced: boolean;
};

function MeterTrack(props: { id: string }) {
  return (
    <div className="akrBridgeMeter">
      <span id={props.id} />
    </div>
  );
}

function BridgeChip(props: { id: string; className?: string }) {
  return (
    <span id={props.id} className={props.className || "combatAlertChip neutral"}>
      --
    </span>
  );
}

function BridgeCard(props: { title: string; children: ReactNode }) {
  return (
    <section className="akrCard akrBridgeCard">
      <h3>{props.title}</h3>
      {props.children}
    </section>
  );
}

function PlayerBridgeCards(props: { lang: Lang; tab: SceneBridgeDockProps["tab"] }) {
  return (
    <>
      <BridgeCard title={t(props.lang, "scene_bridge_scene_title")}>
        <div id="sceneStatusDeck" className="akrBridgeStrip" data-tone="balanced">
          <div className="akrBridgeHeader">
            <span id="liteSceneBadge" className="badge info hidden">
              Lite Scene
            </span>
          </div>
          <p id="sceneProfileLine" className="akrBridgeLine">
            -
          </p>
          <p id="sceneLoopLine" className="akrBridgeHint">
            Loop state bekleniyor.
          </p>
          <div className="akrChipRow">
            <BridgeChip id="sceneDeckModeChip" className="combatAlertChip neutral tone-neutral" />
            <BridgeChip id="sceneDeckPerfChip" className="combatAlertChip neutral tone-neutral" />
            <BridgeChip id="sceneDeckAssetChip" className="combatAlertChip neutral tone-neutral" />
            <BridgeChip id="sceneDeckTransportChip" className="combatAlertChip neutral tone-neutral" />
            <BridgeChip id="sceneDeckManifestChip" className="combatAlertChip neutral tone-neutral" />
          </div>
        </div>

        <div id="sceneAlarmStrip" className="akrBridgeStrip" data-tone="neutral">
          <div className="akrBridgeHeader">
            <span id="sceneAlarmBadge" className="badge info">
              SCENE OK
            </span>
          </div>
          <p id="sceneAlarmLine" className="akrBridgeLine">
            -
          </p>
          <p id="sceneAlarmHint" className="akrBridgeHint">
            -
          </p>
          <MeterTrack id="sceneAlarmMeter" />
          <div className="akrChipRow">
            <BridgeChip id="sceneAlarmPressureChip" />
            <BridgeChip id="sceneAlarmAssetChip" />
            <BridgeChip id="sceneAlarmRejectChip" />
            <BridgeChip id="sceneAlarmFreshChip" />
          </div>
        </div>

        <div id="sceneIntegrityOverlay" className="akrBridgeStrip hidden" data-tone="neutral">
          <div className="akrBridgeHeader">
            <span id="sceneIntegrityOverlayBadge" className="badge info">
              SCENE STABLE
            </span>
          </div>
          <p id="sceneIntegrityOverlayLine" className="akrBridgeLine">
            -
          </p>
          <MeterTrack id="sceneIntegrityOverlayMeter" />
          <div className="akrChipRow">
            <BridgeChip id="sceneIntegrityOverlayAssetChip" />
            <BridgeChip id="sceneIntegrityOverlayIntegrityChip" />
            <BridgeChip id="sceneIntegrityOverlaySyncChip" />
            <BridgeChip id="sceneIntegrityOverlayRejectChip" />
          </div>
        </div>
      </BridgeCard>

      <BridgeCard title={t(props.lang, "scene_bridge_manifest_title")}>
        <div id="assetManifestStrip" className="akrBridgeStrip" data-tone="neutral">
          <div className="akrBridgeHeader">
            <span id="assetManifestBadge" className="badge info">
              ASSET 0/0
            </span>
          </div>
          <p id="assetManifestLine" className="akrBridgeLine">
            -
          </p>
          <p id="assetManifestHint" className="akrBridgeHint">
            -
          </p>
          <MeterTrack id="assetManifestReadyMeter" />
          <MeterTrack id="assetManifestIntegrityMeter" />
          <div className="akrChipRow">
            <BridgeChip id="assetManifestSourceChip" />
            <BridgeChip id="assetManifestRevisionChip" />
            <BridgeChip id="assetManifestReadyChip" />
            <BridgeChip id="assetManifestIntegrityChip" />
          </div>
        </div>

        <div id="pvpLeaderboardStrip" className="akrBridgeStrip" data-tone="neutral">
          <div className="akrBridgeHeader">
            <span id="pvpLeaderBadge" className="badge info">
              TOP 0
            </span>
          </div>
          <p id="pvpLeaderLine" className="akrBridgeLine">
            -
          </p>
          <MeterTrack id="pvpLeaderHeatMeter" />
          <MeterTrack id="pvpLeaderFreshMeter" />
          <div className="akrChipRow">
            <BridgeChip id="pvpLeaderSpreadChip" />
            <BridgeChip id="pvpLeaderVolumeChip" />
            <BridgeChip id="pvpLeaderFreshChip" />
            <BridgeChip id="pvpLeaderTransportChip" />
          </div>
        </div>
      </BridgeCard>

      {props.tab === "pvp" ? (
        <BridgeCard title={t(props.lang, "scene_bridge_pvp_title")}>
          <div className="akrPvpBridgeGrid">
            <div className="akrSplit">
              <div className="akrBridgeStrip">
                <p className="akrBridgeHint">Round Director</p>
                <p id="roundHeatLine" className="akrBridgeLine">
                  0% | WARMUP
                </p>
                <MeterTrack id="roundHeatMeter" />
                <p id="roundTempoLine" className="akrBridgeLine">
                  0% | Tick 1000ms
                </p>
                <MeterTrack id="roundTempoMeter" />
                <p id="roundDominanceLine" className="akrBridgeLine">
                  YOU 0 - 0 OPP | EVEN
                </p>
                <MeterTrack id="roundDominanceMeter" />
                <p id="roundPressureLine" className="akrBridgeLine">
                  0% | Queue 0
                </p>
                <MeterTrack id="roundPressureMeter" />
              </div>

              <div id="pvpCineStrip" className="akrBridgeStrip akrPvpCineStrip" data-tone="neutral">
                <div className="akrBridgeHeader">
                  <span id="pvpCinePhaseBadge" className="badge info">
                    DUEL PHASE
                  </span>
                  <span id="pvpCineHint" className="akrBridgeHint">
                    Tick akisina kilitlen.
                  </span>
                </div>
                <p id="pvpCineLine" className="akrBridgeLine">
                  Cinematic Director
                </p>
                <p id="pvpLoopLine" className="akrBridgeHint">
                  Arena loop bekleniyor.
                </p>
                <p id="pvpLoopHint" className="akrBridgeHint">
                  Scene loop focus bekleniyor.
                </p>
                <MeterTrack id="pvpCineMeter" />
                <div className="akrBridgeStrip akrCameraDirectorBox">
                  <p className="akrBridgeHint">Cinematic Camera</p>
                  <p id="cameraModeLine" className="akrBridgeLine" data-mode="broadcast">
                    BROADCAST | Drift 0%
                  </p>
                  <MeterTrack id="cameraEnergyMeter" />
                  <p id="cameraFocusLine" className="akrBridgeHint">
                    Focus dengede, director hazir.
                  </p>
                </div>
              </div>
            </div>

            <div className="akrSplit">
              <div id="pvpRadarStrip" className="akrBridgeStrip akrPvpRadarStrip" data-tone="neutral">
                <div className="akrBridgeHeader">
                  <span className="akrBridgeHint">Duel Radar</span>
                  <span id="pvpRadarToneBadge" className="badge info">
                    IDLE
                  </span>
                </div>
                <canvas id="pvpRadarCanvas" width={360} height={196} />
                <p id="pvpRadarLine" className="akrBridgeLine">
                  Sweep 0% | Drift 0 | Queue 0
                </p>
                <p id="pvpRadarHint" className="akrBridgeHint">
                  Radar feed bekleniyor.
                </p>
                <div className="akrSplit akrPvpMiniStats">
                  <div className="akrBridgeStrip">
                    <p id="pvpDuelFlowLine" className="akrBridgeLine">
                      FLOW 0% | STABLE
                    </p>
                    <MeterTrack id="pvpDuelFlowMeter" />
                  </div>
                  <div className="akrBridgeStrip">
                    <p id="pvpClutchVectorLine" className="akrBridgeLine">
                      VECTOR 0% | LOCK
                    </p>
                    <MeterTrack id="pvpClutchVectorMeter" />
                  </div>
                </div>
              </div>

              <div id="pvpRejectIntelStrip" className="akrBridgeStrip akrPvpRejectIntelStrip" data-tone="neutral" data-category="none" data-recent="0">
                <div className="akrBridgeHeader">
                  <span id="pvpRejectIntelBadge" className="badge info">
                    CLEAN
                  </span>
                  <div className="akrChipRow akrPvpChipWrap">
                    <span id="pvpRejectIntelReasonChip" className="pvpLiveChip neutral">
                      REJ NONE
                    </span>
                    <span id="pvpRejectIntelFreshChip" className="pvpLiveChip neutral">
                      FRESH --
                    </span>
                    <span id="pvpRejectIntelWindowChip" className="pvpLiveChip neutral">
                      WND --
                    </span>
                    <span id="pvpRejectIntelAssetChip" className="pvpLiveChip neutral">
                      AST --
                    </span>
                  </div>
                </div>
                <p id="pvpRejectIntelLine" className="akrBridgeLine">
                  Reject diagnostics bekleniyor.
                </p>
                <div className="akrSplit akrPvpMiniStats">
                  <div className="akrBridgeStrip">
                    <p className="akrBridgeHint">Recovery Window</p>
                    <MeterTrack id="pvpRejectIntelRecoveryMeter" />
                  </div>
                  <div className="akrBridgeStrip">
                    <p className="akrBridgeHint">Risk / Drift</p>
                    <MeterTrack id="pvpRejectIntelRiskMeter" />
                  </div>
                </div>
                <p id="pvpRejectIntelHint" className="akrBridgeHint">
                  Reject diagnostics aktif.
                </p>
                <p id="pvpRejectIntelPlan" className="akrBridgeHint">
                  Plan bilgisi yok.
                </p>
                <div id="pvpRejectIntelActionPanel" className="akrBridgeStrip akrPvpRejectAction" data-tone="neutral" data-category="none">
                  <div className="akrChipRow akrPvpChipWrap">
                    <span id="pvpRejectIntelDirectiveChip" className="pvpLiveChip neutral">
                      DIR WAIT
                    </span>
                    <span id="pvpRejectIntelExpectedChip" className="pvpLiveChip neutral">
                      EXP --
                    </span>
                    <span id="pvpRejectIntelQueueChip" className="pvpLiveChip neutral">
                      Q --
                    </span>
                    <span id="pvpRejectIntelBackoffChip" className="pvpLiveChip neutral">
                      BACKOFF --
                    </span>
                    <span id="pvpRejectIntelSyncChip" className="pvpLiveChip neutral">
                      SYNC --
                    </span>
                  </div>
                  <p id="pvpRejectIntelSolutionLine" className="akrBridgeHint">
                    Recovery guidance bekleniyor.
                  </p>
                </div>
              </div>
            </div>

            <div className="akrSplit">
              <div className="akrBridgeStrip">
                <p id="pvpTickLive" className="akrBridgeHint pvpTickLine">
                  Tick: bekleniyor
                </p>
                <div className="pvpMomentumStrip">
                  <div className="pvpMomentumCell">
                    <p className="akrBridgeHint">Momentum (Sen)</p>
                    <p id="pvpMomentumSelfLine" className="akrBridgeLine">
                      50% | EVEN
                    </p>
                    <MeterTrack id="pvpMomentumSelfMeter" />
                  </div>
                  <div className="pvpMomentumCell">
                    <p className="akrBridgeHint">Momentum (Rakip)</p>
                    <p id="pvpMomentumOppLine" className="akrBridgeLine">
                      50% | EVEN
                    </p>
                    <MeterTrack id="pvpMomentumOppMeter" />
                  </div>
                </div>

                <div className="pvpObjectiveGrid">
                  <article id="pvpObjectivePrimary" className="pvpObjectiveCard neutral">
                    <p className="label">Hedef 1</p>
                    <p className="value">Pattern Hazir</p>
                    <p className="micro">Beklenen aksiyonla ritmi tut.</p>
                  </article>
                  <article id="pvpObjectiveSecondary" className="pvpObjectiveCard neutral">
                    <p className="label">Hedef 2</p>
                    <p className="value">Resolve Penceresi</p>
                    <p className="micro">Duel cozum ritmi.</p>
                  </article>
                  <article id="pvpObjectiveRisk" className="pvpObjectiveCard neutral">
                    <p className="label">Risk Komutu</p>
                    <p className="value">Kontrol Modu</p>
                    <p className="micro">Baski artarsa guard ile dengele.</p>
                  </article>
                </div>
              </div>

              <div id="pvpTheaterStrip" className="akrBridgeStrip pvpTheaterStrip" data-tone="neutral">
                <div className="pvpCadenceStrip">
                  <div className="pvpCadenceCell">
                    <p className="akrBridgeHint">Tick Pulse</p>
                    <p id="pvpPulseLine" className="akrBridgeLine">
                      Phase 0% | Window 80%
                    </p>
                    <MeterTrack id="pvpPulseMeter" />
                    <MeterTrack id="pvpWindowMeter" />
                    <p id="pvpCadenceHint" className="akrBridgeHint">
                      Cadence bekleniyor.
                    </p>
                  </div>
                </div>
                <div className="pvpTheaterStrip">
                  <div className="pvpTheaterCell">
                    <p className="akrBridgeHint">Duel Senkron</p>
                    <p id="pvpSyncLine" className="akrBridgeLine">
                      SYNC 50% | EVEN
                    </p>
                    <MeterTrack id="pvpSyncMeter" />
                    <p id="pvpSyncHint" className="akrBridgeHint">
                      Senkron farki bekleniyor.
                    </p>
                  </div>
                  <div className="pvpTheaterCell">
                    <p className="akrBridgeHint">Overheat Core</p>
                    <p id="pvpOverheatLine" className="akrBridgeLine">
                      Heat 0% | Stable
                    </p>
                    <MeterTrack id="pvpOverheatMeter" />
                    <p id="pvpOverheatHint" className="akrBridgeHint">
                      Queue ve latency burada izlenir.
                    </p>
                  </div>
                  <div className="pvpTheaterCell">
                    <p className="akrBridgeHint">Clutch Window</p>
                    <p id="pvpClutchLine" className="akrBridgeLine">
                      Window 0% | Resolve LOCK
                    </p>
                    <MeterTrack id="pvpClutchMeter" />
                    <p id="pvpClutchHint" className="akrBridgeHint">
                      Resolve penceresi burada akar.
                    </p>
                  </div>
                  <div className="pvpTheaterCell">
                    <p className="akrBridgeHint">Stance Pressure</p>
                    <p id="pvpStanceLine" className="akrBridgeLine">
                      STR 0 | GRD 0 | CHG 0
                    </p>
                    <MeterTrack id="pvpStanceMeter" />
                    <p id="pvpStanceHint" className="akrBridgeHint">
                      Duruş baskisi burada izlenir.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div id="combatHudPanel" className="combatHudPanel pressure-low">
              <div className="combatHudCell">
                <p className="akrBridgeHint">Action Chain</p>
                <p id="combatChainLine" className="akrBridgeLine">
                  CHAIN IDLE
                </p>
                <div id="combatChainTrail" className="akrChipRow akrPvpChipWrap">
                  <span className="replayChip muted">bekleniyor</span>
                </div>
              </div>

              <div className="combatHudCell">
                <p className="akrBridgeHint">Pulse Reactor</p>
                <p id="pulseReactorLine" className="akrBridgeLine">
                  NEXUS READY
                </p>
                <MeterTrack id="pulseReactorMeter" />
                <p id="pulseReactorHint" className="akrBridgeHint">
                  Reactor signal bekleniyor.
                </p>
                <p id="pulseStrategyLine" className="akrBridgeHint pulseStrategyLine">
                  Strategy guidance bekleniyor.
                </p>
              </div>

              <div className="combatHudCell combatTimelineCell">
                <div className="akrBridgeHeader">
                  <span id="combatTimelineBadge" className="badge info">
                    IDLE
                  </span>
                  <span className="akrBridgeHint">Timeline Director</span>
                </div>
                <p id="combatTimelineLine" className="akrBridgeLine">
                  Beklenen: AUTO | Son: CHAIN IDLE
                </p>
                <MeterTrack id="combatTimelineMeter" />
                <p id="combatTimelineHint" className="akrBridgeHint">
                  Timeline guidance bekleniyor.
                </p>
                <div className="akrChipRow akrPvpChipWrap pvpActionNodes">
                  <span id="combatTimelineNodeStrike" className="pvpLiveChip neutral">
                    STRIKE
                  </span>
                  <span id="combatTimelineNodeGuard" className="pvpLiveChip neutral">
                    GUARD
                  </span>
                  <span id="combatTimelineNodeCharge" className="pvpLiveChip neutral">
                    CHARGE
                  </span>
                </div>
              </div>

              <div className="combatHudCell combatFluxCell">
                <p className="akrBridgeHint">Score Flux</p>
                <p id="combatFluxLine" className="akrBridgeLine">
                  Score 0-0 | Delta 0
                </p>
                <p id="combatFluxHint" className="akrBridgeHint">
                  Flux telemetry bekleniyor.
                </p>
                <div className="matrixGrid">
                  <div className="matrixRow">
                    <span className="akrBridgeHint">SELF</span>
                    <MeterTrack id="combatFluxSelfMeter" />
                  </div>
                  <div className="matrixRow">
                    <span className="akrBridgeHint">OPP</span>
                    <MeterTrack id="combatFluxOppMeter" />
                  </div>
                  <div className="matrixRow">
                    <span className="akrBridgeHint">SYNC</span>
                    <MeterTrack id="combatFluxSyncMeter" />
                  </div>
                </div>
              </div>

              <div className="combatHudCell combatCadenceCell">
                <p className="akrBridgeHint">Action Cadence</p>
                <p id="combatCadenceLine" className="akrBridgeLine">
                  STR 0 | GRD 0 | CHG 0
                </p>
                <p id="combatCadenceHint" className="akrBridgeHint">
                  Cadence guidance bekleniyor.
                </p>
                <div className="matrixGrid">
                  <div className="matrixRow">
                    <span className="akrBridgeHint">STRIKE</span>
                    <MeterTrack id="combatCadenceStrikeMeter" />
                  </div>
                  <div className="matrixRow">
                    <span className="akrBridgeHint">GUARD</span>
                    <MeterTrack id="combatCadenceGuardMeter" />
                  </div>
                  <div className="matrixRow">
                    <span className="akrBridgeHint">CHARGE</span>
                    <MeterTrack id="combatCadenceChargeMeter" />
                  </div>
                </div>
              </div>

              <div className="combatHudCell">
                <p className="akrBridgeHint">Boss Pressure</p>
                <p id="bossPressureLine" className="akrBridgeLine" data-tone="stable">
                  STABLE | HP -- | TTL --
                </p>
                <MeterTrack id="bossPressureMeter" />
              </div>

              <div className="combatHudCell combatOverdriveCell">
                <p className="akrBridgeHint">Overdrive Core</p>
                <p id="combatOverdriveLine" className="akrBridgeLine" data-tone="steady">
                  HEAT 0% | THREAT 0% | PVP 0% | CAM 0%
                </p>
                <p id="combatOverdriveHint" className="akrBridgeHint" data-tone="steady">
                  Overdrive guidance bekleniyor.
                </p>
                <div className="matrixGrid">
                  <div className="matrixRow">
                    <span className="akrBridgeHint">HEAT</span>
                    <MeterTrack id="combatOverdriveHeatMeter" />
                  </div>
                  <div className="matrixRow">
                    <span className="akrBridgeHint">THREAT</span>
                    <MeterTrack id="combatOverdriveThreatMeter" />
                  </div>
                  <div className="matrixRow">
                    <span className="akrBridgeHint">PVP</span>
                    <MeterTrack id="combatOverdrivePvpMeter" />
                  </div>
                  <div className="matrixRow">
                    <span className="akrBridgeHint">CAM</span>
                    <MeterTrack id="combatOverdriveImpulseMeter" />
                  </div>
                </div>
              </div>

              <div className="combatHudCell combatReactorCell">
                <p className="akrBridgeHint">Matrix Reactor</p>
                <p id="combatMatrixLine" className="akrBridgeLine" data-tone="steady">
                  SYNC 0% | THERMAL 0% | SHIELD 0% | CLUTCH 0%
                </p>
                <p id="combatMatrixHint" className="akrBridgeHint" data-tone="steady">
                  Matrix guidance bekleniyor.
                </p>
                <div className="matrixGrid">
                  <div className="matrixRow">
                    <span className="akrBridgeHint">SYNC</span>
                    <MeterTrack id="combatMatrixSyncMeter" />
                  </div>
                  <div className="matrixRow">
                    <span className="akrBridgeHint">THERMAL</span>
                    <MeterTrack id="combatMatrixThermalMeter" />
                  </div>
                  <div className="matrixRow">
                    <span className="akrBridgeHint">SHIELD</span>
                    <MeterTrack id="combatMatrixShieldMeter" />
                  </div>
                  <div className="matrixRow">
                    <span className="akrBridgeHint">CLUTCH</span>
                    <MeterTrack id="combatMatrixClutchMeter" />
                  </div>
                </div>
              </div>

              <div className="combatHudCell">
                <p className="akrBridgeHint">Alert Rail</p>
                <div className="akrChipRow akrPvpChipWrap">
                  <span id="combatAlertPrimaryChip" className="combatAlertChip neutral">
                    FLOW HOLD
                  </span>
                  <span id="combatAlertSecondaryChip" className="combatAlertChip neutral">
                    SYNC
                  </span>
                  <span id="combatAlertTertiaryChip" className="combatAlertChip neutral">
                    ROUTE
                  </span>
                </div>
                <p id="combatAlertHint" className="akrBridgeHint">
                  Alert guidance bekleniyor.
                </p>
                <p id="combatLoopLine" className="akrBridgeHint">
                  Arena loop bekleniyor.
                </p>
                <p id="combatLoopHint" className="akrBridgeHint">
                  Scene loop focus bekleniyor.
                </p>
                <p id="combatLoopFocus" className="akrBridgeHint">
                  FLOW | WAIT
                </p>
                <p id="combatLoopOpsLine" className="akrBridgeHint">
                  WAIT | FLOW IDLE
                </p>
                <p id="combatLoopSequence" className="akrBridgeHint">
                  Sequence detay bekleniyor.
                </p>
                <p id="combatLoopState" className="akrBridgeHint">
                  IDLE | FLOW WAIT
                </p>
                <p id="combatLoopDetail" className="akrBridgeHint">
                  Loop detay bekleniyor.
                </p>
                <p id="combatLoopSignal" className="akrBridgeHint">
                  Signal detay bekleniyor.
                </p>
                <div id="combatLoopDuelPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
                  <p id="combatLoopDuel" className="akrBridgeHint">
                    DUEL | WAIT
                  </p>
                  <div id="combatLoopDuelCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopDuelBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopDuelFlowCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopDuelFlowBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopDuelFlowPanels" className="akrBridgeFlowPanels hidden" />
                  <div id="combatLoopDuelRiskCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopDuelRiskBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopDuelRiskPanels" className="akrBridgeFlowPanels hidden" />
                  <div id="combatLoopDuelSubflowCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopDuelSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopDuelSubflowPanels" className="akrBridgeFlowPanels hidden" />
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopDuelFamily" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopDuelFlow" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopDuelSummary" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopDuelGate" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopDuelLead" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopDuelWindow" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopDuelMicroflow" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopDuelPressure" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopDuelResponse" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <p id="combatLoopDuelFocus" className="akrBridgeHint">
                    ENTRY WAIT | FOCUS WAIT | PERSONA --
                  </p>
                  <p id="combatLoopDuelStage" className="akrBridgeHint">
                    STAGE -- | STATUS -- | FLOW WAIT
                  </p>
                  <p id="combatLoopDuelState" className="akrBridgeHint">
                    FLOW WAIT | ENTRY WAIT | PHASE --
                  </p>
                  <p id="combatLoopDuelOps" className="akrBridgeHint">
                    ENTRY WAIT | STATUS -- | QUEUE --
                  </p>
                  <p id="combatLoopDuelSignal" className="akrBridgeHint">
                    QUEUE -- | FLOW WAIT | RISK --
                  </p>
                  <p id="combatLoopDuelDetail" className="akrBridgeHint">
                    Queue ve sync detay bekleniyor.
                  </p>
                  <p id="combatLoopDuelAttention" className="akrBridgeHint">
                    ATTN -- 
                  </p>
                  <p id="combatLoopDuelCadence" className="akrBridgeHint">
                    CADENCE --
                  </p>
                </div>
                <div id="combatLoopLadderPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
                  <p id="combatLoopLadder" className="akrBridgeHint">
                    LADDER | WAIT
                  </p>
                  <div id="combatLoopLadderCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopLadderBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopLadderFlowCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopLadderFlowBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopLadderFlowPanels" className="akrBridgeFlowPanels hidden" />
                  <div id="combatLoopLadderRiskCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopLadderRiskBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopLadderRiskPanels" className="akrBridgeFlowPanels hidden" />
                  <div id="combatLoopLadderSubflowCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopLadderSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopLadderSubflowPanels" className="akrBridgeFlowPanels hidden" />
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopLadderFamily" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopLadderFlow" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopLadderSummary" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopLadderGate" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopLadderLead" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopLadderWindow" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopLadderMicroflow" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopLadderPressure" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopLadderResponse" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <p id="combatLoopLadderFocus" className="akrBridgeHint">
                    SEQ WAIT | FOCUS WAIT | FLOW WAIT
                  </p>
                  <p id="combatLoopLadderStage" className="akrBridgeHint">
                    STAGE -- | STATUS -- | FLOW WAIT
                  </p>
                  <p id="combatLoopLadderState" className="akrBridgeHint">
                    FLOW WAIT | SEQ WAIT | STAGE --
                  </p>
                  <p id="combatLoopLadderOps" className="akrBridgeHint">
                    SEQ WAIT | CHARGE -- | TICK --
                  </p>
                  <p id="combatLoopLadderSignal" className="akrBridgeHint">
                    CHARGE -- | TICK -- | FLOW WAIT
                  </p>
                  <p id="combatLoopLadderDetail" className="akrBridgeHint">
                    Ladder snapshot bekleniyor.
                  </p>
                  <p id="combatLoopLadderAttention" className="akrBridgeHint">
                    ATTN --
                  </p>
                  <p id="combatLoopLadderCadence" className="akrBridgeHint">
                    CADENCE --
                  </p>
                </div>
                <div id="combatLoopTelemetryPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
                  <p id="combatLoopTelemetry" className="akrBridgeHint">
                    TELEMETRY | WAIT
                  </p>
                  <div id="combatLoopTelemetryCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopTelemetryBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopTelemetryFlowCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopTelemetryFlowBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopTelemetryFlowPanels" className="akrBridgeFlowPanels hidden" />
                  <div id="combatLoopTelemetryRiskCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopTelemetryRiskBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopTelemetryRiskPanels" className="akrBridgeFlowPanels hidden" />
                  <div id="combatLoopTelemetrySubflowCards" className="akrBridgeFocusCards hidden" />
                  <div id="combatLoopTelemetrySubflowBlocks" className="akrBridgeFlowBlocks hidden" />
                  <div id="combatLoopTelemetrySubflowPanels" className="akrBridgeFlowPanels hidden" />
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopTelemetryFamily" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopTelemetryFlow" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopTelemetrySummary" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopTelemetryGate" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopTelemetryLead" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopTelemetryWindow" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopTelemetryMicroflow" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <div className="akrChipRow">
                    <BridgeChip id="combatLoopTelemetryPressure" className="combatAlertChip neutral tone-neutral" />
                    <BridgeChip id="combatLoopTelemetryResponse" className="combatAlertChip neutral tone-neutral" />
                  </div>
                  <p id="combatLoopTelemetryFocus" className="akrBridgeHint">
                    PERSONA WAIT | FOCUS -- | FLOW WAIT
                  </p>
                  <p id="combatLoopTelemetryStage" className="akrBridgeHint">
                    STAGE -- | STATUS -- | SEQ WAIT
                  </p>
                  <p id="combatLoopTelemetryState" className="akrBridgeHint">
                    FLOW WAIT | PERSONA WAIT | SEQ --
                  </p>
                  <p id="combatLoopTelemetryOps" className="akrBridgeHint">
                    PERSONA WAIT | DIAG -- | RISK --
                  </p>
                  <p id="combatLoopTelemetrySignal" className="akrBridgeHint">
                    DIAG -- | RISK -- | FLOW WAIT
                  </p>
                  <p id="combatLoopTelemetryDetail" className="akrBridgeHint">
                    Reject ve asset telemetry bekleniyor.
                  </p>
                  <p id="combatLoopTelemetryAttention" className="akrBridgeHint">
                    ATTN --
                  </p>
                  <p id="combatLoopTelemetryCadence" className="akrBridgeHint">
                    CADENCE --
                  </p>
                </div>
              </div>
            </div>

            <div className="akrBridgeStrip pvpTimelineBlock">
              <div className="akrBridgeHeader">
                <span className="akrBridgeHint">Tick Timeline</span>
                <span id="pvpTimelineBadge" className="badge info">
                  0 event
                </span>
              </div>
              <ul id="pvpTimelineList" className="pvpTimelineList">
                <li className="muted">Timeline bekleniyor</li>
              </ul>
              <div className="replayStripWrap">
                <p className="akrBridgeHint">Round Replay</p>
                <div id="pvpReplayStrip" className="pvpReplayStrip">
                  <span className="replayChip muted">Replay bos</span>
                </div>
              </div>
            </div>
          </div>
        </BridgeCard>
      ) : null}

      {props.tab === "tasks" ? (
        <BridgeCard title={t(props.lang, "scene_bridge_operations_title")}>
          <div className="akrSplit">
            <div className="akrBridgeStrip">
              <div className="akrBridgeHeader">
                <span id="offerBadge" className="badge info">
                  0 aktif
                </span>
              </div>
              <div id="offersList" className="akrBridgeList" />
            </div>
            <div className="akrBridgeStrip">
              <div className="akrBridgeHeader">
                <span id="missionBadge" className="badge info">
                  0 hazir
                </span>
              </div>
              <div id="missionsList" className="akrBridgeList" />
            </div>
          </div>
          <div className="akrSplit">
            <div className="akrBridgeStrip">
              <p className="akrBridgeLine">
                Active: <span id="activeAttempt">Yok</span>
              </p>
              <p className="akrBridgeLine">
                Reveal: <span id="revealAttempt">Yok</span>
              </p>
              <p id="tasksPulseLine" className="akrBridgeHint">
                Progress pulse bekleniyor.
              </p>
              <p id="tasksPulseHint" className="akrBridgeHint">
                Economy signal bekleniyor.
              </p>
              <div className="akrChipRow">
                <BridgeChip id="tasksPulseStreakChip" />
                <BridgeChip id="tasksPulseSeasonChip" />
                <BridgeChip id="tasksPulseEconomyChip" />
                <BridgeChip id="tasksPulseWalletChip" />
              </div>
            </div>
            <div className="akrBridgeStrip">
              <ul id="eventFeed" className="akrList akrBridgeList" />
            </div>
          </div>
          <div className="akrBridgeStrip">
            <p id="tasksLoopLine" className="akrBridgeHint">
              TASK STANDBY | WAIT
            </p>
            <p id="tasksLoopHint" className="akrBridgeHint">
              Scene loop focus bekleniyor.
            </p>
            <p id="tasksLoopFocus" className="akrBridgeHint">
              FLOW | WAIT
            </p>
            <p id="tasksLoopOps" className="akrBridgeHint">
              WAIT | FLOW IDLE
            </p>
            <p id="tasksLoopStatus" className="akrBridgeHint">
              IDLE | FLOW WAIT
            </p>
            <p id="tasksLoopSequence" className="akrBridgeHint">
              Sequence detay bekleniyor.
            </p>
            <p id="tasksLoopDetail" className="akrBridgeHint">
              Loop detay bekleniyor.
            </p>
            <p id="tasksLoopSignal" className="akrBridgeHint">
              Signal detay bekleniyor.
            </p>
            <div id="tasksLoopOfferPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
              <p id="tasksLoopOffer" className="akrBridgeHint">
                OFFER | WAIT
              </p>
              <div id="tasksLoopOfferCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopOfferBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopOfferFlowCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopOfferFlowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopOfferFlowPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tasksLoopOfferRiskCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopOfferRiskBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopOfferRiskPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tasksLoopOfferSubflowCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopOfferSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopOfferSubflowPanels" className="akrBridgeFlowPanels hidden" />
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopOfferFamily" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopOfferFlow" className="combatAlertChip neutral tone-neutral" />
              </div>
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopOfferSummary" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopOfferGate" className="combatAlertChip neutral tone-neutral" />
              </div>
                <div className="akrChipRow">
                  <BridgeChip id="tasksLoopOfferLead" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tasksLoopOfferWindow" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tasksLoopOfferMicroflow" className="combatAlertChip neutral tone-neutral" />
                </div>
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopOfferPressure" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopOfferResponse" className="combatAlertChip neutral tone-neutral" />
              </div>
              <p id="tasksLoopOfferFocus" className="akrBridgeHint">
                ENTRY WAIT | FOCUS WAIT | FLOW WAIT
              </p>
              <p id="tasksLoopOfferStage" className="akrBridgeHint">
                STAGE -- | STATUS -- | ENTRY WAIT
              </p>
              <p id="tasksLoopOfferState" className="akrBridgeHint">
                FLOW WAIT | ENTRY WAIT | OFFER --
              </p>
              <p id="tasksLoopOfferOps" className="akrBridgeHint">
                ENTRY WAIT | OFFER -- | BAND --
              </p>
              <p id="tasksLoopOfferSignal" className="akrBridgeHint">
                OFFER -- | BAND -- | FLOW WAIT
              </p>
              <p id="tasksLoopOfferDetail" className="akrBridgeHint">
                Offer grid detay bekleniyor.
              </p>
              <p id="tasksLoopOfferAttention" className="akrBridgeHint">
                ATTN --
              </p>
              <p id="tasksLoopOfferCadence" className="akrBridgeHint">
                CADENCE --
              </p>
            </div>
            <div id="tasksLoopClaimPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
              <p id="tasksLoopClaim" className="akrBridgeHint">
                CLAIM | WAIT
              </p>
              <div id="tasksLoopClaimCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopClaimBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopClaimFlowCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopClaimFlowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopClaimFlowPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tasksLoopClaimRiskCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopClaimRiskBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopClaimRiskPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tasksLoopClaimSubflowCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopClaimSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopClaimSubflowPanels" className="akrBridgeFlowPanels hidden" />
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopClaimFamily" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopClaimFlow" className="combatAlertChip neutral tone-neutral" />
              </div>
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopClaimSummary" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopClaimGate" className="combatAlertChip neutral tone-neutral" />
              </div>
                <div className="akrChipRow">
                  <BridgeChip id="tasksLoopClaimLead" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tasksLoopClaimWindow" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tasksLoopClaimMicroflow" className="combatAlertChip neutral tone-neutral" />
                </div>
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopClaimPressure" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopClaimResponse" className="combatAlertChip neutral tone-neutral" />
              </div>
              <p id="tasksLoopClaimFocus" className="akrBridgeHint">
                SEQ WAIT | FOCUS WAIT | STAGE --
              </p>
              <p id="tasksLoopClaimStage" className="akrBridgeHint">
                STAGE -- | STATUS -- | SEQ WAIT
              </p>
              <p id="tasksLoopClaimState" className="akrBridgeHint">
                FLOW WAIT | SEQ WAIT | CLAIM --
              </p>
              <p id="tasksLoopClaimOps" className="akrBridgeHint">
                SEQ WAIT | CLAIM -- | BAND --
              </p>
              <p id="tasksLoopClaimSignal" className="akrBridgeHint">
                CLAIM -- | STAGE -- | FLOW WAIT
              </p>
              <p id="tasksLoopClaimDetail" className="akrBridgeHint">
                Claim lane detay bekleniyor.
              </p>
              <p id="tasksLoopClaimAttention" className="akrBridgeHint">
                ATTN --
              </p>
              <p id="tasksLoopClaimCadence" className="akrBridgeHint">
                CADENCE --
              </p>
            </div>
            <div id="tasksLoopStreakPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
              <p id="tasksLoopStreak" className="akrBridgeHint">
                STREAK | WAIT
              </p>
              <div id="tasksLoopStreakCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopStreakBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopStreakFlowCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopStreakFlowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopStreakFlowPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tasksLoopStreakRiskCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopStreakRiskBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopStreakRiskPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tasksLoopStreakSubflowCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopStreakSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopStreakSubflowPanels" className="akrBridgeFlowPanels hidden" />
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopStreakFamily" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopStreakFlow" className="combatAlertChip neutral tone-neutral" />
              </div>
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopStreakSummary" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopStreakGate" className="combatAlertChip neutral tone-neutral" />
              </div>
                <div className="akrChipRow">
                  <BridgeChip id="tasksLoopStreakLead" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tasksLoopStreakWindow" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tasksLoopStreakMicroflow" className="combatAlertChip neutral tone-neutral" />
                </div>
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopStreakPressure" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopStreakResponse" className="combatAlertChip neutral tone-neutral" />
              </div>
              <p id="tasksLoopStreakFocus" className="akrBridgeHint">
                PERSONA WAIT | FOCUS WAIT | FLOW WAIT
              </p>
              <p id="tasksLoopStreakStage" className="akrBridgeHint">
                STAGE -- | STATUS -- | PERSONA WAIT
              </p>
              <p id="tasksLoopStreakState" className="akrBridgeHint">
                FLOW WAIT | PERSONA WAIT | STREAK --
              </p>
              <p id="tasksLoopStreakOps" className="akrBridgeHint">
                PERSONA WAIT | STREAK -- | OFFER --
              </p>
              <p id="tasksLoopStreakSignal" className="akrBridgeHint">
                STREAK -- | OFFER -- | FLOW WAIT
              </p>
              <p id="tasksLoopStreakDetail" className="akrBridgeHint">
                Streak pulse detay bekleniyor.
              </p>
              <p id="tasksLoopStreakAttention" className="akrBridgeHint">
                ATTN --
              </p>
              <p id="tasksLoopStreakCadence" className="akrBridgeHint">
                CADENCE --
              </p>
            </div>
            <div id="tasksLoopLootPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
              <p id="tasksLoopLoot" className="akrBridgeHint">
                LOOT | WAIT
              </p>
              <div id="tasksLoopLootCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopLootBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopLootFlowCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopLootFlowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopLootFlowPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tasksLoopLootRiskCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopLootRiskBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopLootRiskPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tasksLoopLootSubflowCards" className="akrBridgeFocusCards hidden" />
              <div id="tasksLoopLootSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tasksLoopLootSubflowPanels" className="akrBridgeFlowPanels hidden" />
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopLootFamily" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopLootFlow" className="combatAlertChip neutral tone-neutral" />
              </div>
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopLootSummary" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopLootGate" className="combatAlertChip neutral tone-neutral" />
              </div>
                <div className="akrChipRow">
                  <BridgeChip id="tasksLoopLootLead" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tasksLoopLootWindow" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tasksLoopLootMicroflow" className="combatAlertChip neutral tone-neutral" />
                </div>
              <div className="akrChipRow">
                <BridgeChip id="tasksLoopLootPressure" className="combatAlertChip neutral tone-neutral" />
                <BridgeChip id="tasksLoopLootResponse" className="combatAlertChip neutral tone-neutral" />
              </div>
              <p id="tasksLoopLootFocus" className="akrBridgeHint">
                ENTRY WAIT | FOCUS WAIT | FLOW WAIT
              </p>
              <p id="tasksLoopLootStage" className="akrBridgeHint">
                STAGE -- | STATUS -- | CLAIM --
              </p>
              <p id="tasksLoopLootState" className="akrBridgeHint">
                FLOW WAIT | CLAIM -- | BAND --
              </p>
              <p id="tasksLoopLootOps" className="akrBridgeHint">
                ENTRY WAIT | CLAIM -- | BAND --
              </p>
              <p id="tasksLoopLootSignal" className="akrBridgeHint">
                CLAIM -- | BAND -- | FLOW WAIT
              </p>
              <p id="tasksLoopLootDetail" className="akrBridgeHint">
                Loot reveal detay bekleniyor.
              </p>
              <p id="tasksLoopLootAttention" className="akrBridgeHint">
                ATTN --
              </p>
              <p id="tasksLoopLootCadence" className="akrBridgeHint">
                CADENCE --
              </p>
            </div>
          </div>
        </BridgeCard>
      ) : null}

      {props.tab === "vault" ? (
        <BridgeCard title={t(props.lang, "scene_bridge_vault_title")}>
          <div className="akrSplit">
            <div className="akrBridgeStrip">
              <div className="akrBridgeHeader">
                <span id="tokenBadge" className="badge info">
                  NXT
                </span>
              </div>
              <p className="akrBridgeLine" id="balToken">
                0.0000
              </p>
              <p className="akrBridgeHint" id="tokenSummary">
                0.0000 NXT
              </p>
              <p className="akrBridgeHint" id="tokenRate">
                -
              </p>
              <p className="akrBridgeHint" id="tokenMintable">
                -
              </p>
              <p className="akrBridgeHint" id="tokenUnits">
                -
              </p>
              <p className="akrBridgeHint" id="tokenHint">
                -
              </p>
              <p className="akrBridgeHint" id="tokenLoopLine">
                -
              </p>
              <p className="akrBridgeHint" id="tokenLoopHint">
                -
              </p>
              <p className="akrBridgeHint" id="tokenLoopFocus">
                -
              </p>
              <p className="akrBridgeHint" id="tokenLoopOpsLine">
                -
              </p>
              <p className="akrBridgeHint" id="tokenLoopOpsHint">
                -
              </p>
              <p className="akrBridgeHint" id="tokenLoopSequence">
                -
              </p>
              <p className="akrBridgeHint" id="tokenLoopState">
                -
              </p>
              <p className="akrBridgeHint" id="tokenLoopDetail">
                -
              </p>
              <p className="akrBridgeHint" id="tokenLoopSignal">
                -
              </p>
              <div id="tokenLoopWalletPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
                <p className="akrBridgeHint" id="tokenLoopWallet">
                  -
                </p>
                <div id="tokenLoopWalletCards" className="akrBridgeFocusCards hidden" />
                <div id="tokenLoopWalletBlocks" className="akrBridgeFlowBlocks hidden" />
                <div id="tokenLoopWalletFlowCards" className="akrBridgeFocusCards hidden" />
                <div id="tokenLoopWalletFlowBlocks" className="akrBridgeFlowBlocks hidden" />
                <div id="tokenLoopWalletFlowPanels" className="akrBridgeFlowPanels hidden" />
                <div id="tokenLoopWalletRiskCards" className="akrBridgeFocusCards hidden" />
                <div id="tokenLoopWalletRiskBlocks" className="akrBridgeFlowBlocks hidden" />
                <div id="tokenLoopWalletRiskPanels" className="akrBridgeFlowPanels hidden" />
                <div id="tokenLoopWalletSubflowCards" className="akrBridgeFocusCards hidden" />
                <div id="tokenLoopWalletSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
                <div id="tokenLoopWalletSubflowPanels" className="akrBridgeFlowPanels hidden" />
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopWalletFamily" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopWalletFlow" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopWalletSummary" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopWalletGate" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopWalletLead" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopWalletWindow" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopWalletMicroflow" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopWalletPressure" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopWalletResponse" className="combatAlertChip neutral tone-neutral" />
                </div>
                <p className="akrBridgeHint" id="tokenLoopWalletFocus">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopWalletStage">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopWalletState">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopWalletOps">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopWalletSignal">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopWalletDetail">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopWalletAttention">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopWalletCadence">
                  -
                </p>
              </div>
              <div id="tokenLoopPayoutPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
                <p className="akrBridgeHint" id="tokenLoopPayout">
                  -
                </p>
              <div id="tokenLoopPayoutCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopPayoutBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopPayoutFlowCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopPayoutFlowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopPayoutFlowPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tokenLoopPayoutRiskCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopPayoutRiskBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopPayoutRiskPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tokenLoopPayoutSubflowCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopPayoutSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopPayoutSubflowPanels" className="akrBridgeFlowPanels hidden" />
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopPayoutFamily" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopPayoutFlow" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopPayoutSummary" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopPayoutGate" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopPayoutLead" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopPayoutWindow" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopPayoutMicroflow" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopPayoutPressure" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopPayoutResponse" className="combatAlertChip neutral tone-neutral" />
                </div>
                <p className="akrBridgeHint" id="tokenLoopPayoutFocus">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPayoutStage">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPayoutState">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPayoutOps">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPayoutSignal">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPayoutDetail">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPayoutAttention">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPayoutCadence">
                  -
                </p>
              </div>
              <div id="tokenLoopRoutePanel" className="akrBridgeFamilyPanel" data-tone="neutral">
                <p className="akrBridgeHint" id="tokenLoopRoute">
                  -
                </p>
              <div id="tokenLoopRouteCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopRouteBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopRouteFlowCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopRouteFlowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopRouteFlowPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tokenLoopRouteRiskCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopRouteRiskBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopRouteRiskPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tokenLoopRouteSubflowCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopRouteSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopRouteSubflowPanels" className="akrBridgeFlowPanels hidden" />
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopRouteFamily" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopRouteFlow" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopRouteSummary" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopRouteGate" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopRouteLead" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopRouteWindow" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopRouteMicroflow" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopRoutePressure" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopRouteResponse" className="combatAlertChip neutral tone-neutral" />
                </div>
                <p className="akrBridgeHint" id="tokenLoopRouteFocus">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopRouteStage">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopRouteState">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopRouteOps">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopRouteSignal">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopRouteDetail">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopRouteAttention">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopRouteCadence">
                  -
                </p>
              </div>
              <div id="tokenLoopPremiumPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
                <p className="akrBridgeHint" id="tokenLoopPremium">
                  -
                </p>
              <div id="tokenLoopPremiumCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopPremiumBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopPremiumFlowCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopPremiumFlowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopPremiumFlowPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tokenLoopPremiumRiskCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopPremiumRiskBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopPremiumRiskPanels" className="akrBridgeFlowPanels hidden" />
              <div id="tokenLoopPremiumSubflowCards" className="akrBridgeFocusCards hidden" />
              <div id="tokenLoopPremiumSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="tokenLoopPremiumSubflowPanels" className="akrBridgeFlowPanels hidden" />
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopPremiumFamily" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopPremiumFlow" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopPremiumSummary" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopPremiumGate" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopPremiumLead" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopPremiumWindow" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopPremiumMicroflow" className="combatAlertChip neutral tone-neutral" />
                </div>
                <div className="akrChipRow">
                  <BridgeChip id="tokenLoopPremiumPressure" className="combatAlertChip neutral tone-neutral" />
                  <BridgeChip id="tokenLoopPremiumResponse" className="combatAlertChip neutral tone-neutral" />
                </div>
                <p className="akrBridgeHint" id="tokenLoopPremiumFocus">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPremiumStage">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPremiumState">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPremiumOps">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPremiumSignal">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPremiumDetail">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPremiumAttention">
                  -
                </p>
                <p className="akrBridgeHint" id="tokenLoopPremiumCadence">
                  -
                </p>
              </div>
              <div className="akrChipRow">
                <BridgeChip id="tokenWalletChip" />
                <BridgeChip id="tokenPayoutChip" />
                <BridgeChip id="tokenPremiumChip" />
                <BridgeChip id="tokenRouteSummaryChip" />
              </div>
              <select id="tokenChainSelect" className="akrBridgeSelect" disabled aria-label="token-chain-readonly" />
              <button id="tokenBuyBtn" type="button" className="btn accent">
                Buy Intent
              </button>
            </div>

            <div className="akrBridgeStrip" id="tokenTreasuryPulseStrip" data-tone="neutral">
              <div className="akrBridgeHeader">
                <span id="treasuryStateBadge" className="badge info">
                  TREASURY
                </span>
              </div>
              <p id="treasuryStateLine" className="akrBridgeLine">
                -
              </p>
              <p id="tokenGateLine" className="akrBridgeHint">
                -
              </p>
              <p id="tokenCurveLine" className="akrBridgeHint">
                -
              </p>
              <p id="tokenQuorumLine" className="akrBridgeHint">
                -
              </p>
              <p id="tokenPolicyLine" className="akrBridgeHint">
                -
              </p>
              <MeterTrack id="treasuryPulseRouteMeter" />
              <MeterTrack id="treasuryPulseVerifyMeter" />
              <MeterTrack id="treasuryPulseRiskMeter" />
              <div className="akrChipRow">
                <BridgeChip id="treasuryPulseGateChip" />
                <BridgeChip id="treasuryPulseRouteChip" />
                <BridgeChip id="treasuryPulseApiChip" />
                <BridgeChip id="treasuryPulseQueueChip" />
                <BridgeChip id="treasuryPulsePolicyChip" />
              </div>
            </div>
          </div>

          <div className="akrSplit">
            <div id="tokenRouteRuntimeStrip" className="akrBridgeStrip" data-tone="neutral">
              <div className="akrBridgeHeader">
                <span id="tokenRouteBadge" className="badge info">
                  ROUTE
                </span>
              </div>
              <p id="tokenRouteLine" className="akrBridgeLine">
                -
              </p>
              <MeterTrack id="tokenRouteCoverageMeter" />
              <MeterTrack id="tokenRouteQuorumMeter" />
              <div className="akrChipRow">
                <BridgeChip id="tokenRouteGateChip" />
                <BridgeChip id="tokenRouteCoverageChip" />
                <BridgeChip id="tokenRouteQuorumChip" />
                <BridgeChip id="tokenRouteChainChip" />
              </div>
              <ul id="tokenRouteList" className="akrList akrBridgeList" />
            </div>

            <div id="tokenTxLifecycleStrip" className="akrBridgeStrip" data-tone="neutral">
              <div className="akrBridgeHeader">
                <span id="tokenTxLifecycleBadge" className="badge info">
                  IDLE
                </span>
              </div>
              <p id="tokenTxLifecycleLine" className="akrBridgeLine">
                -
              </p>
              <p id="tokenTxLifecycleSignalLine" className="akrBridgeHint">
                -
              </p>
              <MeterTrack id="tokenTxLifecycleProgressMeter" />
              <MeterTrack id="tokenTxLifecycleVerifyMeter" />
              <div className="akrChipRow">
                <BridgeChip id="tokenTxLifecycleVerifyChip" />
                <BridgeChip id="tokenTxLifecycleProviderChip" />
                <BridgeChip id="tokenTxLifecycleStatusChip" />
              </div>
              <ul id="tokenTxLifecycleList" className="akrList akrBridgeList" />
            </div>
          </div>

          <div id="tokenActionDirectorStrip" className="akrBridgeStrip" data-tone="neutral">
            <div className="akrBridgeHeader">
              <span id="tokenActionDirectorBadge" className="badge info">
                QUOTE
              </span>
            </div>
            <p id="tokenActionDirectorLine" className="akrBridgeLine">
              -
            </p>
            <p id="tokenActionDirectorStepLine" className="akrBridgeHint">
              -
            </p>
            <MeterTrack id="tokenActionDirectorReadyMeter" />
            <MeterTrack id="tokenActionDirectorRiskMeter" />
            <div className="akrChipRow">
              <BridgeChip id="tokenActionDirectorReadyChip" />
              <BridgeChip id="tokenActionDirectorRiskChip" />
              <BridgeChip id="tokenActionDirectorQueueChip" />
            </div>
            <ul id="tokenActionDirectorList" className="akrList akrBridgeList" />
          </div>
        </BridgeCard>
      ) : null}
    </>
  );
}

function AdminBridgeCards(props: { lang: Lang }) {
  return (
    <>
      <BridgeCard title={t(props.lang, "scene_bridge_admin_runtime_title")}>
        <div className="akrBridgeStrip">
          <p id="adminRuntimeLine" className="akrBridgeLine">
            -
          </p>
          <p id="adminRuntimeEvents" className="akrBridgeHint">
            -
          </p>
          <p id="adminRuntimeLoopLine" className="akrBridgeHint">
            -
          </p>
          <p id="adminRuntimeLoopHint" className="akrBridgeHint">
            -
          </p>
          <p id="adminRuntimeLoopFocus" className="akrBridgeHint">
            -
          </p>
          <p id="adminRuntimeLoopOpsLine" className="akrBridgeHint">
            -
          </p>
          <p id="adminRuntimeLoopOpsHint" className="akrBridgeHint">
            -
          </p>
          <p id="adminRuntimeLoopSequence" className="akrBridgeHint">
            -
          </p>
          <p id="adminRuntimeLoopState" className="akrBridgeHint">
            -
          </p>
          <p id="adminRuntimeLoopDetail" className="akrBridgeHint">
            -
          </p>
          <p id="adminRuntimeLoopSignal" className="akrBridgeHint">
            -
          </p>
          <div id="adminRuntimeLoopQueuePanel" className="akrBridgeFamilyPanel" data-tone="neutral">
            <p id="adminRuntimeLoopQueue" className="akrBridgeHint">
              -
            </p>
              <div id="adminRuntimeLoopQueueCards" className="akrBridgeFocusCards hidden" />
              <div id="adminRuntimeLoopQueueBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="adminRuntimeLoopQueueFlowCards" className="akrBridgeFocusCards hidden" />
              <div id="adminRuntimeLoopQueueFlowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="adminRuntimeLoopQueueFlowPanels" className="akrBridgeFlowPanels hidden" />
              <div id="adminRuntimeLoopQueueRiskCards" className="akrBridgeFocusCards hidden" />
              <div id="adminRuntimeLoopQueueRiskBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="adminRuntimeLoopQueueRiskPanels" className="akrBridgeFlowPanels hidden" />
              <div id="adminRuntimeLoopQueueSubflowCards" className="akrBridgeFocusCards hidden" />
              <div id="adminRuntimeLoopQueueSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="adminRuntimeLoopQueueSubflowPanels" className="akrBridgeFlowPanels hidden" />
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopQueueFamily" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopQueueFlow" className="combatAlertChip neutral tone-neutral" />
            </div>
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopQueueSummary" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopQueueGate" className="combatAlertChip neutral tone-neutral" />
            </div>
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopQueueLead" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopQueueWindow" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopQueueMicroflow" className="combatAlertChip neutral tone-neutral" />
            </div>
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopQueuePressure" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopQueueResponse" className="combatAlertChip neutral tone-neutral" />
            </div>
            <p id="adminRuntimeLoopQueueFocus" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopQueueStage" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopQueueState" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopQueueOps" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopQueueSignal" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopQueueDetail" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopQueueAttention" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopQueueCadence" className="akrBridgeHint">
              -
            </p>
          </div>
          <div id="adminRuntimeLoopRuntimePanel" className="akrBridgeFamilyPanel" data-tone="neutral">
            <p id="adminRuntimeLoopRuntime" className="akrBridgeHint">
              -
            </p>
              <div id="adminRuntimeLoopRuntimeCards" className="akrBridgeFocusCards hidden" />
              <div id="adminRuntimeLoopRuntimeBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="adminRuntimeLoopRuntimeFlowCards" className="akrBridgeFocusCards hidden" />
              <div id="adminRuntimeLoopRuntimeFlowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="adminRuntimeLoopRuntimeFlowPanels" className="akrBridgeFlowPanels hidden" />
              <div id="adminRuntimeLoopRuntimeRiskCards" className="akrBridgeFocusCards hidden" />
              <div id="adminRuntimeLoopRuntimeRiskBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="adminRuntimeLoopRuntimeRiskPanels" className="akrBridgeFlowPanels hidden" />
              <div id="adminRuntimeLoopRuntimeSubflowCards" className="akrBridgeFocusCards hidden" />
              <div id="adminRuntimeLoopRuntimeSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
              <div id="adminRuntimeLoopRuntimeSubflowPanels" className="akrBridgeFlowPanels hidden" />
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopRuntimeFamily" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopRuntimeFlow" className="combatAlertChip neutral tone-neutral" />
            </div>
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopRuntimeSummary" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopRuntimeGate" className="combatAlertChip neutral tone-neutral" />
            </div>
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopRuntimeLead" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopRuntimeWindow" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopRuntimeMicroflow" className="combatAlertChip neutral tone-neutral" />
            </div>
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopRuntimePressure" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopRuntimeResponse" className="combatAlertChip neutral tone-neutral" />
            </div>
            <p id="adminRuntimeLoopRuntimeFocus" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopRuntimeStage" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopRuntimeState" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopRuntimeOps" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopRuntimeSignal" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopRuntimeDetail" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopRuntimeAttention" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopRuntimeCadence" className="akrBridgeHint">
              -
            </p>
          </div>
          <div id="adminRuntimeLoopDispatchPanel" className="akrBridgeFamilyPanel" data-tone="neutral">
            <p id="adminRuntimeLoopDispatch" className="akrBridgeHint">
              -
            </p>
            <div id="adminRuntimeLoopDispatchCards" className="akrBridgeFocusCards hidden" />
            <div id="adminRuntimeLoopDispatchBlocks" className="akrBridgeFlowBlocks hidden" />
            <div id="adminRuntimeLoopDispatchFlowCards" className="akrBridgeFocusCards hidden" />
            <div id="adminRuntimeLoopDispatchFlowBlocks" className="akrBridgeFlowBlocks hidden" />
            <div id="adminRuntimeLoopDispatchFlowPanels" className="akrBridgeFlowPanels hidden" />
            <div id="adminRuntimeLoopDispatchRiskCards" className="akrBridgeFocusCards hidden" />
            <div id="adminRuntimeLoopDispatchRiskBlocks" className="akrBridgeFlowBlocks hidden" />
            <div id="adminRuntimeLoopDispatchRiskPanels" className="akrBridgeFlowPanels hidden" />
            <div id="adminRuntimeLoopDispatchSubflowCards" className="akrBridgeFocusCards hidden" />
            <div id="adminRuntimeLoopDispatchSubflowBlocks" className="akrBridgeFlowBlocks hidden" />
            <div id="adminRuntimeLoopDispatchSubflowPanels" className="akrBridgeFlowPanels hidden" />
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopDispatchFamily" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopDispatchFlow" className="combatAlertChip neutral tone-neutral" />
            </div>
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopDispatchSummary" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopDispatchGate" className="combatAlertChip neutral tone-neutral" />
            </div>
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopDispatchLead" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopDispatchWindow" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopDispatchMicroflow" className="combatAlertChip neutral tone-neutral" />
            </div>
            <div className="akrChipRow">
              <BridgeChip id="adminRuntimeLoopDispatchPressure" className="combatAlertChip neutral tone-neutral" />
              <BridgeChip id="adminRuntimeLoopDispatchResponse" className="combatAlertChip neutral tone-neutral" />
            </div>
            <p id="adminRuntimeLoopDispatchFocus" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopDispatchStage" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopDispatchState" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopDispatchOps" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopDispatchSignal" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopDispatchDetail" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopDispatchAttention" className="akrBridgeHint">
              -
            </p>
            <p id="adminRuntimeLoopDispatchCadence" className="akrBridgeHint">
              -
            </p>
          </div>
        </div>
      </BridgeCard>

      <BridgeCard title={t(props.lang, "scene_bridge_admin_assets_title")}>
        <div className="akrSplit">
          <div className="akrBridgeStrip">
            <p id="adminAssetSummary" className="akrBridgeLine">
              -
            </p>
            <p id="adminManifestRevision" className="akrBridgeHint">
              -
            </p>
            <ul id="adminAssetList" className="akrList akrBridgeList" />
          </div>
          <div id="adminAssetRuntimeStrip" className="akrBridgeStrip" data-tone="neutral">
            <p id="adminAssetSignalLine" className="akrBridgeLine">
              -
            </p>
            <MeterTrack id="adminAssetReadyMeter" />
            <MeterTrack id="adminAssetSyncMeter" />
            <div className="akrChipRow">
              <BridgeChip id="adminAssetReadyChip" />
              <BridgeChip id="adminAssetSyncChip" />
              <BridgeChip id="adminAssetDistrictChip" />
              <BridgeChip id="adminAssetRevisionChip" />
            </div>
          </div>
        </div>
      </BridgeCard>

      <BridgeCard title={t(props.lang, "scene_bridge_admin_audit_title")}>
        <div id="adminAuditRuntimeStrip" className="akrBridgeStrip" data-tone="neutral">
          <div className="akrBridgeHeader">
            <span id="adminAuditPhaseChip" className="badge info">
              PHASE
            </span>
          </div>
          <p id="adminAuditSignalLine" className="akrBridgeLine">
            -
          </p>
          <p id="adminAuditHintLine" className="akrBridgeHint">
            -
          </p>
          <MeterTrack id="adminAuditHealthMeter" />
          <MeterTrack id="adminAuditTruthMeter" />
          <div className="akrChipRow">
            <BridgeChip id="adminAuditBundleChip" />
            <BridgeChip id="adminAuditRuntimeChip" />
            <BridgeChip id="adminAuditAssetChip" />
            <BridgeChip id="adminAuditTreasuryChip" />
          </div>
        </div>
      </BridgeCard>
    </>
  );
}

export function SceneBridgeDock(props: SceneBridgeDockProps) {
  if (!props.advanced && props.workspace !== "admin") {
    return null;
  }

  return (
    <section className="akrPanelGrid akrBridgeDock" data-workspace={props.workspace} data-tab={props.tab}>
      <section className="akrCard akrCardWide akrBridgeIntro">
        <p className="akrKicker">{t(props.lang, "scene_bridge_title")}</p>
        <p className="akrMuted">{t(props.lang, "scene_bridge_body")}</p>
      </section>
      {props.workspace === "player" ? <PlayerBridgeCards lang={props.lang} tab={props.tab} /> : null}
      {props.workspace === "admin" ? <AdminBridgeCards lang={props.lang} /> : null}
    </section>
  );
}
