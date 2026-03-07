import { t, type Lang } from "../../../i18n";

type DynamicPolicyCardProps = {
  lang: Lang;
  dynamicPolicyData: Record<string, unknown> | null;
  dynamicPolicyTokenSymbol: string;
  dynamicPolicyDraft: string;
  dynamicPolicyError: string;
  dynamicPolicySaving: boolean;
  onDynamicPolicyTokenSymbolChange: (value: string) => void;
  onDynamicPolicyDraftChange: (value: string) => void;
  onRefreshDynamicPolicy: () => void;
  onSaveDynamicPolicy: () => void;
};

export function DynamicPolicyCard(props: DynamicPolicyCardProps) {
  return (
    <section className="akrCard akrCardWide" data-akr-panel-key="panel_admin_policy" data-akr-focus-key="dynamic_policy">
      <h3>{t(props.lang, "admin_dynamic_policy_title")}</h3>
      <div className="akrInputRow">
        <input
          value={props.dynamicPolicyTokenSymbol}
          onChange={(e) => props.onDynamicPolicyTokenSymbolChange(e.target.value)}
          aria-label="dynamic-policy-token-symbol"
        />
      </div>
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshDynamicPolicy}>
          {t(props.lang, "admin_dynamic_policy_refresh")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onSaveDynamicPolicy} disabled={props.dynamicPolicySaving}>
          {props.dynamicPolicySaving ? t(props.lang, "admin_dynamic_policy_saving") : t(props.lang, "admin_dynamic_policy_save")}
        </button>
      </div>
      <textarea
        className="akrTextarea"
        value={props.dynamicPolicyDraft}
        onChange={(e) => props.onDynamicPolicyDraftChange(e.target.value)}
        aria-label="dynamic-policy-draft"
        spellCheck={false}
      />
      {props.dynamicPolicyError ? <p className="akrErrorLine">{props.dynamicPolicyError}</p> : null}
      <pre className="akrJsonBlock">{JSON.stringify(props.dynamicPolicyData || {}, null, 2)}</pre>
    </section>
  );
}
