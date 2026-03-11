"use strict";

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function toRate(numerator, denominator) {
  const top = Math.max(0, toNum(numerator, 0));
  const bottom = Math.max(0, toNum(denominator, 0));
  if (bottom <= 0) {
    return 0;
  }
  return Number((top / bottom).toFixed(4));
}

function resolveQualityBand(score) {
  const safe = clamp(toNum(score, 0), 0, 1);
  if (safe >= 0.97) return "green";
  if (safe >= 0.92) return "yellow";
  return "red";
}

function resolveConversionBand(intentToSubmitRate, submitToApprovedRate, intentCount) {
  const submitRate = clamp(toNum(intentToSubmitRate, 0), 0, 1);
  const approveRate = clamp(toNum(submitToApprovedRate, 0), 0, 1);
  const count = Math.max(0, Math.floor(toNum(intentCount, 0)));
  if (count < 20) {
    return "low_volume";
  }
  if (submitRate >= 0.55 && approveRate >= 0.55) {
    return "green";
  }
  if (submitRate >= 0.35 && approveRate >= 0.35) {
    return "yellow";
  }
  return "red";
}

function normalizeBreakdownRows(rows, limit = 6) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => ({
      bucket_key: String(row?.bucket_key || "unknown"),
      item_count: Math.max(0, Math.floor(toNum(row?.item_count, 0)))
    }))
    .filter((row) => row.bucket_key)
    .slice(0, Math.max(1, Math.floor(toNum(limit, 6))));
}

function normalizeSceneDailyRows(rows, limit = 7) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => ({
      day: String(row?.day || ""),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      ready_count: Math.max(0, Math.floor(toNum(row?.ready_count, 0))),
      failed_count: Math.max(0, Math.floor(toNum(row?.failed_count, 0))),
      low_end_count: Math.max(0, Math.floor(toNum(row?.low_end_count, 0)))
    }))
    .filter((row) => row.day)
    .map((row) => {
      const readyRate = toRate(row.ready_count, row.total_count);
      const failureRate = toRate(row.failed_count, row.total_count);
      const lowEndShare = toRate(row.low_end_count, row.total_count);
      return {
        ...row,
        ready_rate: readyRate,
        failure_rate: failureRate,
        low_end_share: lowEndShare,
        health_band: resolveSceneRuntimeHealthBand(readyRate, row.total_count, row.failed_count)
      };
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 7))));
}

function normalizeSceneLoopDailyRows(rows, limit = 7) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => ({
      day: String(row?.day || ""),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      district_count: Math.max(0, Math.floor(toNum(row?.district_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0)))
    }))
    .filter((row) => row.day)
    .map((row) => {
      const liveShare = toRate(row.live_count, row.total_count);
      const blockedShare = toRate(row.blocked_count, row.total_count);
      return {
        ...row,
        live_share: liveShare,
        blocked_share: blockedShare,
        health_band: resolveSceneLoopHealthBand(row.total_count, row.district_count, liveShare, blockedShare)
      };
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 7))));
}

function normalizeSceneLoopDistrictDailyRows(rows, limit = 42) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => ({
      day: String(row?.day || ""),
      district_key: String(row?.district_key || "unknown"),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0)))
    }))
    .filter((row) => row.day && row.district_key)
    .map((row) => {
      const liveShare = toRate(row.live_count, row.total_count);
      const blockedShare = toRate(row.blocked_count, row.total_count);
      return {
        ...row,
        live_share: liveShare,
        blocked_share: blockedShare,
        health_band: resolveSceneLoopDistrictHealthBand(row.total_count, liveShare, blockedShare)
      };
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 42))));
}

function normalizeSceneLoopFamilyKey(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/^world_(entry|modal|sequence)_kind_/, "")
    .replace(/_(flow|pod|sequence|terminal|console|route)$/g, "")
    .replace(/__+/g, "_") || "unknown";
}

