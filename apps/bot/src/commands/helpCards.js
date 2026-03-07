"use strict";

const HELP_REQUIRED_FIELDS = Object.freeze([
  "key",
  "category",
  "scope",
  "title_tr",
  "title_en",
  "purpose_tr",
  "purpose_en",
  "when_to_use_tr",
  "when_to_use_en",
  "syntax",
  "examples_tr",
  "examples_en",
  "expected_tr",
  "expected_en",
  "failures_tr",
  "failures_en",
  "related_commands"
]);

const HELP_CATEGORY_ORDER = Object.freeze(["core_loop", "economy", "progression", "system", "admin"]);

const HELP_CATEGORY_META = Object.freeze({
  core_loop: Object.freeze({
    key: "core_loop",
    label_tr: "Core Loop",
    label_en: "Core Loop",
    aliases: Object.freeze(["core", "core_loop", "loop", "temel", "dongu", "oyun akisi"])
  }),
  economy: Object.freeze({
    key: "economy",
    label_tr: "Ekonomi",
    label_en: "Economy",
    aliases: Object.freeze(["economy", "eco", "ekonomi", "token", "odul", "cuzdan"])
  }),
  progression: Object.freeze({
    key: "progression",
    label_tr: "Ilerleme",
    label_en: "Progression",
    aliases: Object.freeze(["progress", "progression", "ilerleme", "rank", "sezon", "kingdom"])
  }),
  system: Object.freeze({
    key: "system",
    label_tr: "Sistem",
    label_en: "System",
    aliases: Object.freeze(["system", "sistem", "durum", "status", "runtime", "yardimci"])
  }),
  admin: Object.freeze({
    key: "admin",
    label_tr: "Admin",
    label_en: "Admin",
    aliases: Object.freeze(["admin", "yonetim", "moderasyon", "ops_admin"])
  })
});

const HELP_CATEGORY_BY_COMMAND = Object.freeze({
  menu: "core_loop",
  play: "core_loop",
  tasks: "core_loop",
  finish: "core_loop",
  reveal: "core_loop",
  pvp: "core_loop",
  arena_rank: "core_loop",
  story: "core_loop",
  help: "core_loop",
  onboard: "core_loop",
  wallet: "economy",
  vault: "economy",
  token: "economy",
  mint: "economy",
  buytoken: "economy",
  tx: "economy",
  daily: "economy",
  shop: "economy",
  rewards: "economy",
  profile: "progression",
  kingdom: "progression",
  season: "progression",
  leaderboard: "progression",
  events: "progression",
  discover: "progression",
  missions: "progression",
  war: "progression",
  streak: "progression",
  nexus: "progression",
  raid_contract: "progression",
  lang: "system",
  settings: "system",
  support: "system",
  faq: "system",
  status: "system",
  ops: "system",
  ui_mode: "system",
  perf: "system",
  whoami: "system",
  admin: "admin",
  admin_live: "admin",
  admin_live_ops: "admin",
  admin_queue: "admin",
  admin_payouts: "admin",
  admin_tokens: "admin",
  admin_metrics: "admin",
  admin_config: "admin",
  admin_gate: "admin",
  admin_token_price: "admin",
  admin_freeze: "admin",
  pay: "admin",
  reject_payout: "admin",
  approve_token: "admin",
  reject_token: "admin"
});

const HELP_RELATIONS = Object.freeze({
  menu: Object.freeze(["onboard", "tasks", "play"]),
  play: Object.freeze(["tasks", "status", "ui_mode"]),
  tasks: Object.freeze(["finish", "reveal", "daily"]),
  finish: Object.freeze(["reveal", "tasks", "pvp"]),
  reveal: Object.freeze(["tasks", "wallet", "missions"]),
  pvp: Object.freeze(["arena_rank", "raid_contract", "nexus"]),
  arena_rank: Object.freeze(["pvp", "season", "leaderboard"]),
  wallet: Object.freeze(["vault", "token", "daily"]),
  vault: Object.freeze(["wallet", "token", "status"]),
  rewards: Object.freeze(["vault", "shop", "leaderboard"]),
  token: Object.freeze(["mint", "buytoken", "tx"]),
  mint: Object.freeze(["token", "wallet", "buytoken"]),
  buytoken: Object.freeze(["token", "tx", "vault"]),
  tx: Object.freeze(["buytoken", "token", "status"]),
  story: Object.freeze(["onboard", "tasks", "help"]),
  help: Object.freeze(["menu", "tasks", "status"]),
  lang: Object.freeze(["help", "menu", "status"]),
  profile: Object.freeze(["kingdom", "season", "streak"]),
  daily: Object.freeze(["tasks", "missions", "wallet"]),
  kingdom: Object.freeze(["profile", "season", "war"]),
  season: Object.freeze(["leaderboard", "kingdom", "arena_rank"]),
  leaderboard: Object.freeze(["season", "arena_rank", "profile"]),
  events: Object.freeze(["season", "war", "discover"]),
  discover: Object.freeze(["events", "missions", "play"]),
  shop: Object.freeze(["wallet", "missions", "tasks"]),
  missions: Object.freeze(["daily", "tasks", "reveal"]),
  war: Object.freeze(["raid_contract", "nexus", "season"]),
  streak: Object.freeze(["tasks", "profile", "daily"]),
  settings: Object.freeze(["lang", "ui_mode", "status"]),
  support: Object.freeze(["faq", "status", "settings"]),
  faq: Object.freeze(["support", "help", "status"]),
  status: Object.freeze(["perf", "ui_mode", "ops"]),
  nexus: Object.freeze(["raid_contract", "tasks", "pvp"]),
  ops: Object.freeze(["status", "perf", "admin_live"]),
  onboard: Object.freeze(["tasks", "finish", "reveal"]),
  ui_mode: Object.freeze(["perf", "play", "status"]),
  perf: Object.freeze(["status", "ui_mode", "ops"]),
  raid_contract: Object.freeze(["pvp", "war", "nexus"]),
  whoami: Object.freeze(["status", "help", "admin"]),
  admin: Object.freeze(["admin_live", "admin_queue", "admin_metrics"]),
  admin_live: Object.freeze(["admin", "admin_metrics", "admin_config"]),
  admin_live_ops: Object.freeze(["admin_live", "admin_metrics", "admin_config"]),
  admin_queue: Object.freeze(["admin_payouts", "admin_tokens", "pay"]),
  admin_payouts: Object.freeze(["admin_queue", "pay", "reject_payout"]),
  admin_tokens: Object.freeze(["admin_queue", "approve_token", "reject_token"]),
  admin_metrics: Object.freeze(["admin_live", "admin_queue", "admin_config"]),
  admin_config: Object.freeze(["admin_metrics", "admin_gate", "admin_token_price"]),
  admin_gate: Object.freeze(["admin_config", "admin_metrics", "vault"]),
  admin_token_price: Object.freeze(["admin_config", "token", "buytoken"]),
  admin_freeze: Object.freeze(["admin", "status", "ops"]),
  pay: Object.freeze(["admin_payouts", "reject_payout", "admin_queue"]),
  reject_payout: Object.freeze(["admin_payouts", "pay", "admin_queue"]),
  approve_token: Object.freeze(["admin_tokens", "reject_token", "admin_queue"]),
  reject_token: Object.freeze(["admin_tokens", "approve_token", "admin_queue"])
});

