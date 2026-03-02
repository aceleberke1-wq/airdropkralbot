const { normalizeLanguage } = require("../i18n");
const { normalizeCommandRegistry, validateCommandRegistry } = require("../../../../packages/shared/src/v5/commandEngine");

const RAW_COMMAND_REGISTRY = Object.freeze([
  {
    key: "menu",
    aliases: ["start"],
    description_tr: "Launcher kisayol menusu",
    description_en: "Open launcher shortcuts",
    intents: ["menu", "launcher", "start", "home", "ana menu", "ana men"],
    scenarios: ["menu", "ana menu", "start"],
    outcomes: ["launcher panelini ac", "onboard/play/tasks kisayollarini goster"],
    primary: true
  },
  {
    key: "play",
    aliases: ["arena", "arena3d"],
    description_tr: "Arena 3D web arayuzu",
    description_en: "Open Arena 3D web app",
    intents: ["play", "arena", "arena 3d", "3d arena", "battle", "duel"],
    scenarios: ["/play", "arena 3d ac", "open arena"],
    outcomes: ["webapp mini app linki uret", "pvp/task/vault panelini ac"],
    primary: true
  },
  {
    key: "tasks",
    aliases: ["task", "gorev"],
    description_tr: "Gorev havuzunu goster",
    description_en: "Show task pool",
    intents: ["tasks", "task", "gorev", "gorevler", "quest", "quests"],
    scenarios: ["gorev", "tasks", "quest list"],
    outcomes: ["aktif gorev havuzunu goster", "kabul edilebilir offerlari listele"],
    primary: true
  },
  {
    key: "finish",
    aliases: ["bitir"],
    description_tr: "Aktif gorevi bitir (safe/balanced/aggressive)",
    description_en: "Finish active task (safe/balanced/aggressive)",
    intents: ["finish", "bitir", "tamamla", "complete"],
    scenarios: ["bitir dengeli", "/finish aggressive"],
    outcomes: ["aktif denemeyi kapat", "sonuc ve olasilik ozeti goster"],
    primary: true
  },
  {
    key: "reveal",
    aliases: ["revealnow"],
    description_tr: "Son biten gorevi ac",
    description_en: "Reveal latest completed run",
    intents: ["reveal", "revealnow", "loot", "open loot"],
    scenarios: ["reveal", "kasa ac", "open loot"],
    outcomes: ["son biten denemenin odulunu dagit", "pity ve bakiye guncelle"],
    primary: true
  },
  {
    key: "pvp",
    aliases: ["raid"],
    description_tr: "PvP raid baslat (safe/balanced/aggressive)",
    description_en: "Start PvP raid (safe/balanced/aggressive)",
    intents: ["pvp", "raid", "arena raid", "duel"],
    scenarios: ["/pvp", "raid aggressive", "duel baslat"],
    outcomes: ["pvp oturumu baslat", "kontrat/progression metriklerini ilerlet"],
    primary: true
  },
  {
    key: "arena_rank",
    aliases: [],
    description_tr: "Arena rating ve siralama",
    description_en: "Arena rating and leaderboard",
    intents: ["arena rank", "rank", "arena siralama", "leaderboard arena"],
    scenarios: ["arena rank", "/arena_rank", "pvp leaderboard"],
    outcomes: ["rating, rank ve leaderboard verisini goster"],
    primary: true
  },
  {
    key: "wallet",
    aliases: ["cuzdan"],
    description_tr: "Bakiye durumunu goster",
    description_en: "Show balances",
    intents: ["wallet", "cuzdan", "balance", "balances"],
    scenarios: ["wallet", "cuzdan", "balance"],
    outcomes: ["SC/HC/RC ve gunluk cap durumunu goster"],
    primary: true
  },
  {
    key: "vault",
    aliases: ["payout"],
    description_tr: "Payout/Vault paneli",
    description_en: "Open payout vault panel",
    intents: ["vault", "payout", "cekim", "withdraw", "cashout"],
    scenarios: ["vault", "payout", "withdraw"],
    outcomes: ["payout lock durumunu ve talep uygunlugunu goster"],
    primary: true
  },
  {
    key: "token",
    aliases: [],
    description_tr: "Sanal token cuzdani ve talepler",
    description_en: "Virtual token wallet and requests",
    intents: ["token", "jeton", "coin", "treasury"],
    scenarios: ["/token", "token wallet", "jeton bakiyesi"],
    outcomes: ["token bakiye, quote ve talep durumunu goster"],
    primary: true
  },
  {
    key: "story",
    aliases: ["guide"],
    description_tr: "Hikaye ve hizli baslangic",
    description_en: "Story and quick guide",
    intents: ["story", "guide", "rehber", "yardim", "help me"],
    scenarios: ["story", "guide", "rehber"],
    outcomes: ["onboard adimlarini ve kontrat baglamini acikla"],
    primary: true
  },
  {
    key: "help",
    aliases: [],
    description_tr: "Komut listesi",
    description_en: "Command list",
    intents: ["help", "komutlar", "yardim", "commands", "command list"],
    scenarios: ["/help", "komutlar", "command list"],
    outcomes: ["primer komutlari amac+senaryo ile listeler"],
    primary: true
  },
  {
    key: "lang",
    aliases: ["dil", "language"],
    description_tr: "Bot dili tercihi (tr/en)",
    description_en: "Bot language preference (tr/en)",
    intents: ["lang", "dil", "language", "change language"],
    scenarios: ["/lang tr", "/lang en", "dil en"],
    outcomes: ["kullanici locale ayarini kalici gunceller", "yardim ve ipucu metinleri secilen dilde akar"],
    primary: true
  },
  { key: "profile", aliases: [], description_tr: "Profil karti", description_en: "Profile card", intents: [] },
  { key: "mint", aliases: [], description_tr: "SC/HC/RC -> token donustur", description_en: "Convert SC/HC/RC to token", intents: ["mint", "donustur", "convert"] },
  { key: "buytoken", aliases: [], description_tr: "Token alim talebi olustur", description_en: "Create token buy intent", intents: ["buytoken", "token buy", "token al"] },
  { key: "tx", aliases: [], description_tr: "Token alim tx hash gonder", description_en: "Submit token tx hash", intents: ["tx", "token tx"] },
  { key: "daily", aliases: ["gunluk"], description_tr: "Gunluk panel", description_en: "Daily panel", intents: ["daily", "gunluk"] },
  { key: "kingdom", aliases: [], description_tr: "Tier/reputation paneli", description_en: "Tier/reputation panel", intents: ["kingdom", "tier"] },
  { key: "season", aliases: [], description_tr: "Sezon ilerleme", description_en: "Season progress", intents: ["season", "sezon"] },
  { key: "leaderboard", aliases: [], description_tr: "Top siralama", description_en: "Top leaderboard", intents: ["leaderboard", "siralama"] },
  { key: "shop", aliases: [], description_tr: "Boost dukkani", description_en: "Boost shop", intents: ["shop", "dukkan"] },
  { key: "missions", aliases: ["misyon"], description_tr: "Misyon paneli", description_en: "Mission panel", intents: ["missions", "misyon", "mission"] },
  { key: "war", aliases: [], description_tr: "Topluluk savasi", description_en: "Community war room", intents: ["war", "savasi"] },
  { key: "streak", aliases: [], description_tr: "Streak durumu", description_en: "Streak status", intents: ["streak"] },
  { key: "status", aliases: ["durum"], description_tr: "Sistem snapshot", description_en: "System snapshot", intents: ["status", "durum"] },
  { key: "nexus", aliases: ["contract", "kontrat"], description_tr: "Nexus pulse ve kontrat", description_en: "Nexus pulse and contract", intents: ["nexus", "contract", "kontrat", "anomaly", "pulse"] },
  { key: "ops", aliases: [], description_tr: "Ops konsolu", description_en: "Ops console", intents: ["ops", "operation"] },
  { key: "onboard", aliases: [], description_tr: "3 adim hizli giris", description_en: "3-step quick onboarding", intents: ["onboard"] },
  { key: "ui_mode", aliases: [], description_tr: "UI kalite/erisilebilirlik", description_en: "UI quality/accessibility", intents: ["ui", "ui mode", "arayuz"] },
  { key: "perf", aliases: [], description_tr: "Performans + API health", description_en: "Performance + API health", intents: ["perf", "performans", "fps"] },
  { key: "raid_contract", aliases: [], description_tr: "Raid kontrat + bonus", description_en: "Raid contract + bonus", intents: ["raid contract", "raid kontrat"] },
  { key: "whoami", aliases: [], description_tr: "Telegram ID kontrolu", description_en: "Telegram ID check", intents: ["whoami"] },
  { key: "admin", aliases: [], description_tr: "Admin panel", description_en: "Admin panel", intents: ["admin"], adminOnly: true },
  { key: "admin_live", aliases: [], description_tr: "Admin canli panel", description_en: "Admin live panel", intents: ["admin live"], adminOnly: true },
  { key: "admin_queue", aliases: [], description_tr: "Birlesik admin kuyrugu", description_en: "Unified admin queue", intents: ["admin queue"], adminOnly: true },
  { key: "admin_payouts", aliases: [], description_tr: "Payout kuyrugu", description_en: "Payout queue", intents: ["admin payouts"], adminOnly: true },
  { key: "admin_tokens", aliases: [], description_tr: "Token kuyrugu", description_en: "Token queue", intents: ["admin tokens"], adminOnly: true },
  { key: "admin_metrics", aliases: [], description_tr: "Admin metrikleri", description_en: "Admin metrics", intents: ["admin metrics"], adminOnly: true },
  { key: "admin_config", aliases: [], description_tr: "Admin config ozeti", description_en: "Admin config summary", intents: ["admin config"], adminOnly: true },
  { key: "admin_gate", aliases: ["admin_token_gate"], description_tr: "Payout gate ayari", description_en: "Set payout gate", intents: ["admin gate"], adminOnly: true },
  { key: "admin_token_price", aliases: [], description_tr: "Token spot guncelle", description_en: "Update token spot", intents: [], adminOnly: true },
  { key: "admin_freeze", aliases: [], description_tr: "Freeze kontrolu", description_en: "Freeze control", intents: ["admin freeze"], adminOnly: true },
  { key: "pay", aliases: [], description_tr: "Payout paid isaretle", description_en: "Mark payout paid", intents: [], adminOnly: true },
  { key: "reject_payout", aliases: [], description_tr: "Payout reddet", description_en: "Reject payout", intents: [], adminOnly: true },
  { key: "approve_token", aliases: [], description_tr: "Token talebini onayla", description_en: "Approve token request", intents: [], adminOnly: true },
  { key: "reject_token", aliases: [], description_tr: "Token talebini reddet", description_en: "Reject token request", intents: [], adminOnly: true }
]);