function normalizeSceneLoopDistrictFamilyDailyRows(rows, limit = 84) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => ({
      day: String(row?.day || ""),
      district_key: String(row?.district_key || "unknown"),
      loop_family_key: normalizeSceneLoopFamilyKey(row?.loop_family_key),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0)))
    }))
    .filter((row) => row.day && row.district_key && row.loop_family_key)
    .map((row) => {
      const liveShare = toRate(row.live_count, row.total_count);
      const blockedShare = toRate(row.blocked_count, row.total_count);
      return {
        ...row,
        live_share: liveShare,
        blocked_share: blockedShare,
        health_band: resolveSceneLoopDistrictHealthBand(row.total_count, liveShare, blockedShare)
      };
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 84))));
}

function resolveSceneLoopDistrictHealthBand(totalCount, liveShare, blockedShare) {
  const total = Math.max(0, Math.floor(toNum(totalCount, 0)));
  const live = clamp(toNum(liveShare, 0), 0, 1);
  const blocked = clamp(toNum(blockedShare, 0), 0, 1);
  if (total <= 0) {
    return "no_data";
  }
  if (live >= 0.8 && blocked <= 0.15 && total >= 8) {
    return "green";
  }
  if (live >= 0.45 && blocked <= 0.35 && total >= 3) {
    return "yellow";
  }
  return "red";
}

function resolveSceneLoopHealthBand(totalCount, districtCount, liveShare, blockedShare) {
  const total = Math.max(0, Math.floor(toNum(totalCount, 0)));
  const districts = Math.max(0, Math.floor(toNum(districtCount, 0)));
  const live = clamp(toNum(liveShare, 0), 0, 1);
  const blocked = clamp(toNum(blockedShare, 0), 0, 1);
  if (total <= 0) {
    return "no_data";
  }
  if (live >= 0.55 && districts >= 3 && blocked <= 0.2 && total >= 8) {
    return "green";
  }
  if (live >= 0.3 && districts >= 2 && blocked <= 0.45 && total >= 3) {
    return "yellow";
  }
  return "red";
}

function resolveSceneLoopTrendDirection(latestCount, earliestCount, sampleCount) {
  if (Math.max(0, Math.floor(toNum(sampleCount, 0))) < 2) {
    return "no_data";
  }
  const latest = Math.max(0, Math.floor(toNum(latestCount, 0)));
  const earliest = Math.max(0, Math.floor(toNum(earliestCount, 0)));
  const delta = latest - earliest;
  if (delta >= 4 || latest >= Math.ceil(earliest * 1.25)) return "improving";
  if (delta <= -4 || latest <= Math.floor(earliest * 0.75)) return "degrading";
  return "stable";
}

function buildSceneLoopBandBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.health_band || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function resolveSceneLoopAlarmState(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) {
    return "no_data";
  }
  const latest = source[0] || {};
  const redDays = source.filter((row) => row?.health_band === "red").length;
  const yellowDays = source.filter((row) => row?.health_band === "yellow").length;
  if (latest.health_band === "red" || redDays >= 2 || toNum(latest.blocked_share, 0) >= 0.45) {
    return "alert";
  }
  if (latest.health_band === "yellow" || yellowDays >= 3 || toNum(latest.district_count, 0) <= 1) {
    return "watch";
  }
  return "clear";
}

function buildSceneLoopAlarmReasons(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) {
    return [];
  }
  const latest = source[0] || {};
  const reasons = [];
  if (toNum(latest.blocked_share, 0) >= 0.45) {
    reasons.push("latest_blocked_share_spike");
  }
  if (toNum(latest.live_share, 0) <= 0.25) {
    reasons.push("latest_live_share_drop");
  }
  if (toNum(latest.district_count, 0) <= 1) {
    reasons.push("latest_district_coverage_low");
  }
  if (source.filter((row) => row?.health_band === "red").length >= 2) {
    reasons.push("repeated_red_days");
  }
  if (!reasons.length && latest.health_band === "yellow") {
    reasons.push("latest_watch_band");
  }
  return reasons.slice(0, 4);
}