const HELP_COPY_OVERRIDES = Object.freeze({
  tasks: Object.freeze({
    purpose_tr: "Aktif gorev havuzunu acar, sure/odul dengesini gosterir ve kabul aksiyonuna gecis saglar.",
    purpose_en: "Opens task pool and prepares accept flow.",
    when_to_use_tr: "Donguyu baslatmak, RC verimliligini artirmak veya yeni lineup cekmek istediginde kullan.",
    when_to_use_en: "Use it when starting or refreshing the task loop."
  }),
  finish: Object.freeze({
    purpose_tr: "Aktif denemeyi secili mod ile kapatir; risk-odul sonucu, puan ve zincir etkisini hesaplar.",
    purpose_en: "Closes active run with selected mode and computes result.",
    when_to_use_tr: "Aktif gorev acikken safe/balanced/aggressive kararini vermek icin kullan.",
    when_to_use_en: "Use when an active task exists and mode decision is needed."
  }),
  reveal: Object.freeze({
    purpose_tr: "Bitmis denemenin odulunu finalize eder; pity, bakiye, sezon ve yan metrikleri gunceller.",
    purpose_en: "Finalizes reward claim and updates pity/balances.",
    when_to_use_tr: "Finish sonrasi kasa acma adiminda tek dogru komuttur.",
    when_to_use_en: "Use right after finish to reveal rewards."
  }),
  vault: Object.freeze({
    purpose_tr: "Payout uygunlugu, lock durumu, drip limiti ve son cekim detaylarini tek panelde sunar.",
    purpose_en: "Shows payout eligibility, lock and drip limits.",
    when_to_use_tr: "Cekim talebi oncesi risk ve limit kontrolu icin kullan.",
    when_to_use_en: "Use before payout request to verify limits."
  }),
  tx: Object.freeze({
    purpose_tr: "Token alim talebine zincir TX hash baglar; dogrulama moduna gore onay surecini tetikler.",
    purpose_en: "Attaches on-chain tx hash to token buy request.",
    when_to_use_tr: "Buytoken odemesi yapildiktan sonra talebi finalize etmek icin kullan.",
    when_to_use_en: "Use after payment to complete token buy request."
  }),
  status: Object.freeze({
    purpose_tr: "Runtime snapshot, queue sinyali, performans hizi ve kritik flag durumunu tek raporda verir.",
    purpose_en: "Provides runtime snapshot and critical flag state.",
    when_to_use_tr: "Sistem sagligini hizli kontrol etmek veya anomali triage icin kullan.",
    when_to_use_en: "Use for quick health and anomaly triage."
  }),
  admin_queue: Object.freeze({
    purpose_tr: "Payout ve token taleplerini tek kuyruk modelinde toplar; aksiyon zincirini hizlandirir.",
    purpose_en: "Unifies payout and token queues for admin actions.",
    when_to_use_tr: "Canary veya yogun saatlerde kuyruk sikisikligini tek panelden yonetmek icin kullan.",
    when_to_use_en: "Use during queue pressure to control actions from one panel."
  }),
  admin_live_ops: Object.freeze({
    purpose_tr: "Canli campaign push konfigunu kaydeder, segment secimini dogrular ve dry-run/canli gonderim akislarini yonetir.",
    purpose_en: "Controls live campaign push config, segment targeting and dry-run/live dispatch flows.",
    when_to_use_tr: "Re-engagement veya segment bazli chat campaign'i engineering'e dokunmadan yonetmek istediginde kullan.",
    when_to_use_en: "Use when operating re-engagement or segment-based chat campaigns without engineering changes."
  }),
  admin_gate: Object.freeze({
    purpose_tr: "Payout gate esigini/targetini gunceller; acilim kararini market cap ve drip ile hizalar.",
    purpose_en: "Updates payout gate thresholds and opening logic.",
    when_to_use_tr: "Payout unlock stratejisini yeni piyasa bandina tasimak istediginde kullan.",
    when_to_use_en: "Use when payout unlock strategy must be retuned."
  })
});