const COMMAND_REGISTRY = Object.freeze(normalizeCommandRegistry(RAW_COMMAND_REGISTRY));
const VALIDATION = validateCommandRegistry(COMMAND_REGISTRY);
if (!VALIDATION.ok) {
  throw new Error(`invalid_command_registry:${VALIDATION.errors.join(",")}`);
}

function getCommandRegistry() {
  return COMMAND_REGISTRY.slice();
}

function toTelegramCommands(registryInput, lang = "tr") {
  const registry = Array.isArray(registryInput) ? registryInput : getCommandRegistry();
  const normalizedLang = normalizeLanguage(lang, "tr");
  const output = [];
  const seen = new Set();
  for (const item of registry) {
    if (!item || !item.key || seen.has(item.key)) {
      continue;
    }
    if (String(item.key).startsWith("admin_") && item.key !== "admin") {
      continue;
    }
    const description =
      normalizedLang === "en"
        ? String(item.description_en || item.description_tr || item.key)
        : String(item.description_tr || item.description_en || item.key);
    output.push({
      command: String(item.key),
      description: description.slice(0, 255)
    });
    seen.add(item.key);
  }
  return output;
}

function buildAliasLookup(registryInput) {
  const registry = Array.isArray(registryInput) ? registryInput : getCommandRegistry();
  const map = new Map();
  for (const item of registry) {
    if (!item || !item.key) {
      continue;
    }
    map.set(String(item.key).toLowerCase(), item.key);
    for (const alias of item.aliases || []) {
      map.set(String(alias || "").toLowerCase(), item.key);
    }
  }
  return map;
}

function getPrimaryCommands(registryInput) {
  const registry = Array.isArray(registryInput) ? registryInput : getCommandRegistry();
  return registry.filter((item) => item.primary);
}

module.exports = {
  getCommandRegistry,
  toTelegramCommands,
  buildAliasLookup,
  getPrimaryCommands
};




