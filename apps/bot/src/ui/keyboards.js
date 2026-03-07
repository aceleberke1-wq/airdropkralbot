const { Markup } = require("telegraf");
const { normalizeLanguage } = require("../i18n");
const { resolveLaunchSurface } = require("./launchSurfaceCatalog");

const BOT_UI_TEXT = Object.freeze({
  tr: Object.freeze({
    task_label: "Gorev Sec",
    reroll_tasks: "Panel Yenile (1 RC)",
    daily: "Gunluk Panel",
    open_play: "Arena 3D Ac",
    onboard: "Onboard",
    open_tasks: "Gorev Havuzu",
    pvp_raid: "PvP Raid Baslat",
    vault: "Vault",
    wallet: "Cuzdan",
    status: "Durum",
    story: "Story/Rehber",
    more: "Komut Merkezi+",
    quick_guide: "Hizli Rehber",
    launcher: "Ana Launcher",
    missions: "Misyonlar/Claim",
    kingdom: "Kingdom Tier",
    nexus: "Nexus Pulse",
    arena_raid: "Arena Raid",
    war_room: "War Room",
    season: "Sezon Panel",
    shop: "Boost Dukkan",
    token: "Token Treasury",
    payout: "Vault Cekim",
    guide_open_task: "1) Gorev Ac",
    guide_finish_balanced: "2) Dengeli Bitir",
    guide_reveal: "3) Reveal Ac",
    guide_arena: "4) Arena 3D",
    guide_nexus: "Nexus Pulse",
    help_onboard: "Onboard",
    help_tasks: "Gorev",
    help_launcher: "Ana Launcher",
    complete_safe: "Temkinli Bitir",
    complete_balanced: "Dengeli Bitir",
    complete_aggressive: "Saldirgan Bitir",
    post_new_task: "Yeni Gorev",
    post_leaderboard: "Liderlik",
    reveal_action: "Reveal",
    shop_buy_prefix: "Satin Al",
    mission_claim_prefix: "Odulu Al",
    payout_request_btc: "BTC Cekim Talebi",
    refresh_status: "Durumu Yenile",
    token_status: "Token Durumu",
    token_mint_max: "Token Mint (Max)",
    token_buy_quick: "Hizli Satin Alma",
    open_profile_hub: "Profil Hub",
    open_status_hub: "Durum Hub",
    open_discover_panel: "Kesfet",
    open_rewards_vault: "Odul Vault",
    open_events_hall: "Event Merkezi",
    open_settings_panel: "Ayarlar",
    open_support_panel: "Destek",
    open_faq_panel: "SSS",
    open_mission_quarter: "Mission Quarter",
    open_wallet_panel: "Wallet Panel",
    open_payout_screen: "Payout Ekrani",
    open_season_hall: "Season Hall",
    open_leaderboard_panel: "Leaderboard",
    open_admin_workspace: "Admin Workspace",
    admin_policy_panel: "Policy Panel",
    admin_runtime_panel: "Runtime Panel",
    back_to_panel: "Bot Paneline Don",
    open_browser: "Tarayici ile Ac",
    raid_safe: "Raid Temkinli",
    raid_balanced: "Raid Dengeli",
    raid_aggressive: "Raid Saldirgan",
    arena_rank: "Arena Siralama",
    admin_freeze_off: "Freeze Kapat",
    admin_freeze_on: "Freeze Ac",
    admin_refresh: "Yenile",
    admin_unified_queue: "Unified Queue",
    admin_payout_queue: "Payout Queue",
    admin_token_queue: "Token Queue",
    admin_reject_payout: "Payout Reddet",
    admin_approve_token: "Token Onayla",
    admin_reject_token: "Token Reddet",
    help_prev: "Geri",
    help_next: "Ileri",
    help_back_index: "Indekse Don",
    help_category_core_loop: "Core Loop",
    help_category_economy: "Ekonomi",
    help_category_progression: "Ilerleme",
    help_category_system: "Sistem",
    help_category_admin: "Admin"
  }),
  en: Object.freeze({
    task_label: "Select Task",
    reroll_tasks: "Refresh Panel (1 RC)",
    daily: "Daily Panel",
    open_play: "Open Arena 3D",
    onboard: "Onboard",
    open_tasks: "Task Pool",
    pvp_raid: "Start PvP Raid",
    vault: "Vault",
    wallet: "Wallet",
    status: "Status",
    story: "Story/Guide",
    more: "Command Hub+",
    quick_guide: "Quick Guide",
    launcher: "Home Launcher",
    missions: "Missions/Claim",
    kingdom: "Kingdom Tier",
    nexus: "Nexus Pulse",
    arena_raid: "Arena Raid",
    war_room: "War Room",
    season: "Season Panel",
    shop: "Boost Shop",
    token: "Token Treasury",
    payout: "Vault Payout",
    guide_open_task: "1) Open Tasks",
    guide_finish_balanced: "2) Finish Balanced",
    guide_reveal: "3) Reveal",
    guide_arena: "4) Arena 3D",
    guide_nexus: "Nexus Pulse",
    help_onboard: "Onboard",
    help_tasks: "Tasks",
    help_launcher: "Home Launcher",
    complete_safe: "Finish Safe",
    complete_balanced: "Finish Balanced",
    complete_aggressive: "Finish Aggressive",
    post_new_task: "New Task",
    post_leaderboard: "Leaderboard",
    reveal_action: "Reveal",
    shop_buy_prefix: "Buy",
    mission_claim_prefix: "Claim Reward",
    payout_request_btc: "Request BTC Payout",
    refresh_status: "Refresh Status",
    token_status: "Token Status",
    token_mint_max: "Token Mint (Max)",
    token_buy_quick: "Quick Buy Intent",
    open_profile_hub: "Profile Hub",
    open_status_hub: "Status Hub",
    open_discover_panel: "Discover",
    open_rewards_vault: "Rewards Vault",
    open_events_hall: "Events Hub",
    open_settings_panel: "Settings",
    open_support_panel: "Support",
    open_faq_panel: "FAQ",
    open_mission_quarter: "Mission Quarter",
    open_wallet_panel: "Wallet Panel",
    open_payout_screen: "Payout Screen",
    open_season_hall: "Season Hall",
    open_leaderboard_panel: "Leaderboard",
    open_admin_workspace: "Admin Workspace",
    admin_policy_panel: "Policy Panel",
    admin_runtime_panel: "Runtime Panel",
    back_to_panel: "Back to Bot Panel",
    open_browser: "Open in Browser",
    raid_safe: "Raid Safe",
    raid_balanced: "Raid Balanced",
    raid_aggressive: "Raid Aggressive",
    arena_rank: "Arena Rank",
    admin_freeze_off: "Disable Freeze",
    admin_freeze_on: "Enable Freeze",
    admin_refresh: "Refresh",
    admin_unified_queue: "Unified Queue",
    admin_payout_queue: "Payout Queue",
    admin_token_queue: "Token Queue",
    admin_reject_payout: "Reject Payout",
    admin_approve_token: "Approve Token",
    admin_reject_token: "Reject Token",
    help_prev: "Prev",
    help_next: "Next",
    help_back_index: "Back to Index",
    help_category_core_loop: "Core Loop",
    help_category_economy: "Economy",
    help_category_progression: "Progression",
    help_category_system: "System",
    help_category_admin: "Admin"
  })
});

