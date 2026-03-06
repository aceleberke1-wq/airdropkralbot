import { t, type Lang } from "../../i18n";

type MetaStripProps = {
  lang: Lang;
  variant: string;
  sessionRef: string;
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
    </section>
  );
}

