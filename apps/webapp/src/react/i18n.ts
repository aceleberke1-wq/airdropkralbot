import type { TabKey } from "./types";

export type Lang = "tr" | "en";

const DICT = {
  tr: {
    app_title: "Nexus Arena React V1",
    app_subtitle: "Neon operasyon shell",
    refresh: "Yenile",
    advanced_on: "Advanced: Acik",
    advanced_off: "Advanced: Kapali",
    workspace_player: "Player Workspace",
    workspace_admin: "Admin Workspace",
    onboarding_title: "Nexus'a Hos Geldin",
    onboarding_body: "Bu surumde sade varsayilan ve sinematik sahne bir arada calisir.",
    onboarding_step_1: "Home sekmesinde sezon ve kaynak durumunu gor.",
    onboarding_step_2: "PvP sekmesinden oturum ac ve ritmi takip et.",
    onboarding_step_3: "Tasks/Vault ile gunluk loop'u kapat.",
    onboarding_continue: "Basla",
    tab_home: "Home",
    tab_pvp: "PvP",
    tab_tasks: "Tasks",
    tab_vault: "Vault",
    home_overview: "Oyuncu Ozeti",
    home_season: "Sezon",
    home_daily: "Gunluk Loop",
    pvp_title: "PvP Director",
    pvp_start: "PvP Session Baslat",
    pvp_refresh: "PvP Durum Tazele",
    tasks_title: "Misyon Radar",
    vault_title: "Token & Payout",
    admin_title: "Admin Workspace",
    admin_refresh: "Admin Verisi Yenile",
    admin_access_denied: "Admin yetkisi bulunmuyor.",
    loading: "Yukleniyor...",
    error_prefix: "Hata",
    analytics: "Analitik",
    variant: "Variant",
    quality: "Kalite",
    language: "Dil"
  },
  en: {
    app_title: "Nexus Arena React V1",
    app_subtitle: "Neon operations shell",
    refresh: "Refresh",
    advanced_on: "Advanced: On",
    advanced_off: "Advanced: Off",
    workspace_player: "Player Workspace",
    workspace_admin: "Admin Workspace",
    onboarding_title: "Welcome to Nexus",
    onboarding_body: "This build combines a clean default flow with cinematic scene language.",
    onboarding_step_1: "Use Home to track season and resource status.",
    onboarding_step_2: "Open PvP and follow the action rhythm.",
    onboarding_step_3: "Close the daily loop via Tasks and Vault.",
    onboarding_continue: "Enter",
    tab_home: "Home",
    tab_pvp: "PvP",
    tab_tasks: "Tasks",
    tab_vault: "Vault",
    home_overview: "Player Overview",
    home_season: "Season",
    home_daily: "Daily Loop",
    pvp_title: "PvP Director",
    pvp_start: "Start PvP Session",
    pvp_refresh: "Refresh PvP State",
    tasks_title: "Mission Radar",
    vault_title: "Token & Payout",
    admin_title: "Admin Workspace",
    admin_refresh: "Refresh Admin Data",
    admin_access_denied: "No admin access for this account.",
    loading: "Loading...",
    error_prefix: "Error",
    analytics: "Analytics",
    variant: "Variant",
    quality: "Quality",
    language: "Language"
  }
} as const;

export function normalizeLang(input: unknown): Lang {
  return String(input || "")
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "tr";
}

export function t(lang: Lang, key: keyof (typeof DICT)["tr"]): string {
  return DICT[lang]?.[key] || DICT.tr[key] || key;
}

export function tabLabel(lang: Lang, tab: TabKey): string {
  const map: Record<TabKey, keyof (typeof DICT)["tr"]> = {
    home: "tab_home",
    pvp: "tab_pvp",
    tasks: "tab_tasks",
    vault: "tab_vault"
  };
  return t(lang, map[tab]);
}