function uiText(lang, key) {
  const locale = normalizeLanguage(lang, "tr");
  return BOT_UI_TEXT[locale]?.[key] || BOT_UI_TEXT.tr[key] || key;
}

function buildLaunchButton(label, url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    return null;
  }
  const isHttps = /^https:\/\//i.test(safeUrl);
  if (isHttps && typeof Markup.button.webApp === "function") {
    return Markup.button.webApp(label, safeUrl);
  }
  return Markup.button.url(label, safeUrl);
}

function buildLaunchGridRows(entries = [], columns = 2) {
  const safeColumns = Math.max(1, Math.min(3, Number(columns || 2) || 2));
  const buttons = (entries || [])
    .map((entry) => {
      if (!entry) {
        return null;
      }
      return buildLaunchButton(String(entry.label || "").trim(), entry.url);
    })
    .filter(Boolean);
  const rows = [];
  for (let i = 0; i < buttons.length; i += safeColumns) {
    rows.push(buttons.slice(i, i + safeColumns));
  }
  return rows;
}

function buildLaunchGridKeyboard(entries = [], columns = 2) {
  const rows = buildLaunchGridRows(entries, columns);
  if (!rows.length) {
    return undefined;
  }
  return Markup.inlineKeyboard(rows);
}

function buildLaunchSurfaceGridKeyboard(entries = [], lang = "tr", columns = 2) {
  const launchEntries = (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      if (!entry) {
        return null;
      }
      const surface = resolveLaunchSurface(entry.surfaceKey);
      if (!surface?.labelKey) {
        return null;
      }
      return {
        label: uiText(lang, surface.labelKey),
        url: entry.url
      };
    })
    .filter(Boolean);
  return buildLaunchGridKeyboard(launchEntries, columns);
}

