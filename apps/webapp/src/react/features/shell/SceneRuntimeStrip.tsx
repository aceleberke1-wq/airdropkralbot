import { t, type Lang } from "../../i18n";

type SceneRuntimeStripProps = {
  lang: Lang;
  phase: "idle" | "preparing" | "ready" | "error";
  districtKey: string;
  profileKey: string;
  effectiveQuality: string;
  lowEndMode: boolean;
  loadedBundles: string[];
  skippedBundles: string[];
  error: string;
};

function resolvePhaseLabel(lang: Lang, phase: SceneRuntimeStripProps["phase"]) {
  if (phase === "ready") {
    return t(lang, "scene_runtime_ready");
  }
  if (phase === "error") {
    return t(lang, "scene_runtime_error");
  }
  if (phase === "preparing") {
    return t(lang, "scene_runtime_preparing");
  }
  return t(lang, "loading");
}

export function SceneRuntimeStrip(props: SceneRuntimeStripProps) {
  return (
    <section className={`akrLaunchStrip akrGlass${props.phase === "error" ? " akrToastError" : ""}`} aria-live="polite">
      <strong>{t(props.lang, "scene_runtime_title")}</strong>
      <span>
        {resolvePhaseLabel(props.lang, props.phase)} {props.districtKey || "-"} / {props.effectiveQuality || "-"} /{" "}
        {props.lowEndMode ? t(props.lang, "scene_runtime_lite") : t(props.lang, "scene_runtime_full")}
      </span>
      <span>
        {t(props.lang, "scene_runtime_bundles")}: {props.loadedBundles.length}
        {props.skippedBundles.length ? ` (+${props.skippedBundles.length} skip)` : ""}
      </span>
      <span>
        {t(props.lang, "scene_runtime_profile")}: {props.profileKey || "-"}
      </span>
      {props.error ? <span>{props.error}</span> : null}
    </section>
  );
}