const CATEGORY_USAGE_HINT = Object.freeze({
  core_loop: Object.freeze({
    tr: "Task -> Finish -> Reveal ana omurgasinda hizli karar almak icin kullan.",
    en: "Use in the Task -> Finish -> Reveal core loop."
  }),
  economy: Object.freeze({
    tr: "Bakiye, payout ve token akisinda risk/limit kontrolu gerektiginde kullan.",
    en: "Use for balance, payout and token flow checks."
  }),
  progression: Object.freeze({
    tr: "Tier, sezon, ladder ve kontrat ilerlemesini takip etmek istediginde kullan.",
    en: "Use to track tier, season and ladder progression."
  }),
  system: Object.freeze({
    tr: "Dil, runtime ve performans gozlemi gibi operasyonel yardim adimlarinda kullan.",
    en: "Use for language, runtime and performance operations."
  }),
  admin: Object.freeze({
    tr: "Kritik kuyruk aksiyonlari, policy degisiklikleri ve canli operasyon yonetimi icin kullan.",
    en: "Use for critical queue actions and live admin operations."
  })
});

const CATEGORY_OPERATIONAL_CONTEXT = Object.freeze({
  core_loop: Object.freeze({
    tr: "Core loop temposunu korur; gorev kabul, bitirme ve reveal arasinda kayip adimlari kapatir.",
    en: "Keeps core loop tempo and removes gaps between accept/finish/reveal."
  }),
  economy: Object.freeze({
    tr: "Ekonomi akisinda bakiye, quote, payout ve zincir baglantisini ayni operasyon hattinda toplar.",
    en: "Keeps balances, quotes, payouts and chain proof in one economy operation line."
  }),
  progression: Object.freeze({
    tr: "Ilerleme metriklerini tek noktada toplar; tier, sezon ve rank kararlarini hizlandirir.",
    en: "Unifies progression metrics to speed up tier/season/rank decisions."
  }),
  system: Object.freeze({
    tr: "Sistem ve performans triage adimlarini standartlastirir; runtime sinyallerini okunur tutar.",
    en: "Standardizes system/performance triage and keeps runtime signals readable."
  }),
  admin: Object.freeze({
    tr: "Canli operasyonlarda kuyruk, policy ve onay aksiyonlarini audit iziyle birlikte yonetir.",
    en: "Operates queue/policy/approval actions with auditable admin traces."
  })
});

const HELP_SYNTAX_OVERRIDES = Object.freeze({
  menu: Object.freeze(["/menu", "/start", "/menu"]),
  play: Object.freeze(["/play", "/play"]),
  tasks: Object.freeze(["/tasks", "/gorev", "tasks"]),
  finish: Object.freeze(["/finish <safe|balanced|aggressive>", "/finish balanced", "bitir dengeli"]),
  reveal: Object.freeze(["/reveal", "reveal", "kasa ac"]),
  pvp: Object.freeze(["/pvp <safe|balanced|aggressive>", "/pvp aggressive", "raid balanced"]),
  arena_rank: Object.freeze(["/arena_rank", "arena rank", "pvp leaderboard"]),
  wallet: Object.freeze(["/wallet", "/cuzdan", "balance"]),
  vault: Object.freeze(["/vault", "/payout", "withdraw"]),
  token: Object.freeze(["/token", "token wallet", "jeton bakiyesi"]),
  story: Object.freeze(["/story", "/guide", "rehber"]),
  help: Object.freeze(["/help", "/help <komut>", "/help <kategori>"]),
  lang: Object.freeze(["/lang <tr|en>", "/lang tr", "/lang en"]),
  profile: Object.freeze(["/profile", "profile", "/profile"]),
  mint: Object.freeze(["/mint", "/mint <tokenAmount>", "/mint 25"]),
  buytoken: Object.freeze(["/buytoken <usd> <chain>", "/buytoken 5 TON", "/buytoken 25 TRX"]),
  tx: Object.freeze(["/tx <requestId> <txHash>", "/tx 104 0xabc123...", "/tx 88 <hash>"]),
  daily: Object.freeze(["/daily", "/gunluk", "daily"]),
  kingdom: Object.freeze(["/kingdom", "kingdom", "tier"]),
  season: Object.freeze(["/season", "sezon", "season"]),
  leaderboard: Object.freeze(["/leaderboard", "siralama", "leaderboard"]),
  shop: Object.freeze(["/shop", "dukkan", "shop"]),
  missions: Object.freeze(["/missions", "misyon", "mission"]),
  war: Object.freeze(["/war", "war room", "savasi"]),
  streak: Object.freeze(["/streak", "streak", "/streak"]),
  status: Object.freeze(["/status", "/durum", "status"]),
  nexus: Object.freeze(["/nexus", "nexus pulse", "kontrat"]),
  ops: Object.freeze(["/ops", "ops", "operation"]),
  onboard: Object.freeze(["/onboard", "onboard", "/onboard"]),
  ui_mode: Object.freeze(["/ui_mode", "ui mode", "arayuz"]),
  perf: Object.freeze(["/perf", "perf", "performans"]),
  raid_contract: Object.freeze(["/raid_contract", "raid contract", "raid kontrat"]),
  whoami: Object.freeze(["/whoami", "whoami", "/whoami"]),
  admin: Object.freeze(["/admin", "admin", "/admin"]),
  admin_live: Object.freeze(["/admin_live", "admin live", "/admin_live"]),
  admin_queue: Object.freeze(["/admin_queue", "admin queue", "/admin_queue"]),
  admin_payouts: Object.freeze(["/admin_payouts", "admin payouts", "/admin_payouts"]),
  admin_tokens: Object.freeze(["/admin_tokens", "admin tokens", "/admin_tokens"]),
  admin_metrics: Object.freeze(["/admin_metrics", "admin metrics", "/admin_metrics"]),
  admin_config: Object.freeze(["/admin_config", "admin config", "/admin_config"]),
  admin_gate: Object.freeze([
    "/admin_gate <minCapUsd> [targetMaxUsd] [dailyDripPct]",
    "/admin_gate confirm 20000000 50000000 1.5",
    "/admin_gate 20000000"
  ]),
  admin_token_price: Object.freeze(["/admin_token_price <usdPrice>", "/admin_token_price 0.0005", "/admin_token_price 0.001"]),
  admin_freeze: Object.freeze([
    "/admin_freeze on <reason>",
    "/admin_freeze confirm on <reason>",
    "/admin_freeze off"
  ]),
  pay: Object.freeze(["/pay <requestId> <txHash>", "/pay confirm <requestId> <txHash>", "/pay 412 0xabc123..."]),
  reject_payout: Object.freeze([
    "/reject_payout <requestId> <reason>",
    "/reject_payout confirm <requestId> <reason>",
    "/reject_payout 412 duplicate_wallet"
  ]),
  approve_token: Object.freeze(["/approve_token <requestId> [note]", "/approve_token 77 ok", "/approve_token 77"]),
  reject_token: Object.freeze(["/reject_token <requestId> <reason>", "/reject_token 77 bad_tx", "/reject_token 77 risk_signal"])
});