function collectInlineKeyboardRows(keyboards = []) {
  return (Array.isArray(keyboards) ? keyboards : [])
    .flatMap((keyboard) => keyboard?.reply_markup?.inline_keyboard || [])
    .filter((row) => Array.isArray(row) && row.length > 0);
}

function mergeInlineKeyboards(...keyboards) {
  const rows = collectInlineKeyboardRows(keyboards);
  if (!rows.length) {
    return undefined;
  }
  const seen = new Set();
  const mergedRows = rows
    .map((row) =>
      row.filter((button) => {
        const key = JSON.stringify({
          text: button?.text || "",
          callback_data: button?.callback_data || "",
          url: button?.url || "",
          web_app_url: button?.web_app?.url || ""
        });
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
    )
    .filter((row) => row.length > 0);
  if (!mergedRows.length) {
    return undefined;
  }
  return Markup.inlineKeyboard(mergedRows, { columns: 2 });
}

function buildAlertSurfaceKeyboard(entries = [], lang = "tr") {
  return buildLaunchSurfaceGridKeyboard(entries, lang, 2);
}

function buildTaskKeyboard(offers, lang = "tr", miniAppUrl = "") {
  const buttons = offers.map((offer, index) =>
    Markup.button.callback(`${uiText(lang, "task_label")} ${index + 1}`, `TASK_ACCEPT:${offer.id}`)
  );
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3));
  }
  rows.push([
    Markup.button.callback(uiText(lang, "reroll_tasks"), "REROLL_TASKS"),
    Markup.button.callback(uiText(lang, "daily"), "OPEN_DAILY")
  ]);
  const launchButton = buildLaunchButton(uiText(lang, "open_mission_quarter"), miniAppUrl);
  if (launchButton) {
    rows.push([launchButton]);
  }
  return Markup.inlineKeyboard(rows);
}

function buildStartKeyboard(lang = "tr") {
  return Markup.inlineKeyboard(
    [
      [Markup.button.callback(uiText(lang, "open_play"), "OPEN_PLAY")],
      [Markup.button.callback(uiText(lang, "onboard"), "OPEN_ONBOARD"), Markup.button.callback(uiText(lang, "open_tasks"), "OPEN_TASKS")],
      [Markup.button.callback(uiText(lang, "pvp_raid"), "ARENA_RAID:balanced"), Markup.button.callback(uiText(lang, "vault"), "OPEN_PAYOUT")],
      [Markup.button.callback(uiText(lang, "wallet"), "OPEN_WALLET"), Markup.button.callback(uiText(lang, "status"), "OPEN_STATUS")],
      [Markup.button.callback(uiText(lang, "story"), "OPEN_GUIDE"), Markup.button.callback(uiText(lang, "more"), "OPEN_MORE_MENU")]
    ],
    { columns: 2 }
  );
}

