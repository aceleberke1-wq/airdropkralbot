const { normalizeLanguage } = require("../i18n");
const { normalizeCommandRegistry, validateCommandRegistry } = require("../../../../packages/shared/src/v5/commandEngine");

const RAW_COMMAND_REGISTRY = Object.freeze([
  {
    key: "menu",
    aliases: ["start"],
    description_tr: "Ana launcher, hizli rota ve kisayol merkezi",
    description_en: "Main launcher with quick routes",
    intents: ["menu", "launcher", "start", "home", "ana menu", "ana men"],
    scenarios: ["menu", "ana menu", "start"],
    outcomes: ["launcher panelini ac", "onboard/play/tasks kisayollarini goster"],
    primary: true
  },
  {
    key: "play",
    aliases: ["arena", "arena3d"],
    description_tr: "Nexus Arena web panelini ac",
    description_en: "Open Nexus Arena web panel",
    intents: ["play", "arena", "arena 3d", "3d arena", "battle", "duel"],
    scenarios: ["/play", "arena 3d ac", "open arena"],
    outcomes: ["webapp mini app linki uret", "pvp/task/vault panelini ac"],
    primary: true
  },
  {
    key: "tasks",
    aliases: ["task", "gorev"],
    description_tr: "Gorev havuzu, sure ve odul kartlari",
    description_en: "Task pool with timer and rewards",
    intents: ["tasks", "task", "gorev", "gorevler", "quest", "quests"],
    scenarios: ["gorev", "tasks", "quest list"],
    outcomes: ["aktif gorev havuzunu goster", "kabul edilebilir offerlari listele"],
    primary: true
  },
  {
    key: "finish",
    aliases: ["bitir"],
    description_tr: "Aktif gorevi bitir (safe/balanced/aggressive mod)",
    description_en: "Finish active task (safe/balanced/aggressive)",
    intents: ["finish", "bitir", "tamamla", "complete"],
    scenarios: ["bitir dengeli", "/finish aggressive"],
    outcomes: ["aktif denemeyi kapat", "sonuc ve olasilik ozeti goster"],
    primary: true
  },
  {
    key: "reveal",
    aliases: ["revealnow"],
    description_tr: "Son biten denemenin odulunu ac",
    description_en: "Reveal reward of latest completed run",
    intents: ["reveal", "revealnow", "loot", "open loot"],
    scenarios: ["reveal", "kasa ac", "open loot"],
    outcomes: ["son biten denemenin odulunu dagit", "pity ve bakiye guncelle"],
    primary: true
  },
  {
    key: "pvp",
    aliases: ["raid"],
    description_tr: "PvP raid baslat ve kontrat puani isle",
    description_en: "Start PvP raid and process contract score",
    intents: ["pvp", "raid", "arena raid", "duel"],
    scenarios: ["/pvp", "raid aggressive", "duel baslat"],
    outcomes: ["pvp oturumu baslat", "kontrat/progression metriklerini ilerlet"],
    primary: true
  },
  {
    key: "arena_rank",
    aliases: [],
    description_tr: "Arena rating, rank ve ladder ozeti",
    description_en: "Arena rating, rank and ladder summary",
    intents: ["arena rank", "rank", "arena siralama", "leaderboard arena"],
    scenarios: ["arena rank", "/arena_rank", "pvp leaderboard"],
    outcomes: ["rating, rank ve leaderboard verisini goster"],
    primary: true
  },
  {
    key: "wallet",
    aliases: ["cuzdan"],
    description_tr: "SC/HC/RC bakiye ve gunluk cap paneli",
    description_en: "SC/HC/RC balances and daily caps",
    intents: ["wallet", "cuzdan", "balance", "balances"],
    scenarios: ["wallet", "cuzdan", "balance"],
    outcomes: ["SC/HC/RC ve gunluk cap durumunu goster"],
    primary: true
  },
  {
    key: "vault",
    aliases: ["payout"],
    description_tr: "Vault cekim paneli ve lock durumu",
    description_en: "Vault payout panel and lock status",
    intents: ["vault", "payout", "cekim", "withdraw", "cashout"],
    scenarios: ["vault", "payout", "withdraw"],
    outcomes: ["payout lock durumunu ve talep uygunlugunu goster"],
    primary: true
  },
  {
    key: "token",
    aliases: [],
    description_tr: "Token cuzdani, quote ve talep durumu",
    description_en: "Token wallet, quotes and request status",
    intents: ["token", "jeton", "coin", "treasury"],
    scenarios: ["/token", "token wallet", "jeton bakiyesi"],
    outcomes: ["token bakiye, quote ve talep durumunu goster"],
    primary: true
  },
  {
    key: "story",
    aliases: ["guide"],
    description_tr: "Hikaye akisi, onboarding ve rota rehberi",
    description_en: "Story flow, onboarding and route guide",
    intents: ["story", "guide", "rehber", "yardim", "help me"],
    scenarios: ["story", "guide", "rehber"],
    outcomes: ["onboard adimlarini ve kontrat baglamini acikla"],
    primary: true
  },
  {
    key: "help",
    aliases: [],
    description_tr: "Detayli komut kartlari ve kisayollar",
    description_en: "Detailed command cards and shortcuts",
    intents: ["help", "komutlar", "yardim", "commands", "command list"],
    scenarios: ["/help", "komutlar", "command list"],
    outcomes: ["primer komutlari amac+senaryo ile listeler"],
    primary: true
  },
  {
    key: "lang",
    aliases: ["dil", "language"],
    description_tr: "Dil tercihini kalici kaydet (tr/en)",
    description_en: "Persist language preference (tr/en)",
    intents: ["lang", "dil", "language", "change language"],
    scenarios: ["/lang tr", "/lang en", "dil en"],
    outcomes: ["kullanici locale ayarini kalici gunceller", "yardim ve ipucu metinleri secilen dilde akar"],
    primary: true
  },
  {
    key: "profile",
    aliases: [],
    description_tr: "Profil, tier, itibar ve sezon karti",
    description_en: "Profile card with tier and season",
    intents: ["profile", "profil"],
    scenarios: ["/profile", "profil", "profile"],
    outcomes: ["profil ozetini goster", "profil hub paneline gecis sagla"]
  },
  {
    key: "rewards",
    aliases: ["oduller", "loot"],
    description_tr: "Odul ozeti, entitlement ve reward vault gecisi",
    description_en: "Reward summary, entitlement and reward vault handoff",
    intents: ["rewards", "oduller", "loot", "reward center"],
    scenarios: ["/rewards", "oduller", "reward center"],
    outcomes: ["odul ozetini goster", "reward vault paneline gecis sagla"]
  },
  { key: "mint", aliases: [], description_tr: "SC/HC/RC bakiyesini tokena cevir", description_en: "Convert SC/HC/RC balances to token", intents: ["mint", "donustur", "convert"] },
  { key: "buytoken", aliases: [], description_tr: "Token alim talebi ve quote olustur", description_en: "Create token buy request and quote", intents: ["buytoken", "token buy", "token al"] },
  { key: "tx", aliases: [], description_tr: "Token talebine tx hash bagla ve dogrula", description_en: "Attach tx hash to token request", intents: ["tx", "token tx"] },
  { key: "daily", aliases: ["gunluk"], description_tr: "Gunluk haklar, cap ve odul paneli", description_en: "Daily rights, caps and rewards", intents: ["daily", "gunluk"] },
  { key: "kingdom", aliases: [], description_tr: "Tier/reputation ve progression ozeti", description_en: "Tier, reputation and progression summary", intents: ["kingdom", "tier"] },
  { key: "season", aliases: [], description_tr: "Sezon puan, hedef ve kalan gun", description_en: "Season points, goals and days left", intents: ["season", "sezon"] },
  { key: "leaderboard", aliases: [], description_tr: "Top siralama ve rank farklari", description_en: "Top leaderboard with rank deltas", intents: ["leaderboard", "siralama"] },
  {
    key: "events",
    aliases: ["event", "etkinlikler"],
    description_tr: "Canli event, war ve sezon anomali merkezi",
    description_en: "Live event, war and season anomaly center",
    intents: ["events", "event", "etkinlik", "etkinlikler", "live events"],
    scenarios: ["/events", "etkinlikler", "live events"],
    outcomes: ["event ozetini goster", "event zone deeplinkleri sun"]
  },
  {
    key: "discover",
    aliases: ["kesfet", "kesif"],
    description_tr: "Kesif, sonraki hamle ve route onerileri",
    description_en: "Discovery surface with next-step route hints",
    intents: ["discover", "kesfet", "kesif", "next step"],
    scenarios: ["/discover", "kesfet", "next step"],
    outcomes: ["sonraki hamleyi ozetle", "ilgili panel deeplinklerini goster"]
  },
  { key: "shop", aliases: [], description_tr: "Boost dukkani ve satin alma aksiyonlari", description_en: "Boost shop and purchase actions", intents: ["shop", "dukkan"] },
  { key: "missions", aliases: ["misyon"], description_tr: "Misyon listesi, claim ve ilerleme", description_en: "Mission board with claim status", intents: ["missions", "misyon", "mission"] },
  { key: "war", aliases: [], description_tr: "Topluluk savasi tier/havuz paneli", description_en: "Community war room tier/pool panel", intents: ["war", "savasi"] },
  { key: "streak", aliases: [], description_tr: "Streak seviyesi ve reset riski", description_en: "Streak level and reset risk", intents: ["streak"] },
  {
    key: "settings",
    aliases: ["ayarlar", "preferences"],
    description_tr: "Dil, accessibility ve UI tercih ozeti",
    description_en: "Language, accessibility and UI preference summary",
    intents: ["settings", "ayarlar", "preferences", "ayar"],
    scenarios: ["/settings", "ayarlar", "preferences"],
    outcomes: ["kayitli UI tercihlerini goster", "settings paneline gecis sagla"]
  },
  {
    key: "support",
    aliases: ["destek"],
    description_tr: "Trust-safe destek girisi ve issue triage",
    description_en: "Trust-safe support entry and issue triage",
    intents: ["support", "destek", "support ticket", "contact support"],
    scenarios: ["/support", "destek", "support"],
    outcomes: ["sorunu kategorize et", "status/payout/settings yardim yuzeyine yonlendir"]
  },
  {
    key: "faq",
    aliases: ["sss"],
    description_tr: "Kisa lokalize SSS kartlari",
    description_en: "Compact localized FAQ cards",
    intents: ["faq", "sss", "common issues", "questions"],
    scenarios: ["/faq", "sss", "common issues"],
    outcomes: ["sik sorulari kisa kartlarla goster", "gerekirse support akisini oner"]
  },
  { key: "status", aliases: ["durum"], description_tr: "Sistem, arena ve runtime snapshot", description_en: "System, arena and runtime snapshot", intents: ["status", "durum"] },
  { key: "nexus", aliases: ["contract", "kontrat"], description_tr: "Nexus pulse, anomaly ve aktif kontrat", description_en: "Nexus pulse, anomaly and contract", intents: ["nexus", "contract", "kontrat", "anomaly", "pulse"] },
  { key: "ops", aliases: [], description_tr: "Ops runtime, alarm ve queue ozeti", description_en: "Ops runtime, alarms and queues", intents: ["ops", "operation"] },
  { key: "onboard", aliases: [], description_tr: "3 adim hizli kurulum + sonraki hamle", description_en: "3-step onboarding with next move", intents: ["onboard"] },
  { key: "ui_mode", aliases: [], description_tr: "UI kalite, motion ve okunabilirlik", description_en: "UI quality, motion and readability", intents: ["ui", "ui mode", "arayuz"] },
  { key: "perf", aliases: [], description_tr: "Performans, fps ve API health ozeti", description_en: "Performance, FPS and API health", intents: ["perf", "performans", "fps"] },
  { key: "raid_contract", aliases: [], description_tr: "Raid kontrat hedefi ve bonuslar", description_en: "Raid contract target and bonuses", intents: ["raid contract", "raid kontrat"] },
  { key: "whoami", aliases: [], description_tr: "Telegram ID ve admin eslesme kontrolu", description_en: "Telegram ID and admin matching check", intents: ["whoami"] },
  { key: "admin", aliases: [], description_tr: "Admin paneli ve canli kuyruk gorunumu", description_en: "Admin panel and live queue view", intents: ["admin"], adminOnly: true },
  { key: "admin_live", aliases: [], description_tr: "Admin canli panel + telemetry", description_en: "Admin live panel with telemetry", intents: ["admin live"], adminOnly: true },
  { key: "admin_live_ops", aliases: [], description_tr: "Live ops campaign push paneli", description_en: "Live ops campaign push panel", intents: ["admin live ops"], adminOnly: true },
  { key: "admin_queue", aliases: [], description_tr: "Birlesik payout+token admin kuyrugu", description_en: "Unified payout+token admin queue", intents: ["admin queue"], adminOnly: true },
  { key: "admin_payouts", aliases: [], description_tr: "Payout kuyrugu ve aksiyonlari", description_en: "Payout queue and actions", intents: ["admin payouts"], adminOnly: true },
  { key: "admin_tokens", aliases: [], description_tr: "Token kuyrugu onay/red paneli", description_en: "Token queue approve/reject panel", intents: ["admin tokens"], adminOnly: true },
  { key: "admin_metrics", aliases: [], description_tr: "Admin KPI ve queue metrikleri", description_en: "Admin KPI and queue metrics", intents: ["admin metrics"], adminOnly: true },
  { key: "admin_config", aliases: [], description_tr: "Admin config, source ve runtime", description_en: "Admin config, source and runtime", intents: ["admin config"], adminOnly: true },
  { key: "admin_gate", aliases: ["admin_token_gate"], description_tr: "Payout gate lock/unlock ayari", description_en: "Set payout gate lock/unlock", intents: ["admin gate"], adminOnly: true },
  { key: "admin_token_price", aliases: [], description_tr: "Token spot fiyatini guncelle", description_en: "Update token spot price", intents: [], adminOnly: true },
  { key: "admin_freeze", aliases: [], description_tr: "Sistem freeze ac/kapat kontrolu", description_en: "Enable/disable global freeze", intents: ["admin freeze"], adminOnly: true },
  { key: "pay", aliases: [], description_tr: "Payout kaydini paid olarak isaretle", description_en: "Mark payout request as paid", intents: [], adminOnly: true },
  { key: "reject_payout", aliases: [], description_tr: "Payout talebini reddet ve notla", description_en: "Reject payout request with reason", intents: [], adminOnly: true },
  { key: "approve_token", aliases: [], description_tr: "Token talebini onayla ve aktar", description_en: "Approve token request and transfer", intents: [], adminOnly: true },
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
  const source = Array.isArray(registryInput) ? registryInput : getCommandRegistry();
  const registry = getPrimaryCommands(source);
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




