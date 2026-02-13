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

function formatStart(profile, balances, season, anomaly, contract) {
  const publicName = escapeMarkdown(profile.public_name);
  const sc = balances?.SC || 0;
  const hc = balances?.HC || 0;
  const rc = balances?.RC || 0;
  const seasonLine = season ? `\nSezon: *S${season.seasonId}* - ${season.daysLeft} gun` : "";
  const anomalyLine = anomaly
    ? `\nNexus: *${escapeMarkdown(anomaly.title)}* (${anomaly.pressure_pct}% basinc, ${anomaly.preferred_mode})`
    : "";
  const contractLine = contract
    ? `\nKontrat: *${escapeMarkdown(contract.title)}* [${escapeMarkdown(contract.required_mode)}]`
    : "";
  return (
    `*AirdropKralBot // Kingdom Console*\n` +
    `Kral: *${publicName}*\n` +
    `Kingdom: *Tier ${profile.kingdom_tier}*\n` +
    `Streak: *${profile.current_streak} gun*\n` +
    `Bakiye: *${sc} SC / ${hc} HC / ${rc} RC*${seasonLine}${anomalyLine}${contractLine}\n\n` +
    `*3 Adimlik Hizli Baslangic*\n` +
    `1) /tasks ile gorev sec ve deneme ac\n` +
    `2) /finish dengeli ile denemeyi kapat\n` +
    `3) /reveal ile dropu al, /wallet ile verimi kontrol et\n\n` +
    `*Neden bu dongu?*\n` +
    `Micro: gorev -> bitir -> reveal\n` +
    `Meso: gunluk cap + streak zinciri\n` +
    `Macro: sezon puani + arena rank\n\n` +
    `Hud: ${progressBar(profile.current_streak, 14, 14)}\n` +
    `Aksiyon: /tasks -> /shop -> /leaderboard`
  );
}

function formatGuide(snapshot) {
  const profile = snapshot?.profile || {};
  const daily = snapshot?.daily || {};
  const attempts = snapshot?.attempts || {};
  const offers = snapshot?.offers || [];
  const balances = snapshot?.balances || {};
  const anomaly = snapshot?.anomaly || null;
  const contract = snapshot?.contract || null;
  const hasActive = Boolean(attempts.active);
  const hasReveal = Boolean(attempts.revealable);
  const nextStep = hasReveal
    ? "1) /reveal ile mevcut kasayi ac."
    : hasActive
      ? "1) /finish dengeli ile denemeyi tamamla."
      : offers.length > 0
        ? "1) /tasks ile panelden bir gorev sec."
        : Number(balances.RC || 0) > 0
          ? "1) /tasks ac, gerekirse Panel Yenile kullan."
          : "1) RC kazanmak icin gorev dongusunu ac.";

  return (
    `*Nexus Rehber*\n` +
    `Kral: *${escapeMarkdown(profile.public_name || "oyuncu")}*\n` +
    `Tier: *${profile.kingdom_tier || 0}* | Streak: *${profile.current_streak || 0} gun*\n` +
    `Gunluk: *${Number(daily.tasksDone || 0)}/${Number(daily.dailyCap || 0)} gorev*` +
    (anomaly ? `\nNexus: *${escapeMarkdown(anomaly.title || "-")}* (${anomaly.preferred_mode || "balanced"})` : "") +
    (contract
      ? `\nKontrat: *${escapeMarkdown(contract.title || "-")}* [${escapeMarkdown(contract.required_mode || "balanced")}]`
      : "") +
    `\n\n` +
    `*Su an en iyi hamle*\n` +
    `${nextStep}\n\n` +
    `*Standart Akis*\n` +
    `- /tasks -> gorev kabul\n` +
    `- /finish [safe|balanced|aggressive] -> deneme sonucu\n` +
    `- /reveal -> kesin odul\n` +
    `- /missions ve /daily -> ek odul\n` +
    `- /play -> Nexus Arena web paneli\n\n` +
    `Kisa yazim: "gorev", "bitir dengeli", "reveal", "raid aggressive"`
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
  return (
    `*Cekim Durumu*\n` +
    `Entitlement: *${entitled} BTC*\n` +
    `Esik: *${threshold} BTC*\n` +
    `Cooldown: *${cooldown}*\n\n` +
    `Uygunluk: *${eligibility}*${gateLine}${latestLine}${txLine}\n` +
    `Model: entitlement-only, odeme disaridan admin tarafinda islenir.`
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

function formatHelp() {
  return (
    `*Komutlar*\n` +
    `/guide - Hizli baslangic rehberi\n` +
    `/tasks - Gorev havuzu\n` +
    `/finish [safe|balanced|aggressive] - Son aktif gorevi bitir\n` +
    `/reveal - Son biten gorevi ac\n` +
    `/raid [safe|balanced|aggressive] - Arena raid baslat\n` +
    `/arena_rank - Arena siralama + rating\n` +
    `/wallet - Bakiye ve gunluk cap\n` +
    `/token - Token treasury ve son talepler\n` +
    `/mint [miktar] - SC/HC/RC birimlerini tokena cevir\n` +
    `/buytoken <usd> <chain> - Token satin alma talebi\n` +
    `/tx <requestId> <txHash> - Satin alma tx hash bildir\n` +
    `/daily - Gunluk operasyon paneli\n` +
    `/kingdom - Tier ve reputasyon durumu\n` +
    `/season - Sezon ilerleme\n` +
    `/leaderboard - Top 10\n` +
    `/shop - Boost ve pass dukkani\n` +
    `/missions - Gunluk oduller\n` +
    `/war - Topluluk savasi\n` +
    `/nexus - Gunun event ve taktik pulse\n` +
    `/contract - Gunun kontrat hedefi\n` +
    `/play - Arena 3D arayuz\n` +
    `/arena - Arena 3D arayuz (alias)\n` +
    `/arena3d - Arena 3D arayuz (alias)\n` +
    `Slashsiz kisayollar: "gorev", "bitir dengeli", "reveal", "raid aggressive"\n` +
    `/ops - Operasyon konsolu (risk + event)\n` +
    `/status - Sistem snapshot\n` +
    `/payout - Cekim paneli\n` +
    `/streak - Zincir durumu\n` +
    `/profile - Kimlik karti\n\n` +
    `Admin: /admin, /admin_config, /admin_metrics, /admin_freeze, /admin_token_price, /admin_token_gate`
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
  return (
    `*Kimlik Kontrol*\n` +
    `Telegram ID: *${Number(telegramId || 0)}*\n` +
    `Config Admin ID: *${Number(adminTelegramId || 0)}*\n` +
    `Yetki: *${isAdmin ? "ADMIN" : "USER"}*`
  );
}

function formatAdminActionResult(title, details) {
  return `*${escapeMarkdown(title)}*\n${escapeMarkdown(details || "islem tamamlandi")}`;
}

module.exports = {
  formatStart,
  formatGuide,
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
  formatFreezeMessage,
  formatOps,
  formatArenaStatus,
  formatArenaRaidResult,
  formatHelp,
  formatAdminPanel,
  formatAdminWhoami,
  formatAdminActionResult
};