function buildMoreMenuKeyboard(lang = "tr") {
  return Markup.inlineKeyboard(
    [
      [Markup.button.callback(uiText(lang, "quick_guide"), "OPEN_GUIDE"), Markup.button.callback(uiText(lang, "launcher"), "OPEN_HOME_MENU")],
      [Markup.button.callback(uiText(lang, "missions"), "OPEN_MISSIONS"), Markup.button.callback(uiText(lang, "daily"), "OPEN_DAILY")],
      [Markup.button.callback(uiText(lang, "kingdom"), "OPEN_KINGDOM"), Markup.button.callback(uiText(lang, "nexus"), "OPEN_NEXUS")],
      [Markup.button.callback(uiText(lang, "arena_raid"), "ARENA_RAID:balanced"), Markup.button.callback(uiText(lang, "war_room"), "OPEN_WAR")],
      [Markup.button.callback(uiText(lang, "season"), "OPEN_SEASON"), Markup.button.callback(uiText(lang, "shop"), "OPEN_SHOP")],
      [Markup.button.callback(uiText(lang, "token"), "OPEN_TOKEN"), Markup.button.callback(uiText(lang, "payout"), "OPEN_PAYOUT")]
    ],
    { columns: 2 }
  );
}

function buildGuideKeyboard(lang = "tr") {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback(uiText(lang, "guide_open_task"), "OPEN_TASKS"),
      Markup.button.callback(uiText(lang, "guide_finish_balanced"), "GUIDE_FINISH_BALANCED"),
      Markup.button.callback(uiText(lang, "guide_reveal"), "GUIDE_REVEAL"),
      Markup.button.callback(uiText(lang, "guide_arena"), "OPEN_PLAY"),
      Markup.button.callback(uiText(lang, "guide_nexus"), "OPEN_NEXUS"),
      Markup.button.callback(uiText(lang, "wallet"), "OPEN_WALLET"),
      Markup.button.callback(uiText(lang, "missions"), "OPEN_MISSIONS")
    ],
    { columns: 2 }
  );
}

function buildHelpKeyboard(lang = "tr") {
  return Markup.inlineKeyboard(
    [
      [Markup.button.callback(uiText(lang, "help_onboard"), "OPEN_ONBOARD"), Markup.button.callback(uiText(lang, "help_tasks"), "OPEN_TASKS")],
      [Markup.button.callback(uiText(lang, "pvp_raid"), "ARENA_RAID:balanced"), Markup.button.callback(uiText(lang, "vault"), "OPEN_PAYOUT")],
      [Markup.button.callback(uiText(lang, "guide_arena"), "OPEN_PLAY"), Markup.button.callback(uiText(lang, "story"), "OPEN_GUIDE")],
      [Markup.button.callback(uiText(lang, "help_launcher"), "OPEN_HOME_MENU")]
    ],
    { columns: 2 }
  );
}

function helpCategoryLabel(lang, categoryKey) {
  const key = `help_category_${String(categoryKey || "").toLowerCase()}`;
  return uiText(lang, key);
}

