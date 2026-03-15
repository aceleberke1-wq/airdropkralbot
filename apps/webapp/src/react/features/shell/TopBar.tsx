import { normalizeLang, t, type Lang } from "../../i18n";

type TopBarProps = {
  lang: Lang;
  advanced: boolean;
  showAdvancedToggle?: boolean;
  showWorkspaceToggle?: boolean;
  showAccessibilityControls?: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  workspace: "player" | "admin";
  onRefresh: () => void;
  onToggleAdvanced: (next: boolean) => void;
  onToggleReducedMotion: (next: boolean) => void;
  onToggleLargeText: (next: boolean) => void;
  onToggleLanguage: (next: Lang) => void;
  onToggleWorkspace: (next: "player" | "admin") => void;
};

export function TopBar(props: TopBarProps) {
  return (
    <header className="akrTopbar akrGlass">
      <div className="akrBrand">
        <p className="akrKicker">AirdropKralBot</p>
        <h1>{t(props.lang, "app_title")}</h1>
        <p className="akrMuted">{t(props.lang, "app_subtitle")}</p>
      </div>
      <div className="akrTopbarActions">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefresh}>
          {t(props.lang, "refresh")}
        </button>
        {props.showAdvancedToggle ? (
          <button
            className="akrBtn akrBtnGhost"
            onClick={() => {
              props.onToggleAdvanced(!props.advanced);
            }}
          >
            {props.advanced ? t(props.lang, "advanced_on") : t(props.lang, "advanced_off")}
          </button>
        ) : null}
        {props.showAccessibilityControls ? (
          <>
            <button
              className="akrBtn akrBtnGhost"
              onClick={() => {
                props.onToggleReducedMotion(!props.reducedMotion);
              }}
              data-akr-panel-key="language"
              data-akr-focus-key="accessibility"
            >
              {props.reducedMotion ? t(props.lang, "reduced_motion_on") : t(props.lang, "reduced_motion_off")}
            </button>
            <button
              className="akrBtn akrBtnGhost"
              onClick={() => {
                props.onToggleLargeText(!props.largeText);
              }}
              data-akr-panel-key="language"
              data-akr-focus-key="accessibility"
            >
              {props.largeText ? t(props.lang, "large_text_on") : t(props.lang, "large_text_off")}
            </button>
          </>
        ) : null}
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => {
            const next = normalizeLang(props.lang) === "tr" ? "en" : "tr";
            props.onToggleLanguage(next);
          }}
          data-akr-panel-key="language"
          data-akr-focus-key="locale_override"
        >
          {t(props.lang, "language")}: {String(props.lang).toUpperCase()}
        </button>
        {props.showWorkspaceToggle ? (
          <button
            className="akrBtn akrBtnAccent"
            onClick={() => props.onToggleWorkspace(props.workspace === "player" ? "admin" : "player")}
          >
            {props.workspace === "player" ? t(props.lang, "workspace_admin") : t(props.lang, "workspace_player")}
          </button>
        ) : null}
      </div>
    </header>
  );
}