function buildSceneLoopDistrictMatrix(rows, limit = 8) {
  const source = Array.isArray(rows) ? rows : [];
  const grouped = new Map();
  source.forEach((row) => {
    const districtKey = String(row?.district_key || "unknown");
    if (!grouped.has(districtKey)) {
      grouped.set(districtKey, []);
    }
    grouped.get(districtKey).push(row);
  });
  return Array.from(grouped.entries())
    .map(([district_key, districtRows]) => {
      const sortedRows = [...districtRows].sort(
        (left, right) => String(right.day || "").localeCompare(String(left.day || ""))
      );
      const totalCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.total_count, 0))), 0);
      const liveCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.live_count, 0))), 0);
      const blockedCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.blocked_count, 0))), 0);
      const liveShare = toRate(liveCount, totalCount);
      const blockedShare = toRate(blockedCount, totalCount);
      const latestRow = sortedRows[0] || null;
      const earliestRow = sortedRows[sortedRows.length - 1] || null;
      const dayCount = sortedRows.length;
      const greenDays = sortedRows.filter((row) => String(row?.health_band || "") === "green").length;
      const yellowDays = sortedRows.filter((row) => String(row?.health_band || "") === "yellow").length;
      const redDays = sortedRows.filter((row) => String(row?.health_band || "") === "red").length;
      return {
        district_key,
        total_count: totalCount,
        live_count: liveCount,
        blocked_count: blockedCount,
        live_share: liveShare,
        blocked_share: blockedShare,
        day_count: dayCount,
        latest_day: latestRow?.day || null,
        latest_total_count: Math.max(0, Math.floor(toNum(latestRow?.total_count, 0))),
        latest_health_band: String(latestRow?.health_band || "no_data"),
        green_days: greenDays,
        yellow_days: yellowDays,
        red_days: redDays,
        health_band: resolveSceneLoopDistrictHealthBand(totalCount, liveShare, blockedShare),
        attention_band: resolveSceneLoopDistrictAttentionBand(
          String(latestRow?.health_band || "no_data"),
          resolveSceneLoopTrendDirection(latestRow?.total_count, earliestRow?.total_count, sortedRows.length),
          blockedShare
        ),
        trend_direction: resolveSceneLoopTrendDirection(
          latestRow?.total_count,
          earliestRow?.total_count,
          sortedRows.length
        ),
        trend_delta: Math.max(
          -9999,
          Math.min(9999, Math.floor(toNum(latestRow?.total_count, 0) - toNum(earliestRow?.total_count, 0)))
        )
      };
    })
    .sort((left, right) => {
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return String(left.district_key || "").localeCompare(String(right.district_key || ""));
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 8))));
}

function buildSceneLoopDistrictFamilyMatrix(rows, limit = 12) {
  const source = Array.isArray(rows) ? rows : [];
  const grouped = new Map();
  source.forEach((row) => {
    const districtKey = String(row?.district_key || "unknown");
    const loopFamilyKey = normalizeSceneLoopFamilyKey(row?.loop_family_key);
    const compositeKey = `${districtKey}:${loopFamilyKey}`;
    if (!grouped.has(compositeKey)) {
      grouped.set(compositeKey, []);
    }
    grouped.get(compositeKey).push(row);
  });
  return Array.from(grouped.entries())
    .map(([compositeKey, familyRows]) => {
      const [district_key, loop_family_key] = compositeKey.split(":");
      const sortedRows = [...familyRows].sort((left, right) => String(right.day || "").localeCompare(String(left.day || "")));
      const totalCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.total_count, 0))), 0);
      const liveCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.live_count, 0))), 0);
      const blockedCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.blocked_count, 0))), 0);
      const liveShare = toRate(liveCount, totalCount);
      const blockedShare = toRate(blockedCount, totalCount);
      const latestRow = sortedRows[0] || null;
      const earliestRow = sortedRows[sortedRows.length - 1] || null;
      const greenDays = sortedRows.filter((row) => String(row?.health_band || "") === "green").length;
      const yellowDays = sortedRows.filter((row) => String(row?.health_band || "") === "yellow").length;
      const redDays = sortedRows.filter((row) => String(row?.health_band || "") === "red").length;
      return {
        district_key,
        loop_family_key,
        total_count: totalCount,
        live_count: liveCount,
        blocked_count: blockedCount,
        live_share: liveShare,
        blocked_share: blockedShare,
        day_count: sortedRows.length,
        latest_day: latestRow?.day || null,
        latest_total_count: Math.max(0, Math.floor(toNum(latestRow?.total_count, 0))),
        latest_health_band: String(latestRow?.health_band || "no_data"),
        green_days: greenDays,
        yellow_days: yellowDays,
        red_days: redDays,
        health_band: resolveSceneLoopDistrictHealthBand(totalCount, liveShare, blockedShare),
        attention_band: resolveSceneLoopDistrictAttentionBand(
          String(latestRow?.health_band || "no_data"),
          resolveSceneLoopTrendDirection(latestRow?.total_count, earliestRow?.total_count, sortedRows.length),
          blockedShare
        ),
        trend_direction: resolveSceneLoopTrendDirection(
          latestRow?.total_count,
          earliestRow?.total_count,
          sortedRows.length
        ),
        trend_delta: Math.max(
          -9999,
          Math.min(9999, Math.floor(toNum(latestRow?.total_count, 0) - toNum(earliestRow?.total_count, 0)))
        )
      };
    })
    .sort((left, right) => {
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_family_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_family_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 12))));
}