function buildHelpIndexKeyboard(payload = {}, lang = "tr") {
  const categories = Array.isArray(payload.categories) ? payload.categories : [];
  const items = Array.isArray(payload.items) ? payload.items : [];
  const activeCategory = String(payload.activeCategory || "core_loop");
  const totalPages = Math.max(1, Number(payload.totalPages || 1));
  const page = Math.max(1, Math.min(totalPages, Number(payload.page || 1)));
  const rows = [];

  const categoryButtons = categories.map((category) => {
    const key = String(category.key || "");
    const label = helpCategoryLabel(lang, key) || String(category.label || key || "category");
    const text = key === activeCategory ? `[${label}]` : label;
    return Markup.button.callback(text, `HELP_SECTION:${key}:1`);
  });
  for (let i = 0; i < categoryButtons.length; i += 2) {
    rows.push(categoryButtons.slice(i, i + 2));
  }

  const commandButtons = items.map((card) => Markup.button.callback(`/${String(card.key || "help")}`, `HELP_CARD:${String(card.key || "help")}`));
  for (let i = 0; i < commandButtons.length; i += 2) {
    rows.push(commandButtons.slice(i, i + 2));
  }

  const navRow = [];
  if (page > 1) {
    navRow.push(Markup.button.callback(uiText(lang, "help_prev"), `HELP_SECTION:${activeCategory}:${page - 1}`));
  }
  navRow.push(Markup.button.callback(`${page}/${totalPages}`, `HELP_SECTION:${activeCategory}:${page}`));
  if (page < totalPages) {
    navRow.push(Markup.button.callback(uiText(lang, "help_next"), `HELP_SECTION:${activeCategory}:${page + 1}`));
  }
  rows.push(navRow);
  return Markup.inlineKeyboard(rows, { columns: 2 });
}

function buildHelpCommandCardKeyboard(payload = {}, lang = "tr") {
  const relatedCommands = Array.isArray(payload.relatedCommands) ? payload.relatedCommands : [];
  const backCategory = String(payload.backCategory || "core_loop");
  const backPage = Math.max(1, Number(payload.backPage || 1));
  const rows = [];
  const relatedButtons = relatedCommands
    .slice(0, 6)
    .map((key) => Markup.button.callback(`/${String(key || "help")}`, `HELP_CARD:${String(key || "help")}`));
  for (let i = 0; i < relatedButtons.length; i += 2) {
    rows.push(relatedButtons.slice(i, i + 2));
  }
  rows.push([Markup.button.callback(uiText(lang, "help_back_index"), `HELP_BACK:${backCategory}:${backPage}`)]);
  return Markup.inlineKeyboard(rows, { columns: 2 });
}

function buildCompleteKeyboard(attemptId, lang = "tr") {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback(uiText(lang, "complete_safe"), `TASK_COMPLETE:${attemptId}:safe`),
      Markup.button.callback(uiText(lang, "complete_balanced"), `TASK_COMPLETE:${attemptId}:balanced`),
      Markup.button.callback(uiText(lang, "complete_aggressive"), `TASK_COMPLETE:${attemptId}:aggressive`)
    ],
    { columns: 1 }
  );
}

function buildRevealKeyboard(attemptId, lang = "tr") {
  return Markup.inlineKeyboard([Markup.button.callback(uiText(lang, "reveal_action"), `REVEAL:${attemptId}`)]);
}

function buildPostRevealKeyboard(lang = "tr") {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback(uiText(lang, "post_new_task"), "OPEN_TASKS"),
      Markup.button.callback(uiText(lang, "wallet"), "OPEN_WALLET"),
      Markup.button.callback(uiText(lang, "token"), "OPEN_TOKEN"),
      Markup.button.callback(uiText(lang, "post_leaderboard"), "OPEN_LEADERBOARD"),
      Markup.button.callback(uiText(lang, "shop"), "OPEN_SHOP"),
      Markup.button.callback(uiText(lang, "missions"), "OPEN_MISSIONS")
    ],
    { columns: 2 }
  );
}

function buildShopKeyboard(offers, lang = "tr", miniAppUrl = "") {
  const buttons = offers.map((offer, index) =>
    Markup.button.callback(`${uiText(lang, "shop_buy_prefix")} ${index + 1}`, `BUY_OFFER:${offer.id}`)
  );
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  const launchButton = buildLaunchButton(uiText(lang, "open_rewards_vault"), miniAppUrl);
  if (launchButton) {
    rows.push([launchButton]);
  }
  return Markup.inlineKeyboard(rows, { columns: 2 });
}

