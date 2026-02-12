const MISSIONS = [
  {
    key: "daily_3_tasks",
    title: "Rhythm Runner",
    description: "Bugun 3 gorev tamamla",
    target: 3,
    reward: { sc: 15, hc: 0, rc: 5 }
  },
  {
    key: "daily_8_tasks",
    title: "Marathon Grid",
    description: "Bugun 8 gorev tamamla",
    target: 8,
    reward: { sc: 35, hc: 1, rc: 12 }
  },
  {
    key: "aggressive_win",
    title: "Risk Master",
    description: "Saldirgan modda 1 basarili gorev",
    target: 1,
    reward: { sc: 12, hc: 1, rc: 8 }
  },
  {
    key: "combo_3plus",
    title: "Momentum Engine",
    description: "Combo 3+ ile 1 gorev bitir",
    target: 1,
    reward: { sc: 18, hc: 0, rc: 10 }
  },
  {
    key: "rare_hunt",
    title: "Rare Hunter",
    description: "Bugun rare veya legendary reveal al",
    target: 1,
    reward: { sc: 20, hc: 0, rc: 12 }
  },
  {
    key: "war_contributor",
    title: "War Fuel",
    description: "War havuzuna 25 puan katki yap",
    target: 25,
    reward: { sc: 14, hc: 0, rc: 14 }
  }
];

function getDefinitions() {
  return MISSIONS.slice();
}

function getDefinitionByKey(key) {
  return MISSIONS.find((mission) => mission.key === key) || null;
}

async function getProgressSnapshot(db, userId) {
  const dailyResult = await db.query(
    `SELECT tasks_done
     FROM daily_counters
     WHERE user_id = $1
       AND day_date = CURRENT_DATE;`,
    [userId]
  );
  const tasksDone = Number(dailyResult.rows[0]?.tasks_done || 0);

  const behaviorResult = await db.query(
    `SELECT
        count(*) FILTER (
          WHERE event_type = 'task_complete'
            AND meta_json->>'result' = 'success'
            AND meta_json->>'play_mode' = 'aggressive'
        ) AS aggressive_success,
        count(*) FILTER (
          WHERE event_type = 'task_complete'
            AND meta_json->>'result' = 'success'
            AND CASE
                  WHEN (meta_json->>'combo') ~ '^[0-9]+$'
                  THEN (meta_json->>'combo')::int
                  ELSE 0
                END >= 3
        ) AS combo_success,
        count(*) FILTER (
          WHERE event_type = 'reveal_result'
            AND (meta_json->>'tier' = 'rare' OR meta_json->>'tier' = 'legendary')
        ) AS rare_reveal,
        COALESCE(sum(
          CASE
            WHEN event_type = 'war_contribution'
            THEN CASE
              WHEN (meta_json->>'delta') ~ '^[-]?[0-9]+(\\.[0-9]+)?$'
              THEN (meta_json->>'delta')::numeric
              ELSE 0
            END
            ELSE 0
          END
        ), 0) AS war_delta
     FROM behavior_events
     WHERE user_id = $1
       AND event_at >= date_trunc('day', now())
       AND event_at < date_trunc('day', now()) + interval '1 day';`,
    [userId]
  );
  const row = behaviorResult.rows[0] || {};
  return {
    daily_3_tasks: tasksDone,
    daily_8_tasks: tasksDone,
    aggressive_win: Number(row.aggressive_success || 0),
    combo_3plus: Number(row.combo_success || 0),
    rare_hunt: Number(row.rare_reveal || 0),
    war_contributor: Number(row.war_delta || 0)
  };
}

async function getClaimedMap(db, userId) {
  const result = await db.query(
    `SELECT mission_key
     FROM mission_claims
     WHERE user_id = $1
       AND day_date = CURRENT_DATE;`,
    [userId]
  );
  const map = {};
  for (const row of result.rows) {
    map[row.mission_key] = true;
  }
  return map;
}

async function getMissionBoard(db, userId) {
  const progress = await getProgressSnapshot(db, userId);
  const claimed = await getClaimedMap(db, userId);
  return MISSIONS.map((mission) => {
    const value = Math.min(mission.target, Number(progress[mission.key] || 0));
    return {
      ...mission,
      progress: value,
      claimed: Boolean(claimed[mission.key]),
      completed: value >= mission.target
    };
  });
}

async function insertClaimIfEligible(db, { userId, missionKey, board }) {
  const mission = board.find((item) => item.key === missionKey);
  if (!mission) {
    return { status: "not_found", mission: null };
  }
  if (mission.claimed) {
    return { status: "already_claimed", mission };
  }
  if (!mission.completed) {
    return { status: "not_ready", mission };
  }

  const result = await db.query(
    `INSERT INTO mission_claims (user_id, mission_key, day_date, meta_json)
     VALUES ($1, $2, CURRENT_DATE, $3::jsonb)
     ON CONFLICT (user_id, mission_key, day_date) DO NOTHING
     RETURNING user_id, mission_key, day_date, claimed_at;`,
    [userId, missionKey, JSON.stringify({ source: "telegram" })]
  );

  if (result.rows.length === 0) {
    return { status: "already_claimed", mission };
  }
  return { status: "claimed", mission, claim: result.rows[0] };
}

module.exports = {
  getDefinitions,
  getDefinitionByKey,
  getMissionBoard,
  insertClaimIfEligible
};
