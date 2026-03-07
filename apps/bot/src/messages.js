function progressBar(value, max, size = 10) {
  const safeMax = Math.max(1, Number(max || 1));
  const ratio = Math.max(0, Math.min(1, Number(value || 0) / safeMax));
  const filled = Math.round(ratio * size);
  return `(${"#".repeat(filled)}${"-".repeat(size - filled)})`;
}

function pct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function escapeMarkdown(value) {
  return String(value || "").replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function localizeText(value, lang = "tr") {
  if (!value || typeof value !== "object") {
    return "";
  }
  const normalized = String(lang || "tr")
    .trim()
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "tr";
  return normalized === "en"
    ? String(value.en || value.tr || "")
    : String(value.tr || value.en || "");
}

function formatStart(profile, balances, season, anomaly, contract, options = {}) {
  const lang = String(options.lang || "tr")
    .trim()
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "tr";
  const publicName = escapeMarkdown(profile.public_name);
  const sc = balances?.SC || 0;
  const hc = balances?.HC || 0;
  const rc = balances?.RC || 0;
  const seasonLine = season
    ? lang === "en"
      ? `\nSeason: *S${season.seasonId}* - ${season.daysLeft} days`
      : `\nSezon: *S${season.seasonId}* - ${season.daysLeft} gun`
    : "";
  const anomalyLine = anomaly
    ? lang === "en"
      ? `\nNexus: *${escapeMarkdown(anomaly.title)}* (${anomaly.pressure_pct}% pressure, ${anomaly.preferred_mode})`
      : `\nNexus: *${escapeMarkdown(anomaly.title)}* (${anomaly.pressure_pct}% basinc, ${anomaly.preferred_mode})`
    : "";
  const contractLine = contract
    ? lang === "en"
      ? `\nContract: *${escapeMarkdown(contract.title)}* [${escapeMarkdown(contract.required_mode)}]`
      : `\nKontrat: *${escapeMarkdown(contract.title)}* [${escapeMarkdown(contract.required_mode)}]`
    : "";
  if (lang === "en") {
    return (
      `*AirdropKralBot // Launcher*\n` +
      `Player: *${publicName}* | Tier *${profile.kingdom_tier}*\n` +
      `Streak: *${profile.current_streak} days* | Balance: *${sc} SC / ${hc} HC / ${rc} RC*${seasonLine}${anomalyLine}${contractLine}\n\n` +
      `*Why here?* Progress via Task -> Finish -> Reveal; season, rank and token panels build on it.\n\n` +
      `*Quick Routes*\n` +
      `- Economy: /wallet -> /vault -> /token\n` +
      `- Progress: /tasks -> /finish balanced -> /reveal\n` +
      `- Combat: /pvp balanced -> /arena_rank\n\n` +
      `*First 2 steps*\n` +
      `1) *Open Arena 3D* (main panel)\n` +
      `2) *Onboard* (3-step quick setup)\n\n` +
      `HUD: ${progressBar(profile.current_streak, 14, 14)}\n` +
      `Shortcuts: /play | /onboard | /tasks | /wallet`
    );
  }
  return (
    `*AirdropKralBot // Launcher*\n` +
    `Kral: *${publicName}* | Tier *${profile.kingdom_tier}*\n` +
    `Streak: *${profile.current_streak} gun* | Bakiye: *${sc} SC / ${hc} HC / ${rc} RC*${seasonLine}${anomalyLine}${contractLine}\n\n` +
    `*Neden burada?* Gorev -> Finish -> Reveal dongusu ile ilerlersin; sezon, rank ve token paneli ustune kurulur.\n\n` +
    `*Hizli Rotalar*\n` +
    `- Ekonomi: /wallet -> /vault -> /token\n` +
    `- Ilerleme: /tasks -> /finish dengeli -> /reveal\n` +
    `- Savas: /pvp dengeli -> /arena_rank\n\n` +
    `*Ilk 2 adim*\n` +
    `1) *Arena 3D Ac* (ana panel)\n` +
    `2) *Onboard* (3 adim hizli kurulum)\n\n` +
    `HUD: ${progressBar(profile.current_streak, 14, 14)}\n` +
    `Kisayol: /play | /onboard | /tasks | /wallet`
  );
}

function formatGuide(snapshot, options = {}) {
  const lang = String(options.lang || "tr")
    .trim()
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "tr";
  const profile = snapshot?.profile || {};
  const daily = snapshot?.daily || {};
  const attempts = snapshot?.attempts || {};
  const offers = snapshot?.offers || [];
  const balances = snapshot?.balances || {};
  const anomaly = snapshot?.anomaly || null;
  const contract = snapshot?.contract || null;
  const pvpContent = snapshot?.pvpContent || null;
  const pvpDaily = pvpContent?.daily_duel || {};
  const pvpWeekly = pvpContent?.weekly_ladder || {};
  const pvpArc = pvpContent?.season_arc_boss || {};
  const hasActive = Boolean(attempts.active);
  const hasReveal = Boolean(attempts.revealable);
  const nextStep =
    lang === "en"
      ? hasReveal
        ? "1) Open your current chest with /reveal."
        : hasActive
          ? "1) Complete the active run with /finish balanced."
          : offers.length > 0
            ? "1) Pick a task from /tasks."
            : Number(balances.RC || 0) > 0
              ? "1) Open /tasks and use Refresh Panel if needed."
              : "1) Start the task loop to earn RC."
      : hasReveal
        ? "1) /reveal ile mevcut kasayi ac."
        : hasActive
          ? "1) /finish dengeli ile denemeyi tamamla."
          : offers.length > 0
            ? "1) /tasks ile panelden bir gorev sec."
            : Number(balances.RC || 0) > 0
              ? "1) /tasks ac, gerekirse Panel Yenile kullan."
              : "1) RC kazanmak icin gorev dongusunu ac.";
  const pvpLine = pvpContent
    ? lang === "en"
      ? `\nPvP Flow: Daily *${Number(pvpDaily.wins || 0)}/${Number(pvpDaily.target_wins || 0)}* | Weekly *${Number(
          pvpWeekly.points || 0
        )}/${Number(pvpWeekly.next_milestone_points || pvpWeekly.target_points || 0)}* | Arc *W${Number(
          pvpArc.wave_index || 1
        )}/${Number(pvpArc.wave_total || 1)}*`
      : `\nPvP Akis: Gunluk *${Number(pvpDaily.wins || 0)}/${Number(pvpDaily.target_wins || 0)}* | Haftalik *${Number(
          pvpWeekly.points || 0
        )}/${Number(pvpWeekly.next_milestone_points || pvpWeekly.target_points || 0)}* | Arc *W${Number(
          pvpArc.wave_index || 1
        )}/${Number(pvpArc.wave_total || 1)}*`
    : "";
  if (lang === "en") {
    return (
      `*Nexus Guide*\n` +
      `Player: *${escapeMarkdown(profile.public_name || "player")}*\n` +
      `Tier: *${profile.kingdom_tier || 0}* | Streak: *${profile.current_streak || 0} days*\n` +
      `Daily: *${Number(daily.tasksDone || 0)}/${Number(daily.dailyCap || 0)} tasks*` +
      (anomaly ? `\nNexus: *${escapeMarkdown(anomaly.title || "-")}* (${anomaly.preferred_mode || "balanced"})` : "") +
      (contract
        ? `\nContract: *${escapeMarkdown(contract.title || "-")}* [${escapeMarkdown(contract.required_mode || "balanced")}]`
        : "") +
      pvpLine +
      `\n\n` +
      `*Best Next Move*\n` +
      `${nextStep}\n\n` +
      `*Standard Flow*\n` +
      `- /tasks -> accept a task\n` +
      `- /finish [safe|balanced|aggressive] -> run result\n` +
      `- /reveal -> final reward\n` +
      `- /missions and /daily -> extra rewards\n` +
      `- /play -> Nexus Arena web panel\n\n` +
      `*Command Packs*\n` +
      `- Economy: /wallet, /vault, /token\n` +
      `- Meta: /season, /leaderboard, /nexus\n` +
      `- Utility: /status, /lang, /help\n\n` +
      `Short form: "tasks", "finish balanced", "reveal", "raid aggressive"`
    );
  }

  return (
    `*Nexus Rehber*\n` +
    `Kral: *${escapeMarkdown(profile.public_name || "oyuncu")}*\n` +
    `Tier: *${profile.kingdom_tier || 0}* | Streak: *${profile.current_streak || 0} gun*\n` +
    `Gunluk: *${Number(daily.tasksDone || 0)}/${Number(daily.dailyCap || 0)} gorev*` +
    (anomaly ? `\nNexus: *${escapeMarkdown(anomaly.title || "-")}* (${anomaly.preferred_mode || "balanced"})` : "") +
    (contract
      ? `\nKontrat: *${escapeMarkdown(contract.title || "-")}* [${escapeMarkdown(contract.required_mode || "balanced")}]`
      : "") +
    pvpLine +
    `\n\n` +
    `*Su an en iyi hamle*\n` +
    `${nextStep}\n\n` +
    `*Standart Akis*\n` +
    `- /tasks -> gorev kabul\n` +
    `- /finish [safe|balanced|aggressive] -> deneme sonucu\n` +
    `- /reveal -> kesin odul\n` +
    `- /missions ve /daily -> ek odul\n` +
    `- /play -> Nexus Arena web paneli\n\n` +
    `*Komut Paketleri*\n` +
    `- Ekonomi: /wallet, /vault, /token\n` +
    `- Meta: /season, /leaderboard, /nexus\n` +
    `- Yardimci: /status, /lang, /help\n\n` +
    `Kisa yazim: "gorev", "bitir dengeli", "reveal", "raid aggressive"`
  );
}

function formatOnboard(payload = {}, options = {}) {
  const lang = String(options.lang || "tr")
    .trim()
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "tr";
  const profile = payload.profile || {};
  const balances = payload.balances || {};
  const daily = payload.daily || {};
  const season = payload.season || {};
  const token = payload.token || {};
  const symbol = String(token.symbol || "NXT").toUpperCase();
  const remaining = Math.max(0, Number(daily.dailyCap || 0) - Number(daily.tasksDone || 0));
  if (lang === "en") {
    return (
      `*Onboard // 3 Steps*\n` +
      `Player: *${escapeMarkdown(profile.public_name || "player")}* | Tier *${profile.kingdom_tier || 0}* | Season *S${Number(
        season.seasonId || 0
      )}* (${Number(season.daysLeft || 0)} days)\n` +
      `Balance: *${Number(balances.SC || 0)} SC / ${Number(balances.HC || 0)} HC / ${Number(balances.RC || 0)} RC*\n\n` +
      `1) Pick a task with */tasks*\n` +
      `2) Close the run with */finish balanced*\n` +
      `3) Open reward with */reveal*\n\n` +
      `*Today* ${Number(daily.tasksDone || 0)}/${Number(daily.dailyCap || 0)} tasks | Remaining: *${remaining}*\n` +
      `SC today: *${Number(daily.scEarned || 0)}* | Token: *${Number(token.balance || 0).toFixed(4)} ${symbol}* (@ $${Number(
        token.spotUsd || 0
      ).toFixed(8)})\n\n` +
      `Then: */play* (Nexus panel) -> */wallet* -> */token*\n` +
      `Need fallback? Use */help* for detailed command cards.`
    );
  }

  return (
    `*Onboard // 3 Adim*\n` +
    `Kral: *${escapeMarkdown(profile.public_name || "oyuncu")}* | Tier *${profile.kingdom_tier || 0}* | Sezon *S${Number(
      season.seasonId || 0
    )}* (${Number(season.daysLeft || 0)} gun)\n` +
    `Bakiye: *${Number(balances.SC || 0)} SC / ${Number(balances.HC || 0)} HC / ${Number(balances.RC || 0)} RC*\n\n` +
    `1) */tasks* ile gorev sec\n` +
    `2) */finish dengeli* ile denemeyi kapat\n` +
    `3) */reveal* ile odulu ac\n\n` +
    `*Bugun* ${Number(daily.tasksDone || 0)}/${Number(daily.dailyCap || 0)} gorev | Kalan: *${remaining}*\n` +
    `SC bugun: *${Number(daily.scEarned || 0)}* | Token: *${Number(token.balance || 0).toFixed(4)} ${symbol}* (@ $${Number(
      token.spotUsd || 0
    ).toFixed(8)})\n\n` +
    `Sonra: */play* (Nexus panel) -> */wallet* -> */token*\n` +
    `Takildiginda */help* ile detayli komut kartlarini ac.`
  );
}

function formatProfile(profile, balances) {
  const publicName = escapeMarkdown(profile.public_name);
  const progress = progressBar(profile.reputation_score || 0, 1500);
  const sc = balances?.SC || 0;
  const hc = balances?.HC || 0;
  const rc = balances?.RC || 0;
  return (
    `*Profil Kartin*\n` +
    `Kral: *${publicName}*\n` +
    `Kingdom: *Tier ${profile.kingdom_tier}*\n` +
    `Itibar: *${profile.reputation_score}*\n` +
    `Prestij: *${profile.prestige_level}*\n` +
    `Sezon Sirasi: *#${profile.season_rank}*\n` +
    `Bakiye: *${sc} SC / ${hc} HC / ${rc} RC*\n\n` +
    `Ilerleme: ${progress}`
  );
}

function formatTasks(offers, taskMap, options = {}) {
  const anomaly = options.anomaly || null;
  const contract = options.contract || null;
  const lines = offers.map((offer, index) => {
    const task = taskMap.get(offer.task_type);
    const title = task ? task.title : offer.task_type;
    const family = task?.family ? task.family.toUpperCase() : "CORE";
    const duration = task ? `${task.durationMinutes} dk` : "-";
    const reward = task ? task.rewardPreview : "-";
    const expires = Math.max(0, Math.ceil((new Date(offer.expires_at).getTime() - Date.now()) / 60000));
    const urgency = progressBar(Math.max(0, 60 - expires), 60, 8);
    return `${index + 1}) *${title}* [${family}] - ${duration} - ${reward}\n   Sure: ${expires} dk | ${urgency}`;
  });
  const anomalyLine = anomaly
    ? `Nexus: ${escapeMarkdown(anomaly.title)} | Risk shift ${Number(anomaly.risk_shift_pct || 0)}% | Oneri ${anomaly.preferred_mode}\n`
    : "";
  const contractLine = contract
    ? `Kontrat: ${escapeMarkdown(contract.title)} | Hedef mod ${escapeMarkdown(contract.required_mode)} | Aile ${escapeMarkdown(
        (contract.focus_families || []).join(", ") || "any"
      )}\n`
    : "";
  return (
    `*Gorev Paneli*\n${anomalyLine}${contractLine}${lines.join("\n")}\n\n` +
    `Takim secimi kritik: Temkinli / Dengeli / Saldirgan.\n` +
    `Panel Yenileme: 1 RC (yeni lineup).`
  );
}

function formatTaskStarted(task, currentStreak) {
  return (
    `*Gorev Basladi*\n` +
    `Gorev: *${task.title}*\n` +
    `Arketip: *${(task.family || "core").toUpperCase()}*\n` +
    `Sure: ${task.durationMinutes} dk\n` +
    `Odul Araligi: ${task.rewardPreview}\n` +
    `Streak Carpanin: x${(1 + Math.min(0.2, (currentStreak || 0) * 0.02)).toFixed(2)}\n\n` +
    `Mod sec:\n` +
    `Temkinli = daha guvenli\n` +
    `Dengeli = standart\n` +
    `Saldirgan = yuksek risk, yuksek tavan`
  );
}

function formatTaskComplete(result, probabilities, details) {
  const label = result === "success" ? "Basarili" : result === "near_miss" ? "Neredeyse" : "Basarisiz";
  const hint =
    result === "success"
      ? "Ritmi koru. Drop olasiligi acik."
      : result === "near_miss"
        ? "Cok yakindi. Pity ilerledi."
        : "Bu tur kacti. Sonraki deneme daha kritik.";
  const modeLabel = details?.modeLabel || "Dengeli";
  const combo = Number(details?.combo || 0);
  const anomalyLabel = details?.anomaly?.title ? `\nNexus: ${details.anomaly.title} (${details.anomaly.preferred_mode})` : "";
  const contract = details?.contract || null;
  const contractLabel = contract?.title
    ? `\nKontrat: ${escapeMarkdown(contract.title)} (${contract?.match?.matched ? "HIT" : "MISS"})`
    : "";
  const comboLine = combo > 1 ? `\nMomentum: x${(1 + Math.min(0.25, combo * 0.05)).toFixed(2)} (Combo ${combo})` : "";
  const successPct = Math.round((probabilities?.pSuccess || 0) * 100);
  return (
    `*Gorev Tamamlandi*\n` +
    `Sonuc: *${label}*\n` +
    `Mod: *${modeLabel}*\n` +
    `Model Basari Olasiligi: *%${successPct}*${comboLine}${anomalyLabel}${contractLabel}\n` +
    `${hint}`
  );
}

function formatLootReveal(lootTier, rewardLine, pityAfter, pityCap, balances, seasonPoints = 0, meta) {
  const sc = balances?.SC || 0;
  const hc = balances?.HC || 0;
  const seasonLine = seasonPoints > 0 ? `\nSezon +${seasonPoints} puan` : "";
  const pityLine = `Pity: ${pityAfter} / ${pityCap} (${pct(pityAfter / Math.max(1, pityCap))})`;
  const boostLine = meta?.boost ? `\nBoost Etkisi: +${Math.round(meta.boost * 100)}% SC` : "";
  const hiddenLine = meta?.hidden ? `\nGizli Bonus Acildi` : "";
  const modeLine = meta?.modeLabel ? `\nMod: ${meta.modeLabel}` : "";
  const comboLine = Number(meta?.combo || 0) > 1 ? `\nCombo: ${meta.combo}` : "";
  const warLine = Number(meta?.warDelta || 0) > 0 ? `\nWar +${Math.floor(meta.warDelta)} | Havuz ${Math.floor(Number(meta?.warPool || 0))}` : "";
  const anomalyLine = meta?.anomalyTitle ? `\nNexus: ${anomalyEscape(meta.anomalyTitle)} (${meta.anomalyMode || "balanced"})` : "";
  const contractLine = meta?.contractTitle
    ? `\nKontrat: ${escapeMarkdown(meta.contractTitle)} (${meta.contractMatch ? "HIT" : "MISS"})`
    : "";
  return (
    `*Loot Reveal*\n` +
    `Seviye: *${lootTier}*\n` +
    `Kazanc: *${rewardLine}*\n\n` +
    `${pityLine}\n` +
    `Toplam: ${sc} SC / ${hc} HC${seasonLine}${modeLine}${comboLine}${boostLine}${hiddenLine}${warLine}${anomalyLine}${contractLine}`
  );
}

function anomalyEscape(value) {
  return escapeMarkdown(String(value || ""));
}

function formatStreak(profile) {
  return (
    `*Streak Durumu*\n` +
    `Mevcut: *${profile.current_streak} gun*\n` +
    `En Iyi: *${profile.best_streak} gun*\n` +
    `Grace: *6 saat*\n\n` +
    `Bir gorev tamamla ve zinciri canli tut.`
  );
}

function formatWallet(profile, balances, daily, anomaly, contract) {
  const sc = balances?.SC || 0;
  const hc = balances?.HC || 0;
  const rc = balances?.RC || 0;
  const extraCurrencies = Object.keys(balances || {})
    .filter((key) => !["SC", "HC", "RC"].includes(String(key).toUpperCase()))
    .map((key) => `${key}: *${Number(balances[key] || 0)}*`)
    .join("\n");
  const dailyCap = Number(daily?.dailyCap || 0);
  const tasksDone = Number(daily?.tasksDone || 0);
  const earnedSc = Number(daily?.scEarned || 0);
  const capBar = progressBar(tasksDone, dailyCap || 1, 12);
  const productivity = dailyCap > 0 ? Math.min(1, tasksDone / dailyCap) : 0;
  const anomalyLine = anomaly ? `\nNexus: *${escapeMarkdown(anomaly.title)}* (${anomaly.preferred_mode})` : "";
  const contractLine = contract ? `\nKontrat: *${escapeMarkdown(contract.title)}* [${escapeMarkdown(contract.required_mode)}]` : "";
  return (
    `*Cuzdan // Ekonomi HUD*\n` +
    `SC: *${sc}*\n` +
    `HC: *${hc}*\n` +
    `RC: *${rc}*\n\n` +
    `Bugun Gorev: *${tasksDone}/${dailyCap}*\n` +
    `Bugun SC: *${earnedSc}*\n` +
    `Verim: *${pct(productivity)}*\n` +
    `${capBar}` +
    (extraCurrencies ? `\n\n${extraCurrencies}` : "") +
    `\n\n` +
    `Streak: *${profile.current_streak} gun* | Kingdom: *Tier ${profile.kingdom_tier}*${anomalyLine}${contractLine}`
  );
}

function formatTokenWallet(profile, view) {
  const lines = (view.chains || [])
    .map((chain) => `${chain.chain}: ${chain.enabled ? chain.address : "adres_tanimli_degil"}`)
    .join("\n");

  const requests = (view.requests || [])
    .slice(0, 4)
    .map((req) => {
      const status = String(req.status || "").toUpperCase();
      const tx = req.tx_hash ? ` | tx ${escapeMarkdown(String(req.tx_hash).slice(0, 14))}...` : "";
      return `#${req.id} ${Number(req.usd_amount || 0)} USD -> ${Number(req.token_amount || 0)} ${view.symbol} [${status}]${tx}`;
    })
    .join("\n");

  return (
    `*Token Treasury*\n` +
    `Kral: *${escapeMarkdown(profile.public_name)}*\n` +
    `Token: *${view.symbol}*\n` +
    `Bakiye: *${Number(view.balance || 0).toFixed(view.tokenConfig.decimals)} ${view.symbol}*\n` +
    `Spot: *$${Number(view.spotUsd || 0).toFixed(6)}* / ${view.symbol}\n` +
    `Unify Units: *${Number(view.unifiedUnits || 0).toFixed(2)}*\n` +
    `Maks Mint: *${Number(view.equivalentToken || 0).toFixed(view.tokenConfig.decimals)} ${view.symbol}*\n\n` +
    `Zincir Adresleri:\n${escapeMarkdown(lines || "yok")}\n\n` +
    `Son Talepler:\n${escapeMarkdown(requests || "kayit yok")}\n\n` +
    `Komut: /mint [miktar], /buytoken <usd> <chain>, /tx <id> <txHash>`
  );
}

function formatTokenMintResult(plan, view) {
  return (
    `*Token Mint Basarili*\n` +
    `Kazanc: *${Number(plan.tokenAmount || 0).toFixed(view.tokenConfig.decimals)} ${view.symbol}*\n` +
    `Harcanan birimler: ${Number(plan.unitsSpent || 0).toFixed(2)}\n` +
    `Debit: ${Number(plan.debits?.SC || 0).toFixed(4)} SC / ${Number(plan.debits?.HC || 0).toFixed(4)} HC / ${Number(plan.debits?.RC || 0).toFixed(4)} RC\n` +
    `Yeni bakiye: *${Number(view.balance || 0).toFixed(view.tokenConfig.decimals)} ${view.symbol}*`
  );
}

function formatTokenMintError(reason, plan) {
  if (reason === "mint_below_min") {
    return `*Token Mint*\nMin mint: *${Number(plan?.minTokens || 0).toFixed(4)}* token.`;
  }
  if (reason === "insufficient_balance") {
    return `*Token Mint*\nYetersiz bakiye. Maks: *${Number(plan?.maxMintable || 0).toFixed(4)}* token.`;
  }
  if (reason === "token_disabled") {
    return `*Token Mint*\nToken sistemi su an kapali.`;
  }
  if (reason === "freeze_mode") {
    return `*Token Mint*\nSistem freeze modunda.`;
  }
  return `*Token Mint Hatasi*\n${escapeMarkdown(reason || "bilinmeyen_hata")}`;
}

function formatTokenBuyIntent(request, quote, tokenConfig) {
  const txHelp = `/tx ${request.id} <txHash>`;
  return (
    `*Token Satin Alma Talebi*\n` +
    `Talep: *#${request.id}*\n` +
    `Zincir: *${request.chain}*\n` +
    `Odeme: *${Number(quote.usdAmount).toFixed(2)} USD* (${request.pay_currency})\n` +
    `Karsilik: *${Number(quote.tokenAmount).toFixed(tokenConfig.decimals)} ${tokenConfig.symbol}*\n` +
    `Min teslim: *${Number(quote.tokenMinReceive).toFixed(tokenConfig.decimals)} ${tokenConfig.symbol}*\n\n` +
    `Adres:\n\`${request.pay_address}\`\n\n` +
    `Odeme sonrasi tx hash gonder:\n\`${txHelp}\``
  );
}

function formatTokenBuyIntentError(reason, quote, chain) {
  if (reason === "purchase_below_min") {
    return `*Token Satin Alma*\nMin USD: *${Number(quote?.minUsd || 0).toFixed(2)}*`;
  }
  if (reason === "purchase_above_max") {
    return `*Token Satin Alma*\nMaks USD: *${Number(quote?.maxUsd || 0).toFixed(2)}*`;
  }
  if (reason === "unsupported_chain") {
    return `*Token Satin Alma*\nDesteklenmeyen zincir: *${escapeMarkdown(chain || "-")}*`;
  }
  if (reason === "chain_address_missing") {
    return `*Token Satin Alma*\nBu zincir icin odeme adresi tanimli degil.`;
  }
  if (reason === "token_disabled") {
    return `*Token Satin Alma*\nToken sistemi su an kapali.`;
  }
  return `*Token Satin Alma Hatasi*\n${escapeMarkdown(reason || "bilinmeyen_hata")}`;
}

function formatTokenTxSubmitted(request) {
  return (
    `*TX Kaydi Alindi*\n` +
    `Talep: *#${request.id}*\n` +
    `Durum: *${String(request.status || "tx_submitted").toUpperCase()}*\n` +
    `TX: \`${escapeMarkdown(String(request.tx_hash || ""))}\`\n\n` +
    `Admin dogrulama sonrasi token bakiyene yansir.`
  );
}

function formatTokenTxError(reason, request) {
  if (reason === "request_not_found") {
    return `*TX Kaydi*\nTalep bulunamadi.`;
  }
  if (reason === "already_approved") {
    return `*TX Kaydi*\nBu talep zaten onaylandi.`;
  }
  if (reason === "already_rejected") {
    return `*TX Kaydi*\nBu talep reddedildi.`;
  }
  if (reason === "request_update_failed") {
    return `*TX Kaydi*\nTalep guncellenemedi.`;
  }
  if (reason === "tx_hash_missing") {
    return `*TX Kaydi*\nOnay icin once zincir tx hash girilmeli.`;
  }
  if (reason === "invalid_tx_hash_format") {
    return `*TX Kaydi*\nHash formati zincir tipine uymuyor.`;
  }
  if (reason === "tx_not_found_onchain") {
    return `*TX Kaydi*\nTX hash zincirde bulunamadi, tekrar kontrol et.`;
  }
  if (reason === "tx_hash_already_used") {
    return `*TX Kaydi*\nBu tx hash baska bir talepte zaten kullanildi.`;
  }
  return `*TX Kaydi Hatasi*\n${escapeMarkdown(reason || "bilinmeyen_hata")}`;
}

function formatTokenDecisionUpdate(request, options = {}) {
  const lang = String(options.lang || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
  const decision = String(options.decision || request?.status || "updated").trim().toLowerCase();
  const symbol = escapeMarkdown(String(request?.token_symbol || options.tokenSymbol || "NXT").toUpperCase());
  const chain = escapeMarkdown(String(request?.chain || "-").toUpperCase());
  const tokenAmount = Number(request?.token_amount || 0).toFixed(4);
  const usdAmount = Number(request?.usd_amount || 0).toFixed(2);
  const txHash = String(options.txHash || request?.tx_hash || "").trim();
  const reviewNote = String(options.reason || request?.admin_note || "").trim();
  const requestId = Number(request?.id || 0);
  const statusLabel =
    decision === "approved"
      ? lang === "en"
        ? "approved"
        : "onaylandi"
      : decision === "rejected"
        ? lang === "en"
          ? "rejected"
          : "reddedildi"
        : escapeMarkdown(decision || "updated");
  if (lang === "en") {
    return (
      `*Token Treasury Update*\n` +
      `Request: *#${requestId}*\n` +
      `Status: *${statusLabel}*\n` +
      `Delivery: *${tokenAmount} ${symbol}*\n` +
      `Payment: *${usdAmount} USD*\n` +
      `Chain: *${chain}*` +
      (txHash ? `\nTX: \`${escapeMarkdown(txHash)}\`` : "") +
      (reviewNote ? `\nReview note: *${escapeMarkdown(reviewNote)}*` : "") +
      `\n\n` +
      (decision === "approved"
        ? `Balance credit is recorded. Open Wallet Panel for the live balance and Support for proof.`
        : `This token request is closed. Open Support if you need the next safe step.`)
    );
  }
  return (
    `*Token Treasury Guncellemesi*\n` +
    `Talep: *#${requestId}*\n` +
    `Durum: *${statusLabel}*\n` +
    `Teslim: *${tokenAmount} ${symbol}*\n` +
    `Odeme: *${usdAmount} USD*\n` +
    `Zincir: *${chain}*` +
    (txHash ? `\nTX: \`${escapeMarkdown(txHash)}\`` : "") +
    (reviewNote ? `\nInceleme notu: *${escapeMarkdown(reviewNote)}*` : "") +
    `\n\n` +
    (decision === "approved"
      ? `Bakiye kredisi kaydedildi. Canli bakiye icin Wallet Paneli, proof icin Destek panelini ac.`
      : `Bu token talebi kapatildi. Sonraki guvenli adim icin Destek panelini ac.`)
  );
}

function formatDaily(profile, daily, board, balances, anomaly, contract) {
  const dailyCap = Number(daily?.dailyCap || 0);
  const tasksDone = Number(daily?.tasksDone || 0);
  const progress = progressBar(tasksDone, Math.max(1, dailyCap), 12);
  const claimable = { sc: 0, hc: 0, rc: 0 };
  const missionLines = (board || []).map((mission) => {
    const done = mission.completed;
    const claimed = mission.claimed;
    if (done && !claimed) {
      claimable.sc += Number(mission.reward.sc || 0);
      claimable.hc += Number(mission.reward.hc || 0);
      claimable.rc += Number(mission.reward.rc || 0);
    }
    const status = claimed ? "ALINDI" : done ? "HAZIR" : "DEVAM";
    return `${mission.title}: ${mission.progress}/${mission.target} [${status}]`;
  });

  const anomalyLine = anomaly
    ? `\nNexus: *${escapeMarkdown(anomaly.title)}* (${anomaly.pressure_pct}% basinc, ${anomaly.preferred_mode})`
    : "";
  const contractLine = contract
    ? `\nKontrat: *${escapeMarkdown(contract.title)}* [${escapeMarkdown(contract.required_mode)}]`
    : "";
  return (
    `*Gunluk Operasyon*\n` +
    `Kral: *${escapeMarkdown(profile.public_name)}*\n` +
    `Gorev: *${tasksDone}/${dailyCap}*\n` +
    `Cap HUD: ${progress}\n` +
    `Bakiye: ${balances.SC} SC / ${balances.HC} HC / ${balances.RC} RC${anomalyLine}${contractLine}\n\n` +
    `Bekleyen Misyon Odulu: *${claimable.sc} SC + ${claimable.hc} HC + ${claimable.rc} RC*\n` +
    `${missionLines.join("\n")}`
  );
}

function formatSeason(season, stat, rank) {
  const points = Number(stat?.season_points || 0);
  const currentRank = rank > 0 ? `#${rank}` : "Yerlesmedi";
  const start = season.seasonStart.toISOString().slice(0, 10);
  const end = season.seasonEnd.toISOString().slice(0, 10);
  return (
    `*Sezon Durumu*\n` +
    `Sezon: *S${season.seasonId}*\n` +
    `Aralik: ${start} - ${end}\n` +
    `Kalan: *${season.daysLeft} gun*\n\n` +
    `Puanin: *${points}*\n` +
    `Siralaman: *${currentRank}*`
  );
}

function formatLeaderboard(season, rows) {
  if (!rows || rows.length === 0) {
    return `*S${season.seasonId} Liderlik*\nHenuz puan yok.`;
  }
  const lines = rows.map((row, idx) => `${idx + 1}) *${escapeMarkdown(row.public_name)}* - ${Number(row.season_points || 0)} puan`);
  return `*S${season.seasonId} Liderlik*\n${lines.join("\n")}\n\nYaris acik.`;
}

function formatShop(offers, balances, activeEffects) {
  const lines = offers.map((offer, idx) => {
    const title = offer.benefit_json?.title || offer.offer_type;
    const price = `${Number(offer.price)} ${offer.currency}`;
    return `${idx + 1}) *${escapeMarkdown(title)}* - ${price}`;
  });
  const effects =
    !activeEffects || activeEffects.length === 0
      ? "Yok"
      : activeEffects
          .map((effect) => {
            const exp = new Date(effect.expires_at).toISOString().slice(0, 16).replace("T", " ");
            return `${effect.effect_key} (${exp})`;
          })
          .join(", ");
  return (
    `*Kral Dukkani*\n` +
    `Bakiye: ${balances.SC} SC / ${balances.HC} HC / ${balances.RC} RC\n\n` +
    `${lines.join("\n")}\n\n` +
    `Aktif Etkiler: ${escapeMarkdown(effects)}\n` +
    `Bir urune dokun ve satin al.`
  );
}

function formatPurchaseResult(result) {
  if (!result.success) {
    return `*Satin Alma Basarisiz*\nSebep: ${escapeMarkdown(result.reason || "islem_hatasi")}`;
  }
  const title = result.offer?.benefit_json?.title || result.offer?.offer_type || "Offer";
  const effectLine = result.effect
    ? `\nEtki: ${escapeMarkdown(result.effect.effect_key)} aktif edildi.`
    : "\nEtki uygulanmadi.";
  return (
    `*Satin Alma Basarili*\n` +
    `Urun: *${escapeMarkdown(title)}*\n` +
    `Odeme: *${Number(result.offer.price)} ${result.offer.currency}*\n` +
    `Kalan Bakiye: *${result.balanceAfter} ${result.offer.currency}*` +
    effectLine
  );
}

function formatMissions(board) {
  if (!board || board.length === 0) {
    return "*Gunluk Gorevler*\nSu an gorev yok.";
  }
  const lines = board.map((mission, idx) => {
    const bar = progressBar(mission.progress, mission.target, 10);
    const status = mission.claimed ? "ALINDI" : mission.completed ? "HAZIR" : "DEVAM";
    const rewardParts = [];
    if (mission.reward.sc > 0) rewardParts.push(`${mission.reward.sc}SC`);
    if (mission.reward.hc > 0) rewardParts.push(`${mission.reward.hc}HC`);
    if (mission.reward.rc > 0) rewardParts.push(`${mission.reward.rc}RC`);
    return (
      `${idx + 1}) *${escapeMarkdown(mission.title)}* [${status}]\n` +
      `   ${escapeMarkdown(mission.description)}\n` +
      `   ${mission.progress}/${mission.target} ${bar} | Odul: ${rewardParts.join("+")}`
    );
  });
  return `*Gunluk Gorevler*\n${lines.join("\n")}\n\nTamamlananlar icin odulu al.`;
}

function formatMissionClaim(result) {
  if (result.status === "claimed") {
    const reward = result.mission.reward;
    const parts = [];
    if (reward.sc > 0) parts.push(`${reward.sc} SC`);
    if (reward.hc > 0) parts.push(`${reward.hc} HC`);
    if (reward.rc > 0) parts.push(`${reward.rc} RC`);
    return (
      `*Misyon Odulu Alindi*\n` +
      `Misyon: *${escapeMarkdown(result.mission.title)}*\n` +
      `Odul: *${parts.join(" + ")}*`
    );
  }
  if (result.status === "already_claimed") {
    return `*Misyon*\nBu odulu zaten aldin.`;
  }
  if (result.status === "not_ready") {
    return `*Misyon*\nHedef tamamlanmadi. Biraz daha ilerle.`;
  }
  return `*Misyon*\nBulunamadi.`;
}

function formatWar(status, season) {
  const nextLine = status.next ? `${Math.max(0, status.next - status.value)} puan sonra ${status.tier} uzeri` : "Maksimum tier";
  return (
    `*War Room*\n` +
    `Sezon: *S${season.seasonId}*\n` +
    `Topluluk Havuzu: *${Math.floor(status.value)}*\n` +
    `Tier: *${status.tier}*\n` +
    `${nextLine}\n` +
    `${progressBar(status.value, status.next || Math.max(1, status.value), 14)}`
  );
}

function formatKingdom(profile, state) {
  const history = (state.history || []).length
    ? state.history
        .map((row) => {
          const date = new Date(row.created_at).toISOString().slice(0, 10);
          return `${date}: T${row.from_tier} -> T${row.to_tier}`;
        })
        .join("\n")
    : "Kayit yok";

  const nextTierLine =
    state.nextThreshold === null
      ? "Maks tierdesin"
      : `Sonraki Tier: *T${state.nextTier}* (${state.toNext} puan)`;

  return (
    `*Kingdom Console*\n` +
    `Kral: *${escapeMarkdown(profile.public_name)}*\n` +
    `Tier: *${profile.kingdom_tier}*\n` +
    `Reputasyon: *${profile.reputation_score}*\n` +
    `${nextTierLine}\n` +
    `Tier HUD: ${progressBar(state.progressValue, state.progressMax, 12)}\n\n` +
    `Son Hareketler:\n${history}`
  );
}

function formatPayout(details) {
  if (!details || typeof details !== "object") {
    return (
      `*Cekim Durumu*\n` +
      `Esik: 0.0001 BTC\n` +
      `Cooldown: 72 saat\n\n` +
      `Uygunluk: *Hayir*\n` +
      `Not: Cekim entitlement tabanlidir, transfer admin tarafinda disarida yapilir.`
    );
  }

  const entitled = Number(details.entitledBtc || 0).toFixed(8);
  const threshold = Number(details.thresholdBtc || 0).toFixed(8);
  const cooldown = details.cooldownUntil ? new Date(details.cooldownUntil).toISOString().slice(0, 16).replace("T", " ") : "Yok";
  const eligibility = details.canRequest ? "Evet" : "Hayir";
  const latestLine = details.latest
    ? `\nSon Talep: #${details.latest.id} ${details.latest.status} ${Number(details.latest.amount || 0).toFixed(8)} BTC (${Number(details.latest.source_hc_amount || 0).toFixed(4)} HC)`
    : "\nSon Talep: Yok";
  const txLine = details.latest?.tx_hash ? `\nTX: ${escapeMarkdown(details.latest.tx_hash)}` : "";
  const gate = details.marketCapGate || {};
  const gateLine = gate.enabled
    ? `\nMarket Cap Gate: *${gate.allowed ? "acik" : "kapali"}* (${Number(gate.current || 0).toFixed(2)} / ${Number(gate.min || 0).toFixed(2)} USD)`
    : "";
  const release = details.release || {};
  const releaseLine =
    release.enabled
      ? `\nUnlock Tier: *${escapeMarkdown(String(release.unlockTier || "T0"))}* (${Math.round(
          Number(release.unlockProgress || 0) * 100
        )}%)` +
        `\nBugun Damla Kalan: *${Number(release.todayDripRemainingBtc || 0).toFixed(8)} BTC*` +
        `\nBugun Damla Limit: *${Number(release.todayDripCapBtc || 0).toFixed(8)} BTC*` +
        `\nSonraki Hedef: ${escapeMarkdown(String(release.nextTierTarget || "veri yok"))}`
      : "";
  const globalGateLine =
    release.enabled && release.globalGateOpen === false
      ? `\nGlobal Kilit: *kapali* (${Number(release.globalCapCurrentUsd || 0).toFixed(2)} / ${Number(
          release.globalCapMinUsd || 0
        ).toFixed(2)} USD)`
      : "";
  return (
    `*Cekim Durumu*\n` +
    `Entitlement: *${entitled} BTC*\n` +
    `Esik: *${threshold} BTC*\n` +
    `Cooldown: *${cooldown}*\n\n` +
    `Uygunluk: *${eligibility}*${gateLine}${globalGateLine}${releaseLine}${latestLine}${txLine}\n` +
    `Model: entitlement-only, odeme disaridan admin tarafinda islenir.`
  );
}

function formatPayoutDecisionUpdate(request, options = {}) {
  const lang = String(options.lang || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
  const decision = String(options.decision || request?.status || "updated").trim().toLowerCase();
  const currency = escapeMarkdown(String(request?.currency || "BTC").toUpperCase());
  const amount = Number(request?.amount || 0).toFixed(8);
  const txHash = String(options.txHash || request?.tx_hash || "").trim();
  const reviewNote = String(options.reason || request?.admin_note || "").trim();
  const requestId = Number(request?.id || 0);
  const statusLabel =
    decision === "paid"
      ? lang === "en"
        ? "paid"
        : "odendi"
      : decision === "rejected"
        ? lang === "en"
          ? "rejected"
          : "reddedildi"
        : escapeMarkdown(decision || "updated");
  if (lang === "en") {
    return (
      `*Payout Update*\n` +
      `Request: *#${requestId}*\n` +
      `Status: *${statusLabel}*\n` +
      `Amount: *${amount} ${currency}*` +
      (txHash ? `\nTX: \`${escapeMarkdown(txHash)}\`` : "") +
      (reviewNote ? `\nReview note: *${escapeMarkdown(reviewNote)}*` : "") +
      `\n\n` +
      (decision === "paid"
        ? `Transfer proof is recorded. Open the Payout Screen for status and Support for follow-up.`
        : `This payout request is closed. Open Support if you need the next safe step.`)
    );
  }
  return (
    `*Cekim Guncellemesi*\n` +
    `Talep: *#${requestId}*\n` +
    `Durum: *${statusLabel}*\n` +
    `Miktar: *${amount} ${currency}*` +
    (txHash ? `\nTX: \`${escapeMarkdown(txHash)}\`` : "") +
    (reviewNote ? `\nInceleme notu: *${escapeMarkdown(reviewNote)}*` : "") +
    `\n\n` +
    (decision === "paid"
      ? `Transfer proof kaydedildi. Durum icin Payout ekranini, takip icin Destek panelini ac.`
      : `Bu cekim talebi kapatildi. Sonraki guvenli adim icin Destek panelini ac.`)
  );
}

function formatFreezeMessage(reason) {
  const detail = reason ? `\nSebep: ${reason}` : "";
  return `*Sistem Bakim Modunda*\nGorev dagitimi gecici olarak durduruldu.${detail}`;
}

function formatOps(state) {
  const activeLine = state.activeAttempt
    ? `#${state.activeAttempt.id} ${escapeMarkdown(state.activeAttempt.taskType || "task")} ${state.activeAttempt.startedAt}`
    : "Yok";
  const revealLine = state.revealAttempt
    ? `#${state.revealAttempt.id} ${escapeMarkdown(state.revealAttempt.taskType || "task")} ${state.revealAttempt.completedAt}`
    : "Yok";
  const effectsLine =
    (state.effects || []).length > 0
      ? state.effects.map((x) => `${escapeMarkdown(x.effect_key)} (${x.expires_at})`).join("\n")
      : "Aktif boost yok";
  const eventsLine =
    (state.events || []).length > 0
      ? state.events
          .map((event) => `${event.time} ${escapeMarkdown(event.event_type)}${event.hint ? ` | ${escapeMarkdown(event.hint)}` : ""}`)
          .join("\n")
      : "Event yok";
  const anomalyLine = state.anomaly
    ? `\n\n*Nexus*\n${escapeMarkdown(state.anomaly.title)} (${state.anomaly.preferred_mode}) | ${state.anomaly.pressure_pct}%`
    : "";

  return (
    `*Ops Console*\n` +
    `Risk: *${state.riskPct}%*\n` +
    `Callback Dup: *${state.duplicateRatio}%*\n` +
    `Saatlik Complete: *${state.hourlyComplete}*\n` +
    `Aktif Attempt: ${activeLine}\n` +
    `Reveal Hazir: ${revealLine}\n\n` +
    `*Aktif Efektler*\n${effectsLine}\n\n` +
    `*Son Eventler*\n${eventsLine}${anomalyLine}`
  );
}

function formatArenaStatus(state) {
  const lastRuns = (state.recentRuns || []).length
    ? state.recentRuns
        .map((run) => {
          const at = new Date(run.created_at).toISOString().slice(11, 16);
          return `${at} ${run.mode} ${run.outcome} (${run.rating_delta >= 0 ? "+" : ""}${run.rating_delta})`;
        })
        .join("\n")
    : "Kayit yok";

  const leaders = (state.leaderboard || []).length
    ? state.leaderboard
        .slice(0, 5)
        .map((row, index) => `${index + 1}. ${escapeMarkdown(row.public_name)} | ${Math.floor(Number(row.rating || 0))}`)
        .join("\n")
    : "Veri yok";

  return (
    `*Arena Protocol*\n` +
    `Rating: *${Math.floor(Number(state.rating || 0))}* (#${state.rank || "-"})\n` +
    `Oyun: *${state.gamesPlayed || 0}* | Win: *${state.wins || 0}* | Loss: *${state.losses || 0}*\n` +
    `Sonuc: *${state.lastResult || "yok"}*\n` +
    `Ticket: *${state.ticketCost || 1} RC*\n` +
    `Cooldown: *${state.cooldownSec || 0}s*\n\n` +
    `Top 5:\n${leaders}\n\n` +
    `Son Raidler:\n${lastRuns}`
  );
}

function formatArenaRaidResult(result) {
  const sign = result.run?.rating_delta >= 0 ? "+" : "";
  const modeLabel = result.mode?.label || "Dengeli";
  const outcomeMap = {
    win: "ZAFER",
    near: "KIL PAYI",
    loss: "KAYIP"
  };
  const outcome = outcomeMap[result.run?.outcome] || String(result.run?.outcome || "win").toUpperCase();
  const anomalyLine = result.anomaly?.title
    ? `\nNexus: *${escapeMarkdown(result.anomaly.title)}* (${escapeMarkdown(result.anomaly.preferred_mode || "balanced")})`
    : "";
  return (
    `*Arena Raid Sonucu*\n` +
    `Mod: *${modeLabel}*\n` +
    `Durum: *${outcome}*\n` +
    `Odul: *${result.reward?.sc || 0} SC + ${result.reward?.hc || 0} HC + ${result.reward?.rc || 0} RC*\n` +
    `Rating: *${result.rating_after || 0}* (${sign}${result.run?.rating_delta || 0})\n` +
    `Arena Rank: *#${result.rank || "-"}*${anomalyLine}\n` +
    `Sezon +${result.season_points || 0} | War +${result.war_delta || 0}`
  );
}

function formatNexusPulse(payload) {
  const anomaly = payload?.anomaly || {};
  const tactical = payload?.tactical || {};
  const contract = payload?.contract || {};
  const bars = progressBar(Number(anomaly.pressure_pct || 0), 100, 14);
  const families = Array.isArray(contract.focus_families) ? contract.focus_families.join(", ") : "";
  return (
    `*Nexus Pulse*\n` +
    `Event: *${escapeMarkdown(anomaly.title || "Stability Window")}*\n` +
    `Etki: ${escapeMarkdown(anomaly.subtitle || "-")}\n` +
    `Risk Shift: *${Number(anomaly.risk_shift_pct || 0)}%*\n` +
    `SC x${Number(anomaly.sc_multiplier || 1).toFixed(2)} | RC x${Number(anomaly.rc_multiplier || 1).toFixed(2)} | HC x${Number(
      anomaly.hc_multiplier || 1
    ).toFixed(2)}\n` +
    `Sezon x${Number(anomaly.season_multiplier || 1).toFixed(2)}\n` +
    `Basinc: ${bars}\n\n` +
    `Kontrat: *${escapeMarkdown(contract.title || "Nexus Contract")}*\n` +
    `Hedef Mod: *${escapeMarkdown(contract.required_mode || "balanced")}* | Aile: ${escapeMarkdown(families || "any")}\n` +
    `Bonus: SC x${Number(contract.sc_multiplier || 1).toFixed(2)} +${Number(contract.rc_flat_bonus || 0)} RC\n\n` +
    `Taktik Oneri: *${escapeMarkdown(tactical.recommended_mode || anomaly.preferred_mode || "balanced")}*\n` +
    `Sonraki Hamle: ${escapeMarkdown(tactical.next_step || "tasks")}`
  );
}

function formatHelp(options = {}) {
  const lang = String(options.lang || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
  const commands = Array.isArray(options.commands) ? options.commands.filter(Boolean) : null;
  if (!commands || commands.length === 0) {
    return (
      `*Komut Merkezi*\n` +
      `/menu - Ana launcher + hizli rota paneli\n` +
      `/play - Nexus Arena web paneli\n` +
      `/tasks - Gorev havuzu (sure/odul)\n` +
      `/finish [safe|balanced|aggressive] - Aktif denemeyi bitir\n` +
      `/reveal - Son denemenin odulunu ac\n` +
      `/pvp [safe|balanced|aggressive] - Raid baslat\n` +
      `/wallet - SC/HC/RC bakiye\n` +
      `/vault - Cekim/Vault paneli\n` +
      `/token - Token cuzdani + talepler\n` +
      `/status - Runtime durum ozeti\n` +
      `/story - Hikaye + rota rehberi\n` +
      `/lang <tr|en> - Kalici dil tercihi\n` +
      `/help - Detayli komut kartlari\n\n` +
      `Alias: /raid -> /pvp, /payout -> /vault, /guide -> /story\n` +
      `Slashsiz kisayollar: "gorev", "bitir dengeli", "reveal", "raid aggressive"\n\n` +
      `Admin: /admin, /admin_live, /admin_queue, /admin_metrics, /admin_config`
    );
  }

  const primaryCommands = commands.filter((command) => command.primary);
  const focusCommands = primaryCommands.length > 0 ? primaryCommands : commands.filter((command) => !command.adminOnly);
  const advancedCommands = commands.filter((command) => !command.primary && !command.adminOnly);
  const adminCommands = commands.filter((command) => command.adminOnly);
  const title = lang === "en" ? "*Command Center*" : "*Komut Merkezi*";
  const lines = focusCommands.map((command, idx) => {
    const desc = localizeText(
      {
        tr: command.description_tr || command.description || "",
        en: command.description_en || command.description || ""
      },
      lang
    );
    const aliases = Array.isArray(command.aliases) && command.aliases.length > 0 ? ` (${command.aliases.join(", ")})` : "";
    const scenarios = Array.isArray(command.scenarios) ? command.scenarios.slice(0, 2) : [];
    const outcomes = Array.isArray(command.outcomes) ? command.outcomes.slice(0, 2) : [];
    const scenarioLine =
      scenarios.length > 0
        ? lang === "en"
          ? `Scenario: ${escapeMarkdown(scenarios.join(" | "))}`
          : `Senaryo: ${escapeMarkdown(scenarios.join(" | "))}`
        : lang === "en"
          ? "Scenario: -"
          : "Senaryo: -";
    const outcomeLine =
      outcomes.length > 0
        ? lang === "en"
          ? `Outcome: ${escapeMarkdown(outcomes.join(" | "))}`
          : `Cikti: ${escapeMarkdown(outcomes.join(" | "))}`
        : lang === "en"
          ? "Outcome: -"
          : "Cikti: -";
    const purposeLabel = lang === "en" ? "Purpose" : "Amac";
    return (
      `${idx + 1}) */${command.key}${aliases}*\n` +
      `${purposeLabel}: ${escapeMarkdown(desc)}\n` +
      `${scenarioLine}\n` +
      `${outcomeLine}`
    );
  });
  const shortcuts =
    lang === "en"
      ? `Free text shortcuts: "tasks", "finish balanced", "reveal", "pvp aggressive"`
      : `Slashsiz kisayollar: "gorev", "bitir dengeli", "reveal", "pvp aggressive"`;
  const advancedHeader = lang === "en" ? "*Advanced Commands*" : "*Gelismis Komutlar*";
  const advancedLine =
    advancedCommands.length > 0
      ? advancedCommands.map((command) => `/${command.key}`).join(", ")
      : lang === "en"
        ? "None"
        : "Yok";
  const adminHeader = lang === "en" ? "*Admin Commands*" : "*Admin Komutlari*";
  const adminLine =
    adminCommands.length > 0
      ? adminCommands.map((command) => `/${command.key}`).join(", ")
      : lang === "en"
        ? "None"
        : "Yok";
  const languageHint =
    lang === "en"
      ? `Language: /lang tr or /lang en`
      : `Dil: /lang tr veya /lang en`;
  return (
    `${title}\n` +
    `${lines.join("\n")}\n\n` +
    `${advancedHeader}\n${advancedLine}\n\n` +
    `${adminHeader}\n${adminLine}\n\n` +
    `${shortcuts}\n${languageHint}`
  );
}

function clipTextToLimit(text, maxLen, suffix = "...") {
  const safeMax = Math.max(32, Number(maxLen || 0));
  const raw = String(text || "");
  if (raw.length <= safeMax) {
    return raw;
  }
  const trimmed = raw.slice(0, Math.max(0, safeMax - suffix.length));
  return `${trimmed}${suffix}`;
}

function formatListForCard(items = [], lang = "tr") {
  const rows = (Array.isArray(items) ? items : []).map((row, idx) => `${idx + 1}) ${escapeMarkdown(String(row || ""))}`);
  if (rows.length > 0) {
    return rows.join("\n");
  }
  return lang === "en" ? "1) -" : "1) -";
}

function formatHelpIndex(payload = {}) {
  const lang = String(payload.lang || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
  const categoryLabel = escapeMarkdown(String(payload.categoryLabel || (lang === "en" ? "Core Loop" : "Core Loop")));
  const page = Math.max(1, Number(payload.page || 1));
  const totalPages = Math.max(1, Number(payload.totalPages || 1));
  const totalItems = Math.max(0, Number(payload.totalItems || 0));
  const categories = Array.isArray(payload.categories) ? payload.categories : [];
  const items = Array.isArray(payload.items) ? payload.items : [];
  const categoryLine = categories
    .map((row) => {
      const label = escapeMarkdown(String(row.label || row.key || "-"));
      return row.active ? `[${label}]` : label;
    })
    .join(" | ");
  const lines = items.map((card, idx) => {
    const purpose = lang === "en" ? card.purpose_en : card.purpose_tr;
    const shortPurpose = clipTextToLimit(String(purpose || ""), lang === "en" ? 84 : 110);
    return `${idx + 1}) */${escapeMarkdown(card.key || "")}*\n${escapeMarkdown(shortPurpose)}`;
  });
  const header =
    lang === "en"
      ? `*Command Center // Index*\nCategory: *${categoryLabel}* | Page: *${page}/${totalPages}* | Commands: *${totalItems}*`
      : `*Komut Merkezi // Indeks*\nKategori: *${categoryLabel}* | Sayfa: *${page}/${totalPages}* | Komut: *${totalItems}*`;
  const usage =
    lang === "en"
      ? `Use: \`/help <command>\` or \`/help <category>\``
      : `Kullanim: \`/help <komut>\` veya \`/help <kategori>\``;
  const text =
    `${header}\n` +
    `${lang === "en" ? "Categories" : "Kategoriler"}: ${categoryLine || "-"}\n\n` +
    `${lines.join("\n\n") || "-"}\n\n` +
    `${usage}`;
  return clipTextToLimit(text, 1800);
}

function formatHelpCommandCard(card = {}, payload = {}) {
  const lang = String(payload.lang || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
  const categoryLabel = escapeMarkdown(String(payload.categoryLabel || card.category || "-"));
  const scopeLabel = card.scope === "admin" ? (lang === "en" ? "admin" : "admin") : lang === "en" ? "player" : "oyuncu";
  const flowTitle = lang === "en" ? "Operation Flow" : "Operasyon Akisi";
  const guardTitle = lang === "en" ? "Decision Guards" : "Karar Guard";
  const syntaxTitle = lang === "en" ? "Syntax" : "Kullanim";
  const examplesTitle = lang === "en" ? "Examples" : "Ornekler";
  const expectedTitle = lang === "en" ? "Expected Output" : "Beklenen Cikti";
  const failuresTitle = lang === "en" ? "Common Failures" : "Sik Hata/Cozum";
  const relatedTitle = lang === "en" ? "Related Commands" : "Ilgili Komutlar";
  const flowText = formatListForCard(lang === "en" ? card.operation_flow_en : card.operation_flow_tr, lang);
  const guardText = formatListForCard(lang === "en" ? card.decision_guards_en : card.decision_guards_tr, lang);
  const syntaxText = formatListForCard(card.syntax || [], lang);
  const examplesText = formatListForCard(lang === "en" ? card.examples_en : card.examples_tr, lang);
  const expectedText = formatListForCard(lang === "en" ? card.expected_en : card.expected_tr, lang);
  const failuresText = formatListForCard(lang === "en" ? card.failures_en : card.failures_tr, lang);
  const related =
    Array.isArray(card.related_commands) && card.related_commands.length > 0
      ? card.related_commands.map((cmd) => `/${escapeMarkdown(String(cmd || ""))}`).join(" | ")
      : "-";
  const title = escapeMarkdown(String(lang === "en" ? card.title_en : card.title_tr || `/${card.key || "help"}`));
  const purpose = escapeMarkdown(String(lang === "en" ? card.purpose_en : card.purpose_tr || ""));
  const whenToUse = escapeMarkdown(String(lang === "en" ? card.when_to_use_en : card.when_to_use_tr || ""));
  const text =
    `*${title}*\n` +
    `${lang === "en" ? "Category" : "Kategori"}: *${categoryLabel}* | ${lang === "en" ? "Scope" : "Scope"}: *${scopeLabel}*\n\n` +
    `${lang === "en" ? "Purpose" : "Amac"}: ${purpose}\n` +
    `${lang === "en" ? "When to use" : "Ne zaman kullanilir"}: ${whenToUse}\n\n` +
    `*${flowTitle}*\n${flowText}\n\n` +
    `*${guardTitle}*\n${guardText}\n\n` +
    `*${syntaxTitle}*\n${syntaxText}\n\n` +
    `*${examplesTitle}*\n${examplesText}\n\n` +
    `*${expectedTitle}*\n${expectedText}\n\n` +
    `*${failuresTitle}*\n${failuresText}\n\n` +
    `*${relatedTitle}*\n${related}`;
  return clipTextToLimit(text, lang === "en" ? 1400 : 2400);
}

function formatHelpNotFound(payload = {}) {
  const lang = String(payload.lang || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
  const query = escapeMarkdown(String(payload.query || "-"));
  const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
  const suggestionLine =
    suggestions.length > 0
      ? suggestions.map((key) => `/${escapeMarkdown(String(key || ""))}`).join(" | ")
      : lang === "en"
        ? "No close match."
        : "Yakin eslesme bulunamadi.";
  const text =
    lang === "en"
      ? `*Help Query Not Found*\nQuery: \`${query}\`\nSuggestions: ${suggestionLine}\n\nUse \`/help\`, \`/help token\`, \`/help economy\`.`
      : `*Help Sorgusu Bulunamadi*\nSorgu: \`${query}\`\nOneriler: ${suggestionLine}\n\nKullanim: \`/help\`, \`/help token\`, \`/help ekonomi\`.`;
  return clipTextToLimit(text, 1200);
}

function formatHelpAccessDenied(payload = {}) {
  const lang = String(payload.lang || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
  const commandKey = escapeMarkdown(String(payload.commandKey || "admin"));
  const alternatives = Array.isArray(payload.alternatives) ? payload.alternatives : [];
  const altLine =
    alternatives.length > 0
      ? alternatives.map((key) => `/${escapeMarkdown(String(key || ""))}`).join(" | ")
      : lang === "en"
        ? "/help | /status | /menu"
        : "/help | /status | /menu";
  const text =
    lang === "en"
      ? `*Admin Command Scope*\nThis command is admin-only: /${commandKey}\nTry these player commands: ${altLine}`
      : `*Admin Komut Kapsami*\nBu komut admin kapsamindadir: /${commandKey}\nOyuncu alternatifleri: ${altLine}`;
  return clipTextToLimit(text, 1200);
}

function formatAdminQueue(payload = {}) {
  const payouts = Array.isArray(payload.payouts) ? payload.payouts : [];
  const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
  const payoutLines =
    payouts.length > 0
      ? payouts
          .slice(0, 10)
          .map(
            (row) =>
              `P#${row.id} u${row.user_id} ${Number(row.amount || 0).toFixed(8)} BTC [${String(row.status || "").toUpperCase()}]`
          )
          .join("\n")
      : "Payout queue bos";
  const tokenLines =
    tokens.length > 0
      ? tokens
          .slice(0, 10)
          .map(
            (row) =>
              `T#${row.id} u${row.user_id} ${Number(row.usd_amount || 0).toFixed(2)} USD -> ${Number(
                row.token_amount || 0
              ).toFixed(4)} ${escapeMarkdown(row.token_symbol || "NXT")} [${escapeMarkdown(String(row.status || "").toUpperCase())}]`
          )
          .join("\n")
      : "Token queue bos";
  return (
    `*Admin Queue*\n` +
    `Toplam: *${payouts.length + tokens.length}*\n` +
    `Payout: *${payouts.length}* | Token: *${tokens.length}*\n\n` +
    `*Payout*\n${payoutLines}\n\n` +
    `*Token*\n${tokenLines}`
  );
}

function formatRaidContract(payload = {}) {
  const profile = payload.profile || {};
  const anomaly = payload.anomaly || {};
  const contract = payload.contract || {};
  const tactical = payload.tactical || {};
  const war = payload.war || {};
  const riskPct = (Number(payload.risk || 0) * 100).toFixed(0);
  const focusFamilies = Array.isArray(contract.focus_families) ? contract.focus_families.join(", ") : "any";
  const bonus = contract.match_bonus || {};
  return (
    `*Raid Kontrat Direktifi*\n` +
    `Kral: *${escapeMarkdown(profile.public_name || "-")}*\n` +
    `Event: *${escapeMarkdown(anomaly.title || "Stability Window")}* | Risk *${riskPct}%*\n` +
    `War Tier: *${escapeMarkdown(String(war.tier || "seed"))}* | Havuz *${Number(war.value || 0).toFixed(0)}*\n\n` +
    `Kontrat: *${escapeMarkdown(contract.title || "Nexus Contract")}*\n` +
    `Hedef Mod: *${escapeMarkdown(contract.required_mode || "balanced")}*\n` +
    `Aile: ${escapeMarkdown(focusFamilies)}\n` +
    `Bonus: SC x${Number(bonus.sc_multiplier || 1).toFixed(2)} | +${Number(bonus.rc_flat_bonus || 0)} RC | +${Number(
      bonus.season_points || 0
    )} SP\n\n` +
    `Taktik: *${escapeMarkdown(tactical.recommended_mode || "balanced")}*\n` +
    `Sonraki Hamle: ${escapeMarkdown(tactical.next_step || "raid balanced")}`
  );
}

function formatUiMode(profile = {}, prefs = null, perf = null) {
  const resolved = prefs || {};
  const uiMode = String(resolved.ui_mode || "hardcore");
  const quality = String(resolved.quality_mode || "auto");
  const reduced = Boolean(resolved.reduced_motion);
  const largeType = Boolean(resolved.large_text);
  const fps = Number(perf?.fps_avg || 0);
  return (
    `*UI Mode*\n` +
    `Kral: *${escapeMarkdown(profile.public_name || "-")}*\n` +
    `Profil: *${escapeMarkdown(uiMode)}*\n` +
    `Quality: *${escapeMarkdown(quality)}* | Reduced Motion: *${reduced ? "ON" : "OFF"}*\n` +
    `Large Text: *${largeType ? "ON" : "OFF"}*\n` +
    `Son FPS(avg): *${fps > 0 ? fps.toFixed(1) : "-"}*\n\n` +
    `WebApp ayari: /play -> Perf dugmeleri (Auto/High/Low, Motion, Yazi)`
  );
}

function formatPerf(payload = {}) {
  const profile = payload.profile || {};
  const perf = payload.perf || {};
  const external = Array.isArray(payload.external) ? payload.external : [];
  const freeze = payload.freeze || {};
  const token = payload.token || {};
  const lines = external.length
    ? external
        .slice(0, 4)
        .map((row) => {
          const ok = row.healthy ? "OK" : "WARN";
          const code = Number(row.status_code || 0);
          const latency = Number(row.latency_ms || 0);
          return `- ${escapeMarkdown(String(row.provider || "api"))}: ${ok} (${code}/${latency}ms)`;
        })
        .join("\n")
    : "- API health verisi yok";
  return (
    `*Perf + Health*\n` +
    `Kral: *${escapeMarkdown(profile.public_name || "-")}*\n` +
    `FPS(avg): *${Number(perf.fps_avg || 0).toFixed(1)}* | Frame: *${Number(perf.frame_time_ms || 0).toFixed(2)}ms*\n` +
    `Latency(avg): *${Number(perf.latency_avg_ms || 0).toFixed(1)}ms*\n` +
    `Dropped Frame: *${Number(perf.dropped_frames || 0)}*\n` +
    `Freeze: *${freeze.freeze ? "ON" : "OFF"}*\n` +
    `Token Symbol: *${escapeMarkdown(token.symbol || "NXT")}*\n\n` +
    `Dis API Durumu\n${lines}`
  );
}

function formatAdminPanel(snapshot, isAdmin) {
  if (!isAdmin) {
    return `*Admin Panel*\nBu panel sadece admin hesaba aciktir.`;
  }

  const payoutLines =
    (snapshot.pendingPayouts || []).length > 0
      ? snapshot.pendingPayouts
          .slice(0, 5)
          .map((row) => `#${row.id} u${row.user_id} ${Number(row.amount || 0).toFixed(8)} BTC`)
          .join("\n")
      : "Bekleyen payout yok";

  const tokenLines =
    (snapshot.pendingTokenRequests || []).length > 0
      ? snapshot.pendingTokenRequests
          .slice(0, 5)
          .map(
            (row) =>
              `#${row.id} u${row.user_id} ${Number(row.usd_amount || 0).toFixed(2)} USD -> ${Number(row.token_amount || 0).toFixed(4)} ${escapeMarkdown(
                row.token_symbol || "NXT"
              )} [${escapeMarkdown(String(row.status || "").toUpperCase())}]`
          )
          .join("\n")
      : "Bekleyen token talebi yok";

  return (
    `*Admin Kontrol Merkezi*\n` +
    `Admin ID: *${snapshot.adminTelegramId}*\n` +
    `Freeze: *${snapshot.freeze?.freeze ? "ACIK" : "KAPALI"}*` +
    (snapshot.freeze?.reason ? `\nFreeze Sebep: ${escapeMarkdown(snapshot.freeze.reason)}` : "") +
    `\n\nToplam Kullanici: *${snapshot.totalUsers}*` +
    `\nAktif Deneme: *${snapshot.activeAttempts}*` +
    `\nPayout Queue: *${snapshot.pendingPayoutCount}*` +
    `\nToken Queue: *${snapshot.pendingTokenCount}*` +
    `\nToken Supply: *${Number(snapshot.token?.supply || 0).toFixed(4)} ${escapeMarkdown(snapshot.token?.symbol || "NXT")}*` +
    `\nToken Market Cap: *$${Number(snapshot.token?.marketCapUsd || 0).toFixed(2)}*` +
    `\n\n*Bekleyen Payoutlar*\n${payoutLines}` +
    `\n\n*Bekleyen Token Talepleri*\n${tokenLines}` +
    `\n\nKomutlar: /pay <id> <txhash>, /reject_payout <id> <sebep>, /approve_token <id>, /reject_token <id> <sebep>`
  );
}

function formatAdminWhoami(telegramId, adminTelegramId) {
  const isAdmin = Number(telegramId || 0) === Number(adminTelegramId || 0);
  const nextStep = isAdmin
    ? "Durum: admin kilidi dogru."
    : "Fix: /whoami ID degerini local + Render ADMIN_TELEGRAM_ID alanina birebir yaz.";
  return (
    `*Kimlik Kontrol*\n` +
    `Telegram ID: *${Number(telegramId || 0)}*\n` +
    `Config Admin ID: *${Number(adminTelegramId || 0)}*\n` +
    `Yetki: *${isAdmin ? "ADMIN" : "USER"}*\n` +
    `${escapeMarkdown(nextStep)}`
  );
}

function formatAdminActionResult(title, details) {
  return `*${escapeMarkdown(title)}*\n${escapeMarkdown(details || "islem tamamlandi")}`;
}

function formatAdminLive(payload = {}) {
  const snapshot = payload.snapshot || {};
  const metrics = payload.metrics || {};
  const runtime = payload.runtime || {};
  const webappUrl = String(payload.webappUrl || "");
  const freeze = snapshot.freeze || {};
  const token = snapshot.token || {};
  const gate = token.payoutGate || {};
  const payoutQueue = Number(snapshot.pendingPayoutCount || 0);
  const tokenQueue = Number(snapshot.pendingTokenCount || 0);
  const critical =
    freeze.freeze || payoutQueue > 0 || tokenQueue > 0
      ? "Aksiyon gerekli"
      : "Stabil";
  const queueHint =
    payoutQueue + tokenQueue > 0
      ? `Payout ${payoutQueue} | Token ${tokenQueue}`
      : "Queue temiz";
  const hb = runtime.last_heartbeat_at
    ? new Date(runtime.last_heartbeat_at).toISOString().slice(11, 19)
    : "-";
  const runtimeMode = String(runtime.mode || "unknown");
  const runtimeAlive = runtime.alive ? "ON" : "OFF";
  const runtimeLock = runtime.lock_acquired ? "LOCK" : "NOLOCK";
  const release = payload.release || {};
  const flags = payload.flags || {};
  const releaseShort = String(release.gitRevision || "").slice(0, 7) || "-";
  const flagSource = String(flags.sourceMode || "env_locked");
  const flagLine = Array.isArray(flags.critical)
    ? flags.critical.map((x) => `${x.key}:${x.enabled ? "1" : "0"}`).join(" ")
    : "";
  const nextAction = freeze.freeze
    ? "Next: /admin_freeze off"
    : payoutQueue > 0
      ? "Next: /admin_payouts"
      : tokenQueue > 0
        ? "Next: /admin_tokens"
        : gate.allowed
          ? "Next: /admin_metrics veya /play"
          : "Next: /admin_token_gate (gate kapali)";

  return (
    `*Admin Live*\n` +
    `Durum: *${critical}*\n` +
    `Freeze: *${freeze.freeze ? "ON" : "OFF"}*` +
    (freeze.reason ? ` (${escapeMarkdown(freeze.reason)})` : "") +
    `\nUsers: *${Number(snapshot.totalUsers || 0)}* | Active Attempt: *${Number(snapshot.activeAttempts || 0)}*\n` +
    `Queue: *${queueHint}*\n` +
    `Token: *${escapeMarkdown(token.symbol || "NXT")}* | Spot *$${Number(token.spotUsd || 0).toFixed(8)}* | Cap *$${Number(
      token.marketCapUsd || 0
    ).toFixed(2)}*\n` +
    `Gate: *${gate.allowed ? "OPEN" : "LOCKED"}* (${Number(gate.current || 0).toFixed(2)} / ${Number(gate.min || 0).toFixed(2)})\n\n` +
    `Bot Runtime: *${runtimeAlive}* | *${runtimeLock}* | *${escapeMarkdown(runtimeMode)}* | HB *${escapeMarkdown(hb)}*\n` +
    `Release: *${escapeMarkdown(releaseShort)}* | Flags: *${escapeMarkdown(flagSource)}*\n` +
    (flagLine ? `Critical: \`${escapeMarkdown(flagLine)}\`\n` : "") +
    `24s: users *${Number(metrics.users_active_24h || 0)}* | reveal *${Number(metrics.reveals_24h || 0)}* | token *$${Number(
      metrics.token_usd_volume_24h || 0
    ).toFixed(2)}*\n\n` +
    `${escapeMarkdown(nextAction)}\n` +
    (webappUrl ? `WebApp: ${escapeMarkdown(webappUrl)}\n` : "") +
    `Komutlar: /admin, /admin_payouts, /admin_tokens, /admin_metrics`
  );
}

module.exports = {
  formatStart,
  formatGuide,
  formatOnboard,
  formatNexusPulse,
  formatProfile,
  formatTasks,
  formatTaskStarted,
  formatTaskComplete,
  formatLootReveal,
  formatStreak,
  formatWallet,
  formatTokenWallet,
  formatTokenMintResult,
  formatTokenMintError,
  formatTokenBuyIntent,
  formatTokenBuyIntentError,
  formatTokenTxSubmitted,
  formatTokenTxError,
  formatTokenDecisionUpdate,
  formatDaily,
  formatSeason,
  formatLeaderboard,
  formatShop,
  formatPurchaseResult,
  formatMissions,
  formatMissionClaim,
  formatWar,
  formatKingdom,
  formatPayout,
  formatPayoutDecisionUpdate,
  formatFreezeMessage,
  formatOps,
  formatArenaStatus,
  formatArenaRaidResult,
  formatHelp,
  formatHelpIndex,
  formatHelpCommandCard,
  formatHelpNotFound,
  formatHelpAccessDenied,
  formatRaidContract,
  formatUiMode,
  formatPerf,
  formatAdminQueue,
  formatAdminPanel,
  formatAdminLive,
  formatAdminWhoami,
  formatAdminActionResult
};