function buildMissionKeyboard(board, lang = "tr", miniAppUrl = "") {
  const buttons = (board || [])
    .filter((mission) => mission.completed && !mission.claimed)
    .map((mission) => Markup.button.callback(`${uiText(lang, "mission_claim_prefix")}: ${mission.title}`, `CLAIM_MISSION:${mission.key}`));

  const rows = [];
  if (buttons.length > 0) {
    for (let i = 0; i < buttons.length; i += 1) {
      rows.push([buttons[i]]);
    }
  }
  const launchButton = buildLaunchButton(uiText(lang, "open_mission_quarter"), miniAppUrl);
  if (launchButton) {
    rows.push([launchButton]);
  }
  if (rows.length === 0) {
    return undefined;
  }
  return Markup.inlineKeyboard(rows, { columns: 1 });
}

function buildPayoutKeyboard(canRequest, lang = "tr", miniAppUrl = "") {
  const buttons = [];
  if (canRequest) {
    buttons.push(Markup.button.callback(uiText(lang, "payout_request_btc"), "REQ_PAYOUT:BTC"));
  }
  buttons.push(Markup.button.callback(uiText(lang, "refresh_status"), "OPEN_PAYOUT"));
  const rows = buttons.map((button) => [button]);
  const launchButton = buildLaunchButton(uiText(lang, "open_payout_screen"), miniAppUrl);
  if (launchButton) {
    rows.push([launchButton]);
  }
  return Markup.inlineKeyboard(rows, { columns: 1 });
}

function buildTokenKeyboard(lang = "tr") {
  return Markup.inlineKeyboard(
    [
      [
        Markup.button.callback(uiText(lang, "token_status"), "OPEN_TOKEN"),
        Markup.button.callback(uiText(lang, "token_mint_max"), "TOKEN_MINT")
      ],
      [Markup.button.callback(uiText(lang, "token_buy_quick"), "TOKEN_BUY_QUICK")],
      [Markup.button.callback(uiText(lang, "back_to_panel"), "OPEN_TASKS")]
    ],
    { columns: 1 }
  );
}

function buildPlayKeyboard(url, lang = "tr") {
  const openButton = buildLaunchButton(uiText(lang, "open_play"), url);
  return Markup.inlineKeyboard(
    [[openButton], [Markup.button.url(uiText(lang, "open_browser"), url)], [Markup.button.callback(uiText(lang, "back_to_panel"), "OPEN_TASKS")]],
    { columns: 1 }
  );
}

function buildWalletKeyboard(url, lang = "tr") {
  const launchButton = buildLaunchButton(uiText(lang, "open_wallet_panel"), url);
  if (!launchButton) {
    return undefined;
  }
  return Markup.inlineKeyboard([[launchButton]], { columns: 1 });
}

function buildProfileKeyboard(profileUrl, walletUrl, lang = "tr") {
  return buildLaunchSurfaceGridKeyboard(
    [
      { surfaceKey: "profile_hub", url: profileUrl },
      { surfaceKey: "wallet_panel", url: walletUrl }
    ],
    lang,
    2
  );
}

function buildStatusKeyboard(statusUrl, discoverUrl, lang = "tr") {
  return buildLaunchSurfaceGridKeyboard(
    [
      { surfaceKey: "status_hub", url: statusUrl },
      { surfaceKey: "discover_panel", url: discoverUrl }
    ],
    lang,
    2
  );
}

function buildRewardsKeyboard(rewardsUrl, leaderboardUrl, lang = "tr") {
  return buildLaunchSurfaceGridKeyboard(
    [
      { surfaceKey: "rewards_vault", url: rewardsUrl },
      { surfaceKey: "leaderboard_panel", url: leaderboardUrl }
    ],
    lang,
    2
  );
}

