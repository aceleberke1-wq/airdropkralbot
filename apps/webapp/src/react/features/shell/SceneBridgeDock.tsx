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
            </div>
            <div className="akrBridgeStrip">
              <ul id="eventFeed" className="akrList akrBridgeList" />
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
