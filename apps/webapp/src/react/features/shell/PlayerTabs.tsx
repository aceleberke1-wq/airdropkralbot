import { tabLabel, type Lang } from "../../i18n";
import type { TabKey } from "../../types";

type PlayerTabsProps = {
  lang: Lang;
  tab: TabKey;
  tabs: TabKey[];
  onChange: (tab: TabKey) => void;
};

export function PlayerTabs(props: PlayerTabsProps) {
  return (
    <nav className="akrTabs">
      {props.tabs.map((entry) => (
        <button key={entry} className={`akrTab ${props.tab === entry ? "isActive" : ""}`} onClick={() => props.onChange(entry)}>
          {tabLabel(props.lang, entry)}
        </button>
      ))}
    </nav>
  );
}

