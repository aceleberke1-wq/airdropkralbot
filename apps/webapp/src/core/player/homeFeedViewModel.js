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
  const commandHintSource = asArray(homeFeed.command_hint).length
    ? asArray(homeFeed.command_hint)
    : asArray(bootstrap.command_catalog).slice(0, 6).map((row) => ({
        key: String(asRecord(row).key || ""),
        description: String(asRecord(row).description || asRecord(row).description_tr || asRecord(row).description_en || "")
      }));
  const commandHints = commandHintSource.slice(0, 6).map((row) => {
    const item = asRecord(row);
    return {
      key: toText(item.key || "cmd"),
      description: toText(item.description || item.title || "")
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
    command_hints: commandHints,
    has_data: Boolean(Object.keys(homeFeed).length || Object.keys(bootstrap).length)
  };
}