function buildSceneLoopDistrictFamilyLatestBandBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.latest_health_band || row?.health_band || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictFamilyTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.trend_direction || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictFamilyHealthTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const latestBand = String(row?.latest_health_band || row?.health_band || "no_data");
    const trend = String(row?.trend_direction || "no_data");
    const key = `${latestBand}:${trend}`;
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictFamilyAttentionBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.attention_band || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictFamilyHealthAttentionBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const latestBand = String(row?.latest_health_band || row?.health_band || "no_data");
    const attention = String(row?.attention_band || "no_data");
    const key = `${latestBand}:${attention}`;
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictFamilyAttentionTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const attention = String(row?.attention_band || "no_data");
    const trend = String(row?.trend_direction || "no_data");
    const key = `${attention}:${trend}`;
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictFamilyHealthAttentionTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const latestBand = String(row?.latest_health_band || row?.health_band || "no_data");
    const attention = String(row?.attention_band || "no_data");
    const trend = String(row?.trend_direction || "no_data");
    const key = `${latestBand}:${attention}:${trend}`;
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function resolveSceneLoopDistrictAttentionBand(latestHealthBand, trendDirection, blockedShare) {
  const latestBand = String(latestHealthBand || "no_data");
  const trend = String(trendDirection || "no_data");
  const blocked = clamp(toNum(blockedShare, 0), 0, 1);
  if (latestBand === "red" || (trend === "degrading" && blocked >= 0.25)) {
    return "alert";
  }
  if (latestBand === "yellow" || trend === "degrading" || blocked >= 0.18) {
    return "watch";
  }
  if (latestBand === "green" || trend === "improving" || trend === "stable") {
    return "clear";
  }
  return "no_data";
}

function buildSceneLoopDistrictAttentionBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.attention_band || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictLatestBandBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.latest_health_band || row?.health_band || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.trend_direction || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictHealthTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const latestBand = String(row?.latest_health_band || row?.health_band || "no_data");
    const trend = String(row?.trend_direction || "no_data");
    const key = `${latestBand}:${trend}`;
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function resolveSceneTrendDirection(latestReadyRate, earliestReadyRate, sampleCount) {
  if (Math.max(0, Math.floor(toNum(sampleCount, 0))) < 2) {
    return "no_data";
  }
  const delta = clamp(toNum(latestReadyRate, 0) - toNum(earliestReadyRate, 0), -1, 1);
  if (delta >= 0.03) return "improving";
  if (delta <= -0.03) return "degrading";
  return "stable";
}

function buildSceneBandBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.health_band || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function resolveSceneAlarmState(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) {
    return "no_data";
  }
  const latest = source[0] || {};
  const redDays = source.filter((row) => row?.health_band === "red").length;
  const yellowDays = source.filter((row) => row?.health_band === "yellow").length;
  if (latest.health_band === "red" || redDays >= 2 || toNum(latest.failure_rate, 0) >= 0.12) {
    return "alert";
  }
  if (latest.health_band === "yellow" || yellowDays >= 3 || toNum(latest.low_end_share, 0) >= 0.45) {
    return "watch";
  }
  return "clear";
}

