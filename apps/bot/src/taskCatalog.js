const TASK_CATALOG = [
  {
    id: "tap_progress",
    title: "Tap-for-Progress",
    durationMinutes: 10,
    rewardPreview: "1-2 SC",
    difficulty: 0.2,
    family: "micro"
  },
  {
    id: "claim_timer",
    title: "Claim-Timer",
    durationMinutes: 60,
    rewardPreview: "2-4 SC",
    difficulty: 0.35,
    family: "timer"
  },
  {
    id: "mystery_crate",
    title: "Mystery Crate",
    durationMinutes: 30,
    rewardPreview: "0-1 HC",
    difficulty: 0.5,
    family: "rng"
  },
  {
    id: "double_or_nothing",
    title: "Double-or-Nothing",
    durationMinutes: 20,
    rewardPreview: "1-3 SC",
    difficulty: 0.6,
    family: "risk"
  },
  {
    id: "combo_chain",
    title: "Combo Chain",
    durationMinutes: 15,
    rewardPreview: "2-3 SC + RC",
    difficulty: 0.42,
    family: "combo"
  },
  {
    id: "social_pulse",
    title: "Social Pulse",
    durationMinutes: 25,
    rewardPreview: "1-2 SC + rank puani",
    difficulty: 0.46,
    family: "social"
  },
  {
    id: "pressure_window",
    title: "Pressure Window",
    durationMinutes: 8,
    rewardPreview: "Hizli reveal sansi",
    difficulty: 0.58,
    family: "rush"
  }
];

function getCatalog() {
  return TASK_CATALOG.slice();
}

function getTaskById(taskId) {
  return TASK_CATALOG.find((task) => task.id === taskId) || null;
}

function weightedShuffle(items) {
  return items
    .map((item) => ({ item, score: Math.random() / Math.max(0.0001, item.weight) }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);
}

function weightForTask(task, options) {
  const tier = Number(options?.kingdomTier || 0);
  const risk = Number(options?.risk || 0);
  let weight = 1;

  if (task.family === "micro" || task.family === "timer") {
    weight += 0.5;
  }
  if (tier >= 2 && (task.family === "risk" || task.family === "rush")) {
    weight += 0.4;
  }
  if (risk >= 0.6 && (task.family === "risk" || task.family === "rush")) {
    weight -= 0.4;
  }
  if (task.family === "social") {
    weight += 0.2;
  }
  return Math.max(0.1, weight);
}

function pickTasks(count, excludeTypes = [], options = {}) {
  const pool = TASK_CATALOG.filter((task) => !excludeTypes.includes(task.id)).map((task) => ({
    ...task,
    weight: weightForTask(task, options)
  }));
  const shuffled = weightedShuffle(pool);
  return shuffled.slice(0, count).map((task) => ({
    id: task.id,
    title: task.title,
    durationMinutes: task.durationMinutes,
    rewardPreview: task.rewardPreview,
    difficulty: task.difficulty,
    family: task.family
  }));
}

module.exports = {
  getCatalog,
  getTaskById,
  pickTasks
};
