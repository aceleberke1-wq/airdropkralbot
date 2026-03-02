"use strict";

function clamp(value, min = 0, max = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

const DEFAULT_PVP_PROGRESS_CONFIG = Object.freeze({
  daily_duel: {
    target_wins: 1
  },
  weekly_ladder: {
    target_points: 180,
    max_milestones: 3
  },
  season_arc_boss: {
    wave_total: 5,
    wave_hp: 6000,
    personal_milestone: 420,
    personal_milestone_cap: 12
  }
});

function normalizeProgressionConfig(rawConfig) {
  const source = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
  const daily = source.daily_duel && typeof source.daily_duel === "object" ? source.daily_duel : {};
  const weekly = source.weekly_ladder && typeof source.weekly_ladder === "object" ? source.weekly_ladder : {};
  const arc = source.season_arc_boss && typeof source.season_arc_boss === "object" ? source.season_arc_boss : {};
  return {
    daily_duel: {
      target_wins: Math.max(1, Math.round(Number(daily.target_wins || DEFAULT_PVP_PROGRESS_CONFIG.daily_duel.target_wins)))
    },
    weekly_ladder: {
      target_points: Math.max(
        20,
        Math.round(Number(weekly.target_points || DEFAULT_PVP_PROGRESS_CONFIG.weekly_ladder.target_points))
      ),
      max_milestones: Math.max(
        1,
        Math.min(24, Math.round(Number(weekly.max_milestones || DEFAULT_PVP_PROGRESS_CONFIG.weekly_ladder.max_milestones)))
      )
    },
    season_arc_boss: {
      wave_total: Math.max(1, Math.min(20, Math.round(Number(arc.wave_total || DEFAULT_PVP_PROGRESS_CONFIG.season_arc_boss.wave_total)))),
      wave_hp: Math.max(100, Math.round(Number(arc.wave_hp || DEFAULT_PVP_PROGRESS_CONFIG.season_arc_boss.wave_hp))),
      personal_milestone: Math.max(
        50,
        Math.round(Number(arc.personal_milestone || DEFAULT_PVP_PROGRESS_CONFIG.season_arc_boss.personal_milestone))
      ),
      personal_milestone_cap: Math.max(
        1,
        Math.min(100, Math.round(Number(arc.personal_milestone_cap || DEFAULT_PVP_PROGRESS_CONFIG.season_arc_boss.personal_milestone_cap)))
      )
    }
  };
}

function computePvpProgressionState(counters, rawConfig = null, meta = {}) {
  const cfg = normalizeProgressionConfig(rawConfig);
  const source = counters && typeof counters === "object" ? counters : {};
  const dailyWins = Math.max(0, Math.floor(Number(source.daily_wins || source.dailyWins || 0)));
  const dailyClaimed = Math.max(0, Math.floor(Number(source.daily_claimed || source.dailyClaimed || 0)));
  const weeklyPoints = Math.max(0, Math.floor(Number(source.weekly_points || source.weeklyPoints || 0)));
  const weeklyClaimed = Math.max(0, Math.floor(Number(source.weekly_claimed || source.weeklyClaimed || 0)));
  const arcGlobal = Math.max(0, Math.floor(Number(source.arc_global || source.arcGlobal || 0)));
  const arcPersonal = Math.max(0, Math.floor(Number(source.arc_personal || source.arcPersonal || 0)));
  const arcPersonalClaimed = Math.max(
    0,
    Math.floor(Number(source.arc_personal_claimed || source.arcPersonalClaimed || 0))
  );

  const dailyProgress = clamp(dailyWins / Math.max(1, cfg.daily_duel.target_wins), 0, 1);
  const weeklyMilestonesReached = Math.min(
    cfg.weekly_ladder.max_milestones,
    Math.floor(weeklyPoints / Math.max(1, cfg.weekly_ladder.target_points))
  );
  const weeklyNextTarget =
    weeklyClaimed >= cfg.weekly_ladder.max_milestones
      ? null
      : (Math.max(0, weeklyClaimed) + 1) * cfg.weekly_ladder.target_points;

  const arcTotalGoal = cfg.season_arc_boss.wave_total * cfg.season_arc_boss.wave_hp;
  const arcWaveIndex =
    arcGlobal >= arcTotalGoal
      ? cfg.season_arc_boss.wave_total
      : Math.min(cfg.season_arc_boss.wave_total, Math.floor(arcGlobal / cfg.season_arc_boss.wave_hp) + 1);
  const arcWaveProgress = clamp(
    arcGlobal >= arcTotalGoal ? 1 : (arcGlobal % cfg.season_arc_boss.wave_hp) / Math.max(1, cfg.season_arc_boss.wave_hp),
    0,
    1
  );
  const personalMilestonesReached = Math.min(
    cfg.season_arc_boss.personal_milestone_cap,
    Math.floor(arcPersonal / Math.max(1, cfg.season_arc_boss.personal_milestone))
  );

  return {
    season_id: Number(meta.season_id || meta.seasonId || 0),
    day_key: String(meta.day_key || meta.dayKey || ""),
    week_key: String(meta.week_key || meta.weekKey || ""),
    daily_duel: {
      target_wins: cfg.daily_duel.target_wins,
      wins: dailyWins,
      claimed: dailyClaimed > 0,
      completed: dailyWins >= cfg.daily_duel.target_wins,
      progress: Number(dailyProgress.toFixed(4))
    },
    weekly_ladder: {
      target_points: cfg.weekly_ladder.target_points,
      points: weeklyPoints,
      milestones_reached: weeklyMilestonesReached,
      milestones_claimed: Math.min(cfg.weekly_ladder.max_milestones, weeklyClaimed),
      max_milestones: cfg.weekly_ladder.max_milestones,
      next_milestone_points: weeklyNextTarget
    },
    season_arc_boss: {
      wave_total: cfg.season_arc_boss.wave_total,
      wave_hp: cfg.season_arc_boss.wave_hp,
      wave_index: arcWaveIndex,
      wave_progress: Number(arcWaveProgress.toFixed(4)),
      global_contribution: arcGlobal,
      personal_contribution: arcPersonal,
      personal_milestones_reached: personalMilestonesReached,
      personal_milestones_claimed: Math.min(cfg.season_arc_boss.personal_milestone_cap, arcPersonalClaimed),
      personal_milestone_target: cfg.season_arc_boss.personal_milestone
    }
  };
}

module.exports = {
  DEFAULT_PVP_PROGRESS_CONFIG,
  normalizeProgressionConfig,
  computePvpProgressionState
};