function buildSceneAlarmReasons(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) {
    return [];
  }
  const latest = source[0] || {};
  const reasons = [];
  if (toNum(latest.failure_rate, 0) >= 0.12) {
    reasons.push("latest_failure_spike");
  }
  if (toNum(latest.ready_rate, 0) <= 0.9) {
    reasons.push("latest_ready_drop");
  }
  if (toNum(latest.low_end_share, 0) >= 0.45) {
    reasons.push("latest_low_end_pressure");
  }
  if (source.filter((row) => row?.health_band === "red").length >= 2) {
    reasons.push("repeated_red_days");
  }
  if (!reasons.length && latest.health_band === "yellow") {
    reasons.push("latest_watch_band");
  }
  return reasons.slice(0, 4);
}

function resolveSceneRuntimeHealthBand(readyRate, totalCount, failedCount) {
  const safeReadyRate = clamp(toNum(readyRate, 0), 0, 1);
  const total = Math.max(0, Math.floor(toNum(totalCount, 0)));
  const failed = Math.max(0, Math.floor(toNum(failedCount, 0)));
  if (total <= 0) {
    return "no_data";
  }
  if (safeReadyRate >= 0.96 && failed <= 3) {
    return "green";
  }
  if (safeReadyRate >= 0.9) {
    return "yellow";
  }
  return "red";
}