function buildEventKeyboard(eventsUrl, seasonUrl, leaderboardUrl, lang = "tr") {
  return buildLaunchSurfaceGridKeyboard(
    [
      { surfaceKey: "events_hall", url: eventsUrl },
      { surfaceKey: "season_hall", url: seasonUrl },
      { surfaceKey: "leaderboard_panel", url: leaderboardUrl }
    ],
    lang,
    2
  );
}

function buildDiscoverKeyboard(discoverUrl, missionsUrl, playUrl, lang = "tr") {
  return buildLaunchSurfaceGridKeyboard(
    [
      { surfaceKey: "discover_panel", url: discoverUrl },
      { surfaceKey: "mission_quarter", url: missionsUrl },
      { surfaceKey: "play_world", url: playUrl }
    ],
    lang,
    2
  );
}

function buildSettingsKeyboard(settingsUrl, supportUrl, lang = "tr") {
  return buildLaunchSurfaceGridKeyboard(
    [
      { surfaceKey: "settings_panel", url: settingsUrl },
      { surfaceKey: "support_panel", url: supportUrl }
    ],
    lang,
    2
  );
}

function buildSupportKeyboard(statusUrl, payoutUrl, settingsUrl, faqUrl, lang = "tr") {
  return buildLaunchSurfaceGridKeyboard(
    [
      { surfaceKey: "status_hub", url: statusUrl },
      { surfaceKey: "payout_screen", url: payoutUrl },
      { surfaceKey: "settings_panel", url: settingsUrl },
      { surfaceKey: "faq_panel", url: faqUrl }
    ],
    lang,
    2
  );
}

function buildSeasonKeyboard(seasonUrl, leaderboardUrl, lang = "tr") {
  const rows = [];
  const seasonSurface = resolveLaunchSurface("season_hall");
  const leaderboardSurface = resolveLaunchSurface("leaderboard_panel");
  const seasonButton = buildLaunchButton(uiText(lang, seasonSurface?.labelKey || "open_season_hall"), seasonUrl);
  const leaderboardButton = buildLaunchButton(uiText(lang, leaderboardSurface?.labelKey || "open_leaderboard_panel"), leaderboardUrl);
  if (seasonButton && leaderboardButton) {
    rows.push([seasonButton, leaderboardButton]);
  } else if (seasonButton) {
    rows.push([seasonButton]);
  } else if (leaderboardButton) {
    rows.push([leaderboardButton]);
  }
  if (rows.length === 0) {
    return undefined;
  }
  return Markup.inlineKeyboard(rows, { columns: 2 });
}

function buildRaidKeyboard(lang = "tr") {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback(uiText(lang, "raid_safe"), "ARENA_RAID:safe"),
      Markup.button.callback(uiText(lang, "raid_balanced"), "ARENA_RAID:balanced"),
      Markup.button.callback(uiText(lang, "raid_aggressive"), "ARENA_RAID:aggressive"),
      Markup.button.callback(uiText(lang, "arena_rank"), "OPEN_ARENA_RANK"),
      Markup.button.callback(uiText(lang, "guide_arena"), "OPEN_PLAY")
    ],
    { columns: 1 }
  );
}

function buildAdminKeyboard(snapshot = {}, lang = "tr", launchEntries = []) {
  const payoutButtons = (snapshot.pendingPayouts || [])
    .slice(0, 3)
    .map((row) => [Markup.button.callback(`Payout #${row.id}`, `ADMIN_PAYOUT_PICK:${row.id}`)]);
  const tokenButtons = (snapshot.pendingTokenRequests || [])
    .slice(0, 3)
    .map((row) => [Markup.button.callback(`Token #${row.id}`, `ADMIN_TOKEN_PICK:${row.id}`)]);

  const freezeToggle = snapshot.freeze?.freeze
    ? Markup.button.callback(uiText(lang, "admin_freeze_off"), "ADMIN_FREEZE_OFF")
    : Markup.button.callback(uiText(lang, "admin_freeze_on"), "ADMIN_FREEZE_ON");

  const rows = [
    [Markup.button.callback(uiText(lang, "admin_refresh"), "ADMIN_PANEL_REFRESH"), freezeToggle],
    [Markup.button.callback(uiText(lang, "admin_unified_queue"), "ADMIN_OPEN_QUEUE")],
    [
      Markup.button.callback(uiText(lang, "admin_payout_queue"), "ADMIN_OPEN_PAYOUTS"),
      Markup.button.callback(uiText(lang, "admin_token_queue"), "ADMIN_OPEN_TOKENS")
    ],
    ...payoutButtons,
    ...tokenButtons
  ];
  const launchRows = buildLaunchGridRows(launchEntries, 2);
  if (launchRows.length) {
    rows.push(...launchRows);
  }
  return Markup.inlineKeyboard(rows, { columns: 1 });
}