const HELP_FAILURE_HINT_OVERRIDES = Object.freeze({
  mint: Object.freeze({
    tr: Object.freeze(["Yetersiz birim: SC/HC/RC havuzunda mint hedefini karsilayan bakiye yok."]),
    en: Object.freeze(["Insufficient units: SC/HC/RC pool cannot cover mint target."])
  }),
  buytoken: Object.freeze({
    tr: Object.freeze(["USD veya chain gecersiz: /buytoken <usd> <chain> formatini kullan.", "Min/Max USD bandi disinda talep olusturuldu."]),
    en: Object.freeze(["Invalid usd/chain: use /buytoken <usd> <chain>.", "Request is outside configured min/max USD band."])
  }),
  tx: Object.freeze({
    tr: Object.freeze(["TX hash formati zincire uymuyor veya request baska kullaniciya ait."]),
    en: Object.freeze(["TX hash format mismatches chain or request belongs to another user."])
  }),
  admin_gate: Object.freeze({
    tr: Object.freeze(["Min cap gecersiz: ilk parametre pozitif sayi olmali.", "Confirm adimi atlandiysa komut policy guard tarafindan durdurulur."]),
    en: Object.freeze(["Invalid min cap: first argument must be a positive number.", "If confirm step is skipped, policy guard blocks execution."])
  }),
  admin_token_price: Object.freeze({
    tr: Object.freeze(["Fiyat 0-10 USD araliginda olmali."]),
    en: Object.freeze(["Price must be within 0-10 USD range."])
  }),
  admin_freeze: Object.freeze({
    tr: Object.freeze(["Mode yalnizca on veya off olabilir.", "Freeze on aksiyonunda reason verilmezse audit izi zayiflar."]),
    en: Object.freeze(["Mode must be either on or off.", "Freeze-on without reason weakens audit trace."])
  }),
  pay: Object.freeze({
    tr: Object.freeze(["Talep rejected ise paid aksiyonu reddedilir.", "Onay adimi gecilmeden kritik islem uygulanmaz."]),
    en: Object.freeze(["Paid action is rejected when request is already rejected.", "Critical action is blocked without confirm step."])
  }),
  reject_payout: Object.freeze({
    tr: Object.freeze(["Talep paid ise reject uygulanmaz.", "Bos reason yerine operasyonel bir kod gir (orn: duplicate_wallet)."]),
    en: Object.freeze(["Reject cannot run when request is already paid.", "Use an operational reason code (e.g. duplicate_wallet)."])
  }),
  approve_token: Object.freeze({
    tr: Object.freeze(["Talepte tx hash yoksa onay bloklanir.", "Strict verify aciksa zincirde bulunamayan tx reddedilir."]),
    en: Object.freeze(["Approval is blocked when request has no tx hash.", "With strict verify, tx not found on-chain is rejected."])
  }),
  reject_token: Object.freeze({
    tr: Object.freeze(["Talep zaten approved ise reject engellenir."]),
    en: Object.freeze(["Reject is blocked when request is already approved."])
  })
});

const ADMIN_CONFIRM_COMMANDS = new Set(["admin_gate", "admin_freeze", "pay", "reject_payout"]);
const ARG_SENSITIVE_COMMANDS = new Set([
  "finish",
  "pvp",
  "mint",
  "buytoken",
  "tx",
  "lang",
  "admin_gate",
  "admin_token_price",
  "admin_freeze",
  "pay",
  "reject_payout",
  "approve_token",
  "reject_token"
]);

const COMMAND_RUNTIME_PANEL_HINTS = Object.freeze({
  tr: Object.freeze({
    core_loop: "launcher/task paneli",
    economy: "wallet/vault/token paneli",
    progression: "profile/season paneli",
    system: "status/ops paneli",
    admin: "admin queue paneli"
  }),
  en: Object.freeze({
    core_loop: "launcher/task panel",
    economy: "wallet/vault/token panel",
    progression: "profile/season panel",
    system: "status/ops panel",
    admin: "admin queue panel"
  })
});

