import { t, type Lang } from "../../i18n";

type OnboardingOverlayProps = {
  lang: Lang;
  onContinue: () => void;
};

export function OnboardingOverlay(props: OnboardingOverlayProps) {
  return (
    <div className="akrOnboardingOverlay">
      <div className="akrOnboardingCard">
        <p className="akrKicker">React V1</p>
        <h2>{t(props.lang, "onboarding_title")}</h2>
        <p>{t(props.lang, "onboarding_body")}</p>
        <button className="akrBtn akrBtnAccent" onClick={props.onContinue}>
          {t(props.lang, "onboarding_continue")}
        </button>
      </div>
    </div>
  );
}

