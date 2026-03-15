import { useState } from "react";
import { t, type Lang } from "../../i18n";

type OnboardingOverlayProps = {
  lang: Lang;
  onContinue: () => void;
};

const STEPS = [
  { icon: "🏠", key: "onboarding_step_1" },
  { icon: "⚔️", key: "onboarding_step_2" },
  { icon: "💰", key: "onboarding_step_3" }
] as const;

export function OnboardingOverlay(props: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="akrOnboardingOverlay">
      <div className="akrOnboardingCard">
        <div className="akrOnboardingLogo">🏰</div>
        <h2 className="akrOnboardingTitle">{t(props.lang, "onboarding_title")}</h2>
        <p className="akrOnboardingBody">{t(props.lang, "onboarding_body")}</p>

        <div className="akrOnboardingSteps">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`akrOnboardingStep${i === step ? " isActive" : ""}${i < step ? " isDone" : ""}`}
            >
              <span className="akrOnboardingStepIcon">{i < step ? "✅" : s.icon}</span>
              <span className="akrOnboardingStepText">{t(props.lang, s.key)}</span>
            </div>
          ))}
        </div>

        <div className="akrOnboardingDots">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`akrOnboardingDot${i === step ? " isActive" : ""}`}
            />
          ))}
        </div>

        <div className="akrOnboardingActions">
          {step > 0 && (
            <button
              className="akrBtn akrBtnGhost"
              onClick={() => setStep(step - 1)}
            >
              ← {props.lang === "en" ? "Back" : "Geri"}
            </button>
          )}
          <button
            className="akrBtn akrBtnAccent"
            onClick={() => {
              if (isLastStep) {
                props.onContinue();
              } else {
                setStep(step + 1);
              }
            }}
          >
            {isLastStep ? t(props.lang, "onboarding_continue") : (props.lang === "en" ? "Next →" : "İleri →")}
          </button>
        </div>
      </div>
    </div>
  );
}