const EXPECTED_CATEGORY_HINTS = Object.freeze({
  core_loop: Object.freeze({
    tr: "Yanitta sonraki hamle butonlari ve aktif deneme durumu birlikte guncellenir.",
    en: "Response includes next-action buttons and current run state."
  }),
  economy: Object.freeze({
    tr: "Bakiye/payout/token panelleri ayni cevapta risk-limit sinyali ile gelir.",
    en: "Balance/payout/token panels include risk-limit signals in the same response."
  }),
  progression: Object.freeze({
    tr: "Tier-sezon-rank metrikleri ayni kartta okunur ve trend gorunur.",
    en: "Tier/season/rank metrics are shown together with trend visibility."
  }),
  system: Object.freeze({
    tr: "Runtime/perf sinyalleri triage icin tek raporda toplanir.",
    en: "Runtime/perf signals are grouped into one triage report."
  }),
  admin: Object.freeze({
    tr: "Queue/policy sonucu admin audit izi ile birlikte yansir.",
    en: "Queue/policy outcome is reflected with admin audit trace."
  })
});

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/[^a-z0-9_ /-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values = []) {
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const next = String(raw || "").trim();
    if (!next || seen.has(next)) {
      continue;
    }
    out.push(next);
    seen.add(next);
  }
  return out;
}

function toSyntaxExample(value, commandKey) {
  const text = String(value || "").trim();
  if (!text) {
    return `/${commandKey}`;
  }
  if (text.startsWith("/")) {
    return text;
  }
  if (!text.includes(" ")) {
    return `/${text}`;
  }
  return text;
}

function toRelatedChain(commandKey, max = 3) {
  return uniqueStrings(HELP_RELATIONS[String(commandKey || "")] || []).slice(0, Math.max(1, Number(max || 3)));
}

function formatChainList(commandKey, lang = "tr", max = 3) {
  const related = toRelatedChain(commandKey, max);
  if (related.length === 0) {
    return "";
  }
  const slashList = related.map((row) => `/${row}`).join(" -> ");
  return lang === "en" ? `Flow chain: ${slashList}.` : `Akis zinciri: ${slashList}.`;
}

function resolveSyntaxSet(command, commandKey) {
  const overrideRows = Array.isArray(HELP_SYNTAX_OVERRIDES[commandKey]) ? HELP_SYNTAX_OVERRIDES[commandKey] : [];
  const scenarioRows = Array.isArray(command?.scenarios) ? command.scenarios : [];
  return uniqueStrings([
    ...overrideRows.map((row) => toSyntaxExample(row, commandKey)),
    ...scenarioRows.map((row) => toSyntaxExample(row, commandKey)),
    toSyntaxExample(`/${commandKey}`, commandKey)
  ]).slice(0, 4);
}

function buildFlowChain(commandKey, lang = "tr", includeSelf = true) {
  const related = toRelatedChain(commandKey, 3);
  if (related.length === 0) {
    return "";
  }
  const nodes = includeSelf ? [`/${commandKey}`, ...related.map((row) => `/${row}`)] : related.map((row) => `/${row}`);
  if (lang === "en") {
    return `Flow chain: ${nodes.join(" -> ")}.`;
  }
  return `Akis zinciri: ${nodes.join(" -> ")}.`;
}

function buildPurposeText(command, commandKey, category, scope, lang = "tr", override = "") {
  if (override) {
    return String(override);
  }
  const description = String(
    lang === "en" ? command?.description_en || command?.description_tr || commandKey : command?.description_tr || command?.description_en || commandKey
  );
  const categoryContext = CATEGORY_OPERATIONAL_CONTEXT[category] || CATEGORY_OPERATIONAL_CONTEXT.system;
  const scopeLine =
    scope === "admin"
      ? lang === "en"
        ? "Runs on admin rail with confirmation/cooldown policy gates."
        : "Admin rail uzerinde policy, onay ve cooldown kapilariyla calisir."
      : lang === "en"
        ? "Keeps player flow stable and exposes the safest next step."
        : "Oyuncu akisinda kararliligi korur ve en guvenli sonraki adimi gosterir.";
  const flow = buildFlowChain(commandKey, lang, true);
  const ctx = lang === "en" ? categoryContext.en : categoryContext.tr;
  return `${description}. ${ctx} ${scopeLine}${flow ? ` ${flow}` : ""}`.trim();
}

function buildWhenToUseText(commandKey, category, scope, lang = "tr", override = "") {
  if (override) {
    return String(override);
  }
  const categoryHint = CATEGORY_USAGE_HINT[category] || CATEGORY_USAGE_HINT.system;
  const opLine =
    scope === "admin"
      ? lang === "en"
        ? "Prefer this during canary/live-ops windows when queue pressure or policy drift is observed."
        : "Kuyruk baskisi veya policy sapmasi goruldugunde canary/canli operasyon penceresinde tercih et."
      : lang === "en"
        ? "Use it when you need deterministic next-step guidance without breaking loop context."
        : "Loop baglamini bozmadan deterministik sonraki adim yonlendirmesi gerektiginde kullan.";
  const flow = buildFlowChain(commandKey, lang, false);
  const base = lang === "en" ? categoryHint.en : categoryHint.tr;
  return `${base} ${opLine}${flow ? ` ${flow}` : ""}`.trim();
}

function toExampleSet(command, commandKey, syntaxRows = [], lang = "tr") {
  const scenarios = Array.isArray(command.scenarios) ? command.scenarios : [];
  const intentSeed = Array.isArray(command.intents) ? command.intents : [];
  const syntaxes = uniqueStrings([...(Array.isArray(syntaxRows) ? syntaxRows : []), ...scenarios.map((row) => toSyntaxExample(row, commandKey))]).slice(0, 3);
  const slash = syntaxes.length > 0 ? syntaxes[0] : `/${commandKey}`;
  const plainIntent = intentSeed.find((x) => !String(x || "").startsWith("/")) || commandKey;
  if (lang === "en") {
    return uniqueStrings([
      slash,
      syntaxes[1] || plainIntent,
      `text: ${plainIntent}`
    ]).slice(0, 3);
  }
  return uniqueStrings([
    slash,
    syntaxes[1] || plainIntent,
    `metin: ${plainIntent}`
  ]).slice(0, 3);
}

