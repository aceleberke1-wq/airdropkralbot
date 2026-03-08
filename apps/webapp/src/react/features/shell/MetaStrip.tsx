import { t, type Lang } from "../../i18n";

type MetaStripProps = {
  lang: Lang;
  variant: string;
  sessionRef: string;
  qualityMode: string;
  effectiveQuality: string;
  perfTier: string;
  deviceClass: string;
  sceneProfile: string;
};

export function MetaStrip(props: MetaStripProps) {
  return (
    <section className="akrMetaStrip akrGlass">
      <span>
        {t(props.lang, "variant")}: {props.variant || "-"}
      </span>
      <span>
        {t(props.lang, "analytics")}: {props.sessionRef || "-"}
      </span>
      <span>
        {t(props.lang, "quality")}: {props.qualityMode || "-"} / {props.effectiveQuality || "-"}
      </span>
      <span>
        {t(props.lang, "meta_perf_tier")}: {props.perfTier || "-"}
      </span>
      <span>
        {t(props.lang, "meta_device_class")}: {props.deviceClass || "-"}
      </span>
      <span>
        {t(props.lang, "meta_scene_profile")}: {props.sceneProfile || "-"}
      </span>
    </section>
  );
}
