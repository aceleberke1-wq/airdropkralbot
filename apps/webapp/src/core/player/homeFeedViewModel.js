import * as playerCommandNavigation from "../shared/playerCommandNavigation.js";
import * as playerSurfaceActionCatalog from "../shared/playerSurfaceActionCatalog.js";

const { resolvePlayerCommandActionKey, resolvePlayerCommandNavigation } = playerCommandNavigation;
const { buildPlayerSurfaceActions } = playerSurfaceActionCatalog;

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function toBool(value) {
  return Boolean(value);
}

function normalizeActionRef(row) {
  const item = asRecord(row);
  return {
    slot_key: toText(item.slot_key || item.slotKey || ""),
    action_key: toText(item.action_key || item.shell_action_key || ""),
    shell_action_key: toText(item.shell_action_key || item.action_key || ""),
    route_key: toText(item.route_key || ""),
    panel_key: toText(item.panel_key || ""),
    focus_key: toText(item.focus_key || ""),
    tab: toText(item.tab || "")
  };
}

function normalizeSurfaceActions(source = {}) {
  const payload = asRecord(source);
  return Object.fromEntries(
    Object.entries(payload).map(([sectionKey, rows]) => [
      String(sectionKey || "").trim().toLowerCase(),
      asArray(rows)
        .map((row) => normalizeActionRef(row))
        .filter((row) => row.slot_key && row.action_key)
    ])
  );
}

export function buildHomeFeedViewModel(input = {}) {
  const homeFeed = asRecord(input.homeFeed);
  const bootstrap = asRecord(input.bootstrap);
  const profile = asRecord(homeFeed.profile || bootstrap.profile);
  const season = asRecord(homeFeed.season || bootstrap.season);
  const daily = asRecord(homeFeed.daily || bootstrap.daily);
  const mission = asRecord(homeFeed.mission || bootstrap.missions);
  const walletQuick = asRecord(homeFeed.wallet_quick || bootstrap.wallet_session);
  const monetizationQuick = asRecord(homeFeed.monetization_quick || bootstrap.monetization);
  const spendSummary = asRecord(monetizationQuick.spend_summary);
  const balances = asRecord(bootstrap.balances);
  const surfaceActionsSource = Object.keys(asRecord(homeFeed.surface_actions)).length
    ? asRecord(homeFeed.surface_actions)
    : buildPlayerSurfaceActions();
  const surfaceActions = normalizeSurfaceActions(surfaceActionsSource);
  const commandHintSource = asArray(homeFeed.command_hint).length
    ? asArray(homeFeed.command_hint)
    : asArray(bootstrap.command_catalog).slice(0, 6).map((row) => ({
        key: String(asRecord(row).key || ""),
        description: String(asRecord(row).description || asRecord(row).description_tr || asRecord(row).description_en || ""),
        action_key: String(resolvePlayerCommandActionKey(asRecord(row).key || "") || ""),
        shell_action_key: String(resolvePlayerCommandActionKey(asRecord(row).key || "") || ""),
        ...(() => {
          const target = resolvePlayerCommandNavigation(asRecord(row).key || "");
          return target
            ? {
                route_key: String(target.route_key || ""),
                panel_key: String(target.panel_key || ""),
                focus_key: String(target.focus_key || ""),
                tab: String(target.tab || "")
              }
            : {};
        })()
      }));
  const commandHints = commandHintSource.slice(0, 6).map((row) => {
    const item = asRecord(row);
    const fallbackTarget = resolvePlayerCommandNavigation(item.key || "");
    const fallbackActionKey = resolvePlayerCommandActionKey(item.key || "");
    return {
      key: toText(item.key || "cmd"),
      description: toText(item.description || item.title || ""),
      action_key: toText(item.action_key || item.shell_action_key || fallbackActionKey || ""),
      shell_action_key: toText(item.shell_action_key || item.action_key || fallbackActionKey || ""),
      route_key: toText(item.route_key || fallbackTarget?.route_key || ""),
      panel_key: toText(item.panel_key || fallbackTarget?.panel_key || ""),
      focus_key: toText(item.focus_key || fallbackTarget?.focus_key || ""),
      tab: toText(item.tab || fallbackTarget?.tab || "")
    };
  });
  const missionPreview = asArray(mission.list_preview || mission.list).slice(0, 6).map((row) => {
    const item = asRecord(row);
    return {
      mission_key: toText(item.mission_key || item.key || ""),
      title: toText(item.title || item.title_tr || item.title_en || item.mission_key || item.key || ""),
      completed: toBool(item.completed),
      claimed: toBool(item.claimed)
    };
  });

  const tasksDone = Math.max(0, toNum(daily.tasks_done || 0));
  const dailyCap = Math.max(0, toNum(daily.daily_cap || 0));
  const taskFillPct = dailyCap > 0 ? Math.min(100, Math.round((tasksDone / dailyCap) * 100)) : 0;

  return {
    summary: {
      player_name: toText(profile.public_name || "", "unknown"),
      kingdom_tier: Math.max(0, toNum(profile.kingdom_tier || 0)),
      streak: Math.max(0, toNum(profile.current_streak || 0)),
      season_id: Math.max(0, toNum(season.season_id || 0)),
      season_days_left: Math.max(0, toNum(season.days_left || 0)),
      season_points: Math.max(0, toNum(season.points || 0)),
      tasks_done: tasksDone,
      daily_cap: dailyCap,
      task_fill_pct: taskFillPct,
      sc_earned: Math.max(0, toNum(daily.sc_earned || balances.SC || 0)),
      rc_earned: Math.max(0, toNum(daily.rc_earned || balances.RC || 0)),
      hc_earned: Math.max(0, toNum(daily.hc_earned || balances.HC || 0)),
      mission_total: Math.max(0, toNum(mission.total || missionPreview.length || 0)),
      mission_ready: Math.max(0, toNum(mission.ready || 0)),
      mission_open: Math.max(0, toNum(mission.open || 0)),
      wallet_active: toBool(walletQuick.active),
      wallet_chain: toText(walletQuick.chain || ""),
      wallet_address_masked: toText(walletQuick.address_masked || walletQuick.address || ""),
      wallet_kyc_status: toText(walletQuick.kyc_status || "unknown"),
      monetization_enabled: toBool(monetizationQuick.enabled),
      premium_active: toBool(monetizationQuick.premium_active),
      active_pass_count: Math.max(0, toNum(monetizationQuick.active_pass_count || 0)),
      spend_sc: Math.max(0, toNum(spendSummary.SC || spendSummary.sc || 0)),
      spend_hc: Math.max(0, toNum(spendSummary.HC || spendSummary.hc || 0)),
      spend_rc: Math.max(0, toNum(spendSummary.RC || spendSummary.rc || 0))
    },
    mission_preview: missionPreview,
    surface_actions: surfaceActions,
    command_hints: commandHints,
    has_data: Boolean(Object.keys(homeFeed).length || Object.keys(bootstrap).length)
  };
}