function toExpectedSet(command, commandKey, category, lang = "tr") {
  const outcomes = Array.isArray(command.outcomes) ? command.outcomes : [];
  const categoryHint = EXPECTED_CATEGORY_HINTS[category] || EXPECTED_CATEGORY_HINTS.system;
  const flow = buildFlowChain(commandKey, lang, false);
  const mapped = outcomes
    .slice(0, 2)
    .map((row) => {
      const text = String(row || "").trim();
      if (!text) {
        return "";
      }
      return lang === "en" ? `${text}.` : `${text}.`;
    })
    .filter(Boolean);
  if (lang === "en") {
    return uniqueStrings([
      ...mapped,
      categoryHint.en,
      flow || "Related quick actions are surfaced in the same response."
    ]);
  }
  return uniqueStrings([
    ...mapped,
    categoryHint.tr,
    flow || "Yanitta ilgili bir sonraki adim komutlari da onerilir.",
    formatChainList(commandKey, "tr", 3)
  ]);
}

function toFailureSet(command, scope = "player", lang = "tr") {
  const key = String(command.key || "");
  if (lang === "en") {
    const base = [
      "Invalid arguments: check syntax and required parameters.",
      "Rate/cooldown guard: retry after waiting."
    ];
    if (scope === "admin") {
      base.push("Permission/confirmation required for critical admin actions.");
    }
    if (ARG_SENSITIVE_COMMANDS.has(key)) {
      base.push("Argument mismatch: validate required parameters and argument order.");
    }
    if (ADMIN_CONFIRM_COMMANDS.has(key)) {
      base.push("Critical command may require explicit `confirm` prefix.");
    }
    if (key === "tx") {
      base.push("Request mismatch or malformed hash: verify request id + chain hash.");
    }
    const extras = HELP_FAILURE_HINT_OVERRIDES[key]?.en || [];
    return uniqueStrings([...base, ...extras]).slice(0, 5);
  }
  const base = [
    "Arguman hatasi: komut soz dizimini ve zorunlu parametreleri kontrol et.",
    "Cooldown/rate limit: kisa sure bekleyip tekrar dene."
  ];
  if (scope === "admin") {
    base.push("Yetki/onay eksigi: kritik admin aksiyonlarinda iki adimli onay gerekir.");
  }
  if (ARG_SENSITIVE_COMMANDS.has(key)) {
    base.push("Arguman sirasi bozulduysa komut beklenen kontrata gore reddedilir.");
  }
  if (ADMIN_CONFIRM_COMMANDS.has(key)) {
    base.push("Kritik komutta `confirm` adimi policy tarafindan zorunlu olabilir.");
  }
  if (key === "tx") {
    base.push("Talep-hash uyumsuzlugu: request id ve zincir hash formatini dogrula.");
  }
  const extras = HELP_FAILURE_HINT_OVERRIDES[key]?.tr || [];
  return uniqueStrings([...base, ...extras]).slice(0, 5);
}

function buildOperationFlow(commandKey, category, scope, syntaxRows = [], lang = "tr") {
  const panelHint = COMMAND_RUNTIME_PANEL_HINTS[lang]?.[category] || COMMAND_RUNTIME_PANEL_HINTS.tr[category] || "panel";
  const firstSyntax = Array.isArray(syntaxRows) && syntaxRows.length > 0 ? String(syntaxRows[0]) : `/${commandKey}`;
  const chain = toRelatedChain(commandKey, 2);
  const chainText = chain.length > 0 ? chain.map((row) => `/${row}`).join(" -> ") : "/help";

  if (lang === "en") {
    const rows = [
      `Check current state on ${panelHint}.`,
      `Execute with canonical syntax: ${firstSyntax}.`,
      `Validate output, then continue via ${chainText}.`
    ];
    if (scope === "admin") {
      rows.push("For critical actions, complete confirmation/cooldown policy.");
    }
    if (ARG_SENSITIVE_COMMANDS.has(commandKey)) {
      rows.push("Keep argument order strict.");
    }
    return uniqueStrings(rows).slice(0, 4);
  }

  const rows = [
    `${panelHint} uzerinden anlik durumu kontrol et ve komut baglamini dogrula.`,
    `Kanonik soz dizimiyle calistir: ${firstSyntax}.`,
    `Yanit durumunu dogrula ve ${chainText} zinciriyle devam et.`
  ];
  if (scope === "admin") {
    rows.push("Kritik aksiyonlarda confirm/cooldown policy adimini tamamlamadan tekrar deneme.");
  }
  if (ARG_SENSITIVE_COMMANDS.has(commandKey)) {
    rows.push("Arguman sirasini sabit tut; parametreler pozisyoneldir.");
  }
  return uniqueStrings(rows).slice(0, 4);
}

function buildDecisionGuards(commandKey, category, scope, lang = "tr") {
  const rows = [];
  const isAdmin = scope === "admin";
  if (lang === "en") {
    rows.push("Stop if output indicates freeze/lock/permission mismatch.");
    rows.push("If stale, refresh status panel and rerun with deterministic args.");
    if (category === "economy") {
      rows.push("Before irreversible transfers, verify limits and request ownership.");
    }
    if (category === "core_loop") {
      rows.push("Keep order strict in the core loop to avoid state drift.");
    }
    if (isAdmin) {
      rows.push("Admin rail requires actor match and may require `confirm`.");
    }
    if (commandKey === "tx") {
      rows.push("Only bind tx hash after buy request id is confirmed for current user.");
    }
    return uniqueStrings(rows).slice(0, 4);
  }

  rows.push("Yanit freeze/lock/yetki uyusmazligi veriyorsa bir sonraki adima gecme.");
  rows.push("Yanit stale ise once durum panelini yenile, sonra deterministik argumanla tekrar dene.");
  if (category === "economy") {
    rows.push("Geri donulemez transferlerden once limit, quote yasi ve talep sahipligini dogrula.");
  }
  if (category === "core_loop") {
    rows.push("State kaymasini engellemek icin core loop sirasini bozma.");
  }
  if (isAdmin) {
    rows.push("Admin rail actor eslesmesi ister ve kritik komutlarda `confirm` zorlayabilir.");
  }
  if (commandKey === "tx") {
    rows.push("TX hash baglamadan once buy request id'nin mevcut kullaniciya ait oldugunu teyit et.");
  }
  return uniqueStrings(rows).slice(0, 4);
}