function enrichWebappRevenueMetrics(rawMetrics = {}) {
  const metrics = rawMetrics && typeof rawMetrics === "object" ? rawMetrics : {};
  const uiIngested = Math.max(0, Math.floor(toNum(metrics.ui_events_ingested_24h, 0)));
  const uiValid = Math.max(0, Math.floor(toNum(metrics.ui_events_valid_24h, 0)));
  const qualityScore = uiIngested > 0 ? Number((uiValid / uiIngested).toFixed(4)) : 1;
  const intent = Math.max(0, Math.floor(toNum(metrics.funnel_intent_24h, 0)));
  const submit = Math.max(0, Math.floor(toNum(metrics.funnel_tx_submit_24h, 0)));
  const approved = Math.max(0, Math.floor(toNum(metrics.funnel_approved_24h, 0)));
  const intentToSubmitRate = toRate(submit, intent);
  const submitToApprovedRate = toRate(approved, submit);

  metrics.ui_events_ingested_24h = uiIngested;
  metrics.ui_events_valid_24h = uiValid;
  metrics.ui_events_with_funnel_24h = Math.max(0, Math.floor(toNum(metrics.ui_events_with_funnel_24h, 0)));
  metrics.ui_events_value_usd_24h = Number(toNum(metrics.ui_events_value_usd_24h, 0).toFixed(8));
  metrics.ui_event_quality_score_24h = qualityScore;
  metrics.ui_event_quality_band_24h = resolveQualityBand(qualityScore);

  metrics.funnel_intent_24h = intent;
  metrics.funnel_tx_submit_24h = submit;
  metrics.funnel_approved_24h = approved;
  metrics.funnel_pass_purchase_24h = Math.max(0, Math.floor(toNum(metrics.funnel_pass_purchase_24h, 0)));
  metrics.funnel_cosmetic_purchase_24h = Math.max(0, Math.floor(toNum(metrics.funnel_cosmetic_purchase_24h, 0)));
  metrics.funnel_value_usd_24h = Number(toNum(metrics.funnel_value_usd_24h, 0).toFixed(8));
  metrics.funnel_intent_to_submit_rate_24h = intentToSubmitRate;
  metrics.funnel_submit_to_approved_rate_24h = submitToApprovedRate;
  metrics.funnel_conversion_band_24h = resolveConversionBand(intentToSubmitRate, submitToApprovedRate, intent);

  const sceneReady = Math.max(0, Math.floor(toNum(metrics.scene_runtime_ready_24h, 0)));
  const sceneFailed = Math.max(0, Math.floor(toNum(metrics.scene_runtime_failed_24h, 0)));
  const sceneLowEnd = Math.max(0, Math.floor(toNum(metrics.scene_runtime_low_end_24h, 0)));
  const sceneTotal = sceneReady + sceneFailed;
  const sceneReadyRate = toRate(sceneReady, sceneTotal);
  const sceneFailureRate = toRate(sceneFailed, sceneTotal);
  const sceneLowEndShare = toRate(sceneLowEnd, sceneTotal);
  metrics.scene_runtime_ready_24h = sceneReady;
  metrics.scene_runtime_failed_24h = sceneFailed;
  metrics.scene_runtime_low_end_24h = sceneLowEnd;
  metrics.scene_runtime_total_24h = sceneTotal;
  metrics.scene_runtime_ready_rate_24h = sceneReadyRate;
  metrics.scene_runtime_failure_rate_24h = sceneFailureRate;
  metrics.scene_runtime_low_end_share_24h = sceneLowEndShare;
  metrics.scene_runtime_avg_loaded_bundles_24h = Number(toNum(metrics.scene_runtime_avg_loaded_bundles_24h, 0).toFixed(2));
  metrics.scene_runtime_health_band_24h = resolveSceneRuntimeHealthBand(sceneReadyRate, sceneTotal, sceneFailed);
  metrics.scene_runtime_quality_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_quality_breakdown_24h);
  metrics.scene_runtime_perf_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_perf_breakdown_24h);
  metrics.scene_runtime_device_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_device_breakdown_24h);
  metrics.scene_runtime_profile_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_profile_breakdown_24h);
  metrics.scene_loop_events_24h = Math.max(0, Math.floor(toNum(metrics.scene_loop_events_24h, 0)));
  metrics.scene_loop_live_24h = Math.max(0, Math.floor(toNum(metrics.scene_loop_live_24h, 0)));
  metrics.scene_loop_blocked_24h = Math.max(0, Math.floor(toNum(metrics.scene_loop_blocked_24h, 0)));
  metrics.scene_loop_district_coverage_24h = Math.max(0, Math.floor(toNum(metrics.scene_loop_district_coverage_24h, 0)));
  metrics.scene_loop_daily_breakdown_7d = normalizeSceneLoopDailyRows(metrics.scene_loop_daily_breakdown_7d);
  metrics.scene_loop_district_daily_breakdown_7d = normalizeSceneLoopDistrictDailyRows(
    metrics.scene_loop_district_daily_breakdown_7d
  );
  metrics.scene_loop_district_family_daily_breakdown_7d = normalizeSceneLoopDistrictFamilyDailyRows(
    metrics.scene_loop_district_family_daily_breakdown_7d
  );
  metrics.scene_loop_events_7d = metrics.scene_loop_daily_breakdown_7d.reduce(
    (sum, row) => sum + Math.max(0, Math.floor(toNum(row.total_count, 0))),
    0
  );
  metrics.scene_loop_live_share_24h = toRate(metrics.scene_loop_live_24h, metrics.scene_loop_events_24h);
  metrics.scene_loop_blocked_share_24h = toRate(metrics.scene_loop_blocked_24h, metrics.scene_loop_events_24h);
  metrics.scene_loop_health_band_24h = resolveSceneLoopHealthBand(
    metrics.scene_loop_events_24h,
    metrics.scene_loop_district_coverage_24h,
    metrics.scene_loop_live_share_24h,
    metrics.scene_loop_blocked_share_24h
  );
  const sceneLoopRows = metrics.scene_loop_daily_breakdown_7d;
  const latestSceneLoopDay = sceneLoopRows[0] || null;
  const earliestSceneLoopDay = sceneLoopRows[sceneLoopRows.length - 1] || null;
  metrics.scene_loop_trend_direction_7d = resolveSceneLoopTrendDirection(
    latestSceneLoopDay?.total_count,
    earliestSceneLoopDay?.total_count,
    sceneLoopRows.length
  );
  metrics.scene_loop_trend_delta_7d = Math.max(
    -9999,
    Math.min(9999, Math.floor(toNum(latestSceneLoopDay?.total_count, 0) - toNum(earliestSceneLoopDay?.total_count, 0)))
  );
  metrics.scene_loop_alarm_state_7d = resolveSceneLoopAlarmState(sceneLoopRows);
  metrics.scene_loop_alarm_reasons_7d = buildSceneLoopAlarmReasons(sceneLoopRows);
  metrics.scene_loop_band_breakdown_7d = buildSceneLoopBandBreakdown(sceneLoopRows);
  metrics.scene_loop_peak_day_7d =
    sceneLoopRows.length > 0
      ? [...sceneLoopRows].sort((left, right) => {
          const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
          if (Math.abs(totalGap) > 0.0001) return totalGap;
          return String(right.day || "").localeCompare(String(left.day || ""));
        })[0]
      : null;
  metrics.scene_loop_district_matrix_7d = buildSceneLoopDistrictMatrix(metrics.scene_loop_district_daily_breakdown_7d);
  metrics.scene_loop_district_latest_band_breakdown_7d = buildSceneLoopDistrictLatestBandBreakdown(
    metrics.scene_loop_district_matrix_7d
  );
  metrics.scene_loop_district_trend_breakdown_7d = buildSceneLoopDistrictTrendBreakdown(
    metrics.scene_loop_district_matrix_7d
  );
  metrics.scene_loop_district_health_trend_breakdown_7d = buildSceneLoopDistrictHealthTrendBreakdown(
    metrics.scene_loop_district_matrix_7d
  );
  metrics.scene_loop_district_attention_breakdown_7d = buildSceneLoopDistrictAttentionBreakdown(
    metrics.scene_loop_district_matrix_7d
  );
  metrics.scene_loop_district_breakdown_24h = normalizeBreakdownRows(metrics.scene_loop_district_breakdown_24h);
  metrics.scene_loop_family_breakdown_24h = normalizeBreakdownRows(
    (Array.isArray(metrics.scene_loop_family_breakdown_24h) ? metrics.scene_loop_family_breakdown_24h : []).map((row) => ({
      ...row,
      bucket_key: normalizeSceneLoopFamilyKey(row?.bucket_key)
    }))
  );
  metrics.scene_loop_status_breakdown_24h = normalizeBreakdownRows(metrics.scene_loop_status_breakdown_24h);
  metrics.scene_loop_sequence_breakdown_24h = normalizeBreakdownRows(metrics.scene_loop_sequence_breakdown_24h);
  metrics.scene_loop_entry_breakdown_24h = normalizeBreakdownRows(metrics.scene_loop_entry_breakdown_24h);
  metrics.scene_loop_district_family_matrix_7d = buildSceneLoopDistrictFamilyMatrix(
    metrics.scene_loop_district_family_daily_breakdown_7d
  );
  metrics.scene_loop_district_family_latest_band_breakdown_7d = buildSceneLoopDistrictFamilyLatestBandBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_trend_breakdown_7d = buildSceneLoopDistrictFamilyTrendBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_health_trend_breakdown_7d = buildSceneLoopDistrictFamilyHealthTrendBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_attention_breakdown_7d = buildSceneLoopDistrictFamilyAttentionBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_health_attention_breakdown_7d = buildSceneLoopDistrictFamilyHealthAttentionBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_attention_trend_breakdown_7d = buildSceneLoopDistrictFamilyAttentionTrendBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_health_attention_trend_breakdown_7d =
    buildSceneLoopDistrictFamilyHealthAttentionTrendBreakdown(metrics.scene_loop_district_family_matrix_7d);
  metrics.scene_runtime_daily_breakdown_7d = normalizeSceneDailyRows(metrics.scene_runtime_daily_breakdown_7d);
  const sceneDailyRows = metrics.scene_runtime_daily_breakdown_7d;
  const latestSceneDay = sceneDailyRows[0] || null;
  const earliestSceneDay = sceneDailyRows[sceneDailyRows.length - 1] || null;
  const sceneReadyRate7dAvg = sceneDailyRows.length
    ? Number(
        (
          sceneDailyRows.reduce((sum, row) => sum + toNum(row.ready_rate, 0), 0) /
          Math.max(1, sceneDailyRows.length)
        ).toFixed(4)
      )
    : 0;
  const sceneFailureRate7dAvg = sceneDailyRows.length
    ? Number(
        (
          sceneDailyRows.reduce((sum, row) => sum + toNum(row.failure_rate, 0), 0) /
          Math.max(1, sceneDailyRows.length)
        ).toFixed(4)
      )
    : 0;
  const sceneLowEndShare7dAvg = sceneDailyRows.length
    ? Number(
        (
          sceneDailyRows.reduce((sum, row) => sum + toNum(row.low_end_share, 0), 0) /
          Math.max(1, sceneDailyRows.length)
        ).toFixed(4)
      )
    : 0;
  const sceneTrendDirection = resolveSceneTrendDirection(
    latestSceneDay?.ready_rate,
    earliestSceneDay?.ready_rate,
    sceneDailyRows.length
  );
  const sceneTrendDelta = Number(
    clamp(toNum(latestSceneDay?.ready_rate, 0) - toNum(earliestSceneDay?.ready_rate, 0), -1, 1).toFixed(4)
  );
  const sceneAlarmState = resolveSceneAlarmState(sceneDailyRows);
  const sceneAlarmReasons = buildSceneAlarmReasons(sceneDailyRows);
  const sceneBandBreakdown = buildSceneBandBreakdown(sceneDailyRows);
  const worstSceneDay =
    sceneDailyRows.length > 0
      ? [...sceneDailyRows]
          .sort((left, right) => {
            const failureGap = toNum(right.failure_rate, 0) - toNum(left.failure_rate, 0);
            if (Math.abs(failureGap) > 0.0001) return failureGap;
            const readyGap = toNum(left.ready_rate, 0) - toNum(right.ready_rate, 0);
            if (Math.abs(readyGap) > 0.0001) return readyGap;
            return String(right.day || "").localeCompare(String(left.day || ""));
          })[0]
      : null;
  metrics.scene_runtime_ready_rate_7d_avg = sceneReadyRate7dAvg;
  metrics.scene_runtime_failure_rate_7d_avg = sceneFailureRate7dAvg;
  metrics.scene_runtime_low_end_share_7d_avg = sceneLowEndShare7dAvg;
  metrics.scene_runtime_trend_direction_7d = sceneTrendDirection;
  metrics.scene_runtime_trend_delta_ready_rate_7d = sceneTrendDelta;
  metrics.scene_runtime_alarm_state_7d = sceneAlarmState;
  metrics.scene_runtime_alarm_reasons_7d = sceneAlarmReasons;
  metrics.scene_runtime_band_breakdown_7d = sceneBandBreakdown;
  metrics.scene_runtime_worst_day_7d = worstSceneDay
    ? {
        day: String(worstSceneDay.day || ""),
        total_count: Math.max(0, Math.floor(toNum(worstSceneDay.total_count, 0))),
        ready_count: Math.max(0, Math.floor(toNum(worstSceneDay.ready_count, 0))),
        failed_count: Math.max(0, Math.floor(toNum(worstSceneDay.failed_count, 0))),
        low_end_count: Math.max(0, Math.floor(toNum(worstSceneDay.low_end_count, 0))),
        ready_rate: toNum(worstSceneDay.ready_rate, 0),
        failure_rate: toNum(worstSceneDay.failure_rate, 0),
        low_end_share: toNum(worstSceneDay.low_end_share, 0),
        health_band: String(worstSceneDay.health_band || "no_data")
      }
    : null;
  return metrics;
}

