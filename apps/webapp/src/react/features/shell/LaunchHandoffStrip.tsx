import { t, type Lang } from "../../i18n";

type LaunchHandoffStripProps = {
  lang: Lang;
  routeLabel: string;
  panelLabel: string;
  focusLabel: string;
};

export function LaunchHandoffStrip(props: LaunchHandoffStripProps) {
  const detail = [props.routeLabel, props.panelLabel, props.focusLabel].filter(Boolean).join(" / ");
  if (!detail) {
    return null;
  }
  return (
    <section className="akrLaunchStrip akrGlass" aria-live="polite">
      <strong>{t(props.lang, "launch_handoff_title")}</strong>
      <span>
        {t(props.lang, "launch_handoff_body")} {detail}
      </span>
    </section>
  );
}