function resolveCategoryForCommand(commandKey) {
  const fromMap = HELP_CATEGORY_BY_COMMAND[String(commandKey || "")];
  if (fromMap && HELP_CATEGORY_META[fromMap]) {
    return fromMap;
  }
  return String(commandKey || "").startsWith("admin_") || String(commandKey || "") === "admin" ? "admin" : "system";
}

function resolveScopeForCommand(command) {
  return command?.adminOnly ? "admin" : "player";
}

function buildCardFromCommand(command) {
  const key = String(command?.key || "").trim();
  const category = resolveCategoryForCommand(key);
  const scope = resolveScopeForCommand(command);
  const override = HELP_COPY_OVERRIDES[key] || {};
  const syntax = resolveSyntaxSet(command, key);
  const operationFlowTr = buildOperationFlow(key, category, scope, syntax, "tr");
  const operationFlowEn = buildOperationFlow(key, category, scope, syntax, "en");
  const decisionGuardsTr = buildDecisionGuards(key, category, scope, "tr");
  const decisionGuardsEn = buildDecisionGuards(key, category, scope, "en");
  return {
    key,
    category,
    scope,
    title_tr: String(override.title_tr || `/${key} komut karti`),
    title_en: String(override.title_en || `/${key} command card`),
    purpose_tr: String(buildPurposeText(command, key, category, scope, "tr", override.purpose_tr)),
    purpose_en: String(buildPurposeText(command, key, category, scope, "en", override.purpose_en)),
    when_to_use_tr: String(buildWhenToUseText(key, category, scope, "tr", override.when_to_use_tr)),
    when_to_use_en: String(buildWhenToUseText(key, category, scope, "en", override.when_to_use_en)),
    syntax,
    examples_tr: toExampleSet(command, key, syntax, "tr"),
    examples_en: toExampleSet(command, key, syntax, "en"),
    expected_tr: toExpectedSet(command, key, category, "tr"),
    expected_en: toExpectedSet(command, key, category, "en"),
    failures_tr: toFailureSet(command, scope, "tr"),
    failures_en: toFailureSet(command, scope, "en"),
    operation_flow_tr: operationFlowTr,
    operation_flow_en: operationFlowEn,
    decision_guards_tr: decisionGuardsTr,
    decision_guards_en: decisionGuardsEn,
    related_commands: uniqueStrings(HELP_RELATIONS[key] || []).filter((row) => row !== key).slice(0, 5)
  };
}

function validateCardShape(card) {
  if (!card || typeof card !== "object") {
    return "invalid_card_object";
  }
  for (const field of HELP_REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(card, field)) {
      return `missing_field:${field}`;
    }
  }
  if (!HELP_CATEGORY_META[card.category]) {
    return `invalid_category:${card.key}`;
  }
  if (!["player", "admin"].includes(String(card.scope || ""))) {
    return `invalid_scope:${card.key}`;
  }
  const arrays = ["syntax", "examples_tr", "examples_en", "expected_tr", "expected_en", "failures_tr", "failures_en", "related_commands"];
  for (const key of arrays) {
    if (!Array.isArray(card[key]) || card[key].length === 0) {
      return `invalid_array:${card.key}:${key}`;
    }
  }
  return "";
}

function buildHelpCards(registryInput = []) {
  const seen = new Set();
  const cards = [];
  for (const command of Array.isArray(registryInput) ? registryInput : []) {
    const key = String(command?.key || "").trim();
    if (!key || seen.has(key)) {
      continue;
    }
    const card = buildCardFromCommand(command);
    const shapeError = validateCardShape(card);
    if (shapeError) {
      throw new Error(`invalid_help_card:${shapeError}`);
    }
    cards.push(card);
    seen.add(key);
  }
  return cards;
}

function buildHelpCardMap(cardsInput = []) {
  const map = new Map();
  for (const card of Array.isArray(cardsInput) ? cardsInput : []) {
    if (!card || !card.key || map.has(card.key)) {
      continue;
    }
    map.set(String(card.key), card);
  }
  return map;
}

function validateHelpCardsCoverage(registryInput = [], cardsInput = []) {
  const registryKeys = new Set((Array.isArray(registryInput) ? registryInput : []).map((row) => String(row?.key || "").trim()).filter(Boolean));
  const cardKeys = new Set((Array.isArray(cardsInput) ? cardsInput : []).map((row) => String(row?.key || "").trim()).filter(Boolean));
  const missing = [];
  const orphan = [];
  for (const key of registryKeys) {
    if (!cardKeys.has(key)) {
      missing.push(key);
    }
  }
  for (const key of cardKeys) {
    if (!registryKeys.has(key)) {
      orphan.push(key);
    }
  }
  return {
    ok: missing.length === 0 && orphan.length === 0,
    missing: missing.sort(),
    orphan: orphan.sort()
  };
}