module.exports = {
  toRate,
  resolveQualityBand,
  resolveConversionBand,
  resolveSceneRuntimeHealthBand,
  resolveSceneTrendDirection,
  resolveSceneAlarmState,
  normalizeBreakdownRows,
  normalizeSceneDailyRows,
  normalizeSceneLoopDailyRows,
  normalizeSceneLoopDistrictDailyRows,
  resolveSceneLoopHealthBand,
  resolveSceneLoopDistrictHealthBand,
  resolveSceneLoopDistrictAttentionBand,
  buildSceneLoopDistrictLatestBandBreakdown,
  buildSceneLoopDistrictTrendBreakdown,
  buildSceneLoopDistrictHealthTrendBreakdown,
  buildSceneLoopDistrictAttentionBreakdown,
  buildSceneLoopDistrictFamilyMatrix,
  buildSceneLoopDistrictFamilyLatestBandBreakdown,
  buildSceneLoopDistrictFamilyTrendBreakdown,
  buildSceneLoopDistrictFamilyHealthTrendBreakdown,
  buildSceneLoopDistrictFamilyAttentionBreakdown,
  buildSceneLoopDistrictFamilyHealthAttentionBreakdown,
  buildSceneLoopDistrictFamilyAttentionTrendBreakdown,
  buildSceneLoopDistrictFamilyHealthAttentionTrendBreakdown,
  resolveSceneLoopTrendDirection,
  buildSceneBandBreakdown,
  buildSceneLoopBandBreakdown,
  buildSceneLoopDistrictMatrix,
  buildSceneAlarmReasons,
  buildSceneLoopAlarmReasons,
  resolveSceneLoopAlarmState,
  enrichWebappRevenueMetrics
};
