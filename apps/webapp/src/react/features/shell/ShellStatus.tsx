import { t, type Lang } from "../../i18n";

type ShellStatusProps = {
  lang: Lang;
  loading: boolean;
  error: string;
};

export function ShellStatus(props: ShellStatusProps) {
  return (
    <>
      {props.loading && <div className="akrToast">{t(props.lang, "loading")}</div>}
      {props.error && !props.loading && (
        <div className="akrToast akrToastError">
          {t(props.lang, "error_prefix")}: {props.error}
        </div>
      )}
    </>
  );
}