function categoryLabel(categoryKey, lang = "tr") {
  const category = HELP_CATEGORY_META[String(categoryKey || "")];
  if (!category) {
    return "";
  }
  return String(lang || "tr").toLowerCase().startsWith("en") ? category.label_en : category.label_tr;
}

function getHelpCategories(options = {}) {
  const includeAdmin = options.includeAdmin === true;
  return HELP_CATEGORY_ORDER.filter((key) => includeAdmin || key !== "admin").map((key) => HELP_CATEGORY_META[key]);
}

function resolveHelpCategory(query, options = {}) {
  const includeAdmin = options.includeAdmin === true;
  const normalized = normalizeToken(query);
  if (!normalized) {
    return "";
  }
  for (const key of HELP_CATEGORY_ORDER) {
    if (!includeAdmin && key === "admin") {
      continue;
    }
    const category = HELP_CATEGORY_META[key];
    const aliases = uniqueStrings([category.key, ...(category.aliases || [])]).map((value) => normalizeToken(value));
    if (aliases.includes(normalized)) {
      return key;
    }
  }
  return "";
}

function editDistance(leftValue, rightValue) {
  const left = String(leftValue || "");
  const right = String(rightValue || "");
  if (!left || !right) {
    return Number.MAX_SAFE_INTEGER;
  }
  const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) {
    rows[i][0] = i;
  }
  for (let j = 0; j <= right.length; j += 1) {
    rows[0][j] = j;
  }
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }
  return rows[left.length][right.length];
}

function suggestHelpKeys(rawQuery, options = {}) {
  const includeAdmin = options.includeAdmin === true;
  const cards = Array.isArray(options.cards) ? options.cards : [];
  const aliasLookup = options.aliasLookup instanceof Map ? options.aliasLookup : new Map();
  const limit = Math.max(1, Math.min(8, Number(options.limit || 4)));
  const normalized = normalizeToken(rawQuery);
  if (!normalized) {
    return [];
  }
  const scoreMap = new Map();
  for (const card of cards) {
    if (!card || !card.key) {
      continue;
    }
    if (!includeAdmin && card.scope === "admin") {
      continue;
    }
    const key = String(card.key);
    const normalizedKey = normalizeToken(key);
    let score = 99;
    if (normalizedKey === normalized) {
      score = 0;
    } else if (normalizedKey.startsWith(normalized) || normalized.startsWith(normalizedKey)) {
      score = 1;
    } else if (normalizedKey.includes(normalized) || normalized.includes(normalizedKey)) {
      score = 2;
    } else {
      const distance = editDistance(normalized, normalizedKey);
      if (distance <= 2) {
        score = 3 + distance;
      }
    }
    if (score < 99) {
      scoreMap.set(key, Math.min(scoreMap.get(key) ?? 99, score));
    }
  }
  for (const [alias, mapped] of aliasLookup.entries()) {
    const normalizedAlias = normalizeToken(alias);
    if (!normalizedAlias) {
      continue;
    }
    const mappedKey = String(mapped || "");
    if (!mappedKey || !scoreMap.has(mappedKey)) {
      continue;
    }
    if (normalizedAlias === normalized) {
      scoreMap.set(mappedKey, 0);
    } else if (normalizedAlias.startsWith(normalized)) {
      scoreMap.set(mappedKey, Math.min(scoreMap.get(mappedKey), 1));
    }
  }
  return Array.from(scoreMap.entries())
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map((row) => row[0]);
}

function toQueryCandidates(rawQuery) {
  const normalized = normalizeToken(rawQuery);
  if (!normalized) {
    return [];
  }
  const cleaned = normalized.replace(/^\/+/, "");
  const out = new Set();
  out.add(cleaned);
  out.add(cleaned.replace(/\s+/g, "_"));
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length > 0) {
    out.add(words[0]);
    out.add(words.join("_"));
  }
  if (words.length > 1) {
    out.add(words.slice(0, 2).join("_"));
  }
  return Array.from(out).filter(Boolean);
}

function resolveHelpTarget(rawQuery, options = {}) {
  const includeAdmin = options.includeAdmin === true;
  const aliasLookup = options.aliasLookup instanceof Map ? options.aliasLookup : new Map();
  const cards = Array.isArray(options.cards) ? options.cards : [];
  const cardMap = options.cardMap instanceof Map ? options.cardMap : buildHelpCardMap(cards);
  const normalizedQuery = normalizeToken(rawQuery);
  if (!normalizedQuery) {
    return { kind: "index", category: "core_loop", query: "" };
  }
  const candidates = toQueryCandidates(rawQuery);
  for (const candidate of candidates) {
    const category = resolveHelpCategory(candidate, { includeAdmin });
    if (category) {
      return { kind: "index", category, query: candidate };
    }
  }
  for (const candidate of candidates) {
    const fromAlias = aliasLookup.get(candidate);
    const commandKey = String(fromAlias || candidate);
    const card = cardMap.get(commandKey);
    if (!card) {
      continue;
    }
    if (!includeAdmin && card.scope === "admin") {
      return {
        kind: "forbidden",
        key: commandKey,
        category: card.category,
        query: candidate
      };
    }
    return {
      kind: "card",
      key: commandKey,
      category: card.category,
      query: candidate
    };
  }
  return {
    kind: "not_found",
    query: normalizedQuery,
    suggestions: suggestHelpKeys(normalizedQuery, { includeAdmin, cards, aliasLookup, limit: 4 })
  };
}

module.exports = {
  HELP_REQUIRED_FIELDS,
  HELP_CATEGORY_ORDER,
  HELP_CATEGORY_META,
  buildHelpCards,
  buildHelpCardMap,
  validateHelpCardsCoverage,
  getHelpCategories,
  categoryLabel,
  resolveHelpCategory,
  resolveHelpTarget,
  suggestHelpKeys
};