function buildAdminWorkspaceKeyboard(adminUrl, queueUrl, policyUrl, runtimeUrl, lang = "tr") {
  return buildLaunchSurfaceGridKeyboard(
    [
      { surfaceKey: "admin_workspace", url: adminUrl },
      { surfaceKey: "admin_queue", url: queueUrl },
      { surfaceKey: "admin_policy", url: policyUrl },
      { surfaceKey: "admin_runtime", url: runtimeUrl }
    ],
    lang,
    2
  );
}

function buildAdminPayoutActionKeyboard(requestId, lang = "tr") {
  const id = Number(requestId || 0);
  if (!id) {
    return undefined;
  }
  return Markup.inlineKeyboard(
    [
      [Markup.button.callback(uiText(lang, "admin_reject_payout"), `ADMIN_PAYOUT_REJECT:${id}`)],
      [
        Markup.button.callback(uiText(lang, "admin_payout_queue"), "ADMIN_OPEN_PAYOUTS"),
        Markup.button.callback(uiText(lang, "admin_unified_queue"), "ADMIN_OPEN_QUEUE")
      ]
    ],
    { columns: 2 }
  );
}

function buildAdminTokenActionKeyboard(row = {}, lang = "tr") {
  const id = Number(row.id || 0);
  if (!id) {
    return undefined;
  }
  const buttons = [];
  if (String(row.tx_hash || "").trim()) {
    buttons.push(Markup.button.callback(uiText(lang, "admin_approve_token"), `ADMIN_TOKEN_APPROVE:${id}`));
  }
  buttons.push(Markup.button.callback(uiText(lang, "admin_reject_token"), `ADMIN_TOKEN_REJECT:${id}`));
  return Markup.inlineKeyboard(
    [
      buttons,
      [
        Markup.button.callback(uiText(lang, "admin_token_queue"), "ADMIN_OPEN_TOKENS"),
        Markup.button.callback(uiText(lang, "admin_unified_queue"), "ADMIN_OPEN_QUEUE")
      ]
    ],
    { columns: 2 }
  );
}

module.exports = {
  buildTaskKeyboard,
  buildStartKeyboard,
  buildMoreMenuKeyboard,
  buildGuideKeyboard,
  buildHelpKeyboard,
  buildHelpIndexKeyboard,
  buildHelpCommandCardKeyboard,
  buildAlertSurfaceKeyboard,
  buildCompleteKeyboard,
  buildRevealKeyboard,
  buildPostRevealKeyboard,
  buildShopKeyboard,
  buildMissionKeyboard,
  buildPayoutKeyboard,
  buildTokenKeyboard,
  buildPlayKeyboard,
  buildWalletKeyboard,
  buildProfileKeyboard,
  buildStatusKeyboard,
  buildRewardsKeyboard,
  buildEventKeyboard,
  buildDiscoverKeyboard,
  buildSettingsKeyboard,
  buildSupportKeyboard,
  buildSeasonKeyboard,
  buildRaidKeyboard,
  buildAdminKeyboard,
  buildAdminWorkspaceKeyboard,
  buildAdminPayoutActionKeyboard,
  buildAdminTokenActionKeyboard,
  mergeInlineKeyboards
};
