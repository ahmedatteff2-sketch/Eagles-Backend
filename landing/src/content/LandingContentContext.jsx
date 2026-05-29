import { createContext, useContext, useEffect, useState } from "react";

// Defaults mirror the server's DEFAULT_LANDING_CONTENT so the page renders
// correct copy on first paint, before (or if) the API call resolves.
export const DEFAULT_CONTENT = {
  hero: {
    headingTop: "اجعل جسمك",
    headingBottom: "صحياً ومثالياً",
    ctaText: "خدماتنا",
    backgroundImage: "",
  },
  about: {
    heading: "ارتقِ بصحتك وجسمك إلى المستوى التالي",
    paragraph:
      "ارتقِ بصحتك وجسمك من خلال برنامجنا الشامل المصمم لمساعدتك على تحقيق أهدافك في اللياقة البدنية.",
  },
  pricing: {
    plans: [
      {
        badge: "BASIC",
        price: "175 جنيه",
        period: "شهر",
        features: ["برنامج عام", "برنامج تدريبي ثابت"],
        highlighted: false,
        image: "",
      },
      {
        badge: "TRANSFORM",
        price: "210 جنيه",
        period: "شهر",
        features: [
          "برنامج تدريب حسب الهدف",
          "متابعة غذائية أسبوعية",
          "جلسة توجيه في بداية كل شهر",
          "خصم 20% على اشتراك اللوكر",
          "خصم 20٪ على القهوه",
        ],
        highlighted: true,
        image: "",
      },
      {
        badge: "ELITE",
        price: "250 جنيه",
        period: "شهر",
        features: [
          "مدرب شخصي",
          "نظام غذائي كامل شهري",
          "تقييم لياقة أسبوعي",
          "تواصل ومتابعة يومية",
          "قياس انبودي يدوي اسبوعي",
          "خصم 50% على اللوكر",
          "خصم 50% على القهوة",
        ],
        highlighted: false,
        image: "",
      },
    ],
  },
  social: {
    facebook: "https://www.facebook.com/share/1SiyGixMRB/?mibextid=wwXIfr",
    instagram: "https://www.instagram.com/shazly_gym?igsh=MXZhZXllOTdsaHkz&utm_source=qr",
    tiktok: "https://www.tiktok.com/@shazly.gym?_t=ZS-90onHCZMJSp&_r=1",
    whatsapp: "https://wa.me/201124045247",
    phone: "201124045247",
  },
};

const LandingContentContext = createContext(DEFAULT_CONTENT);

// Shallow-merge fetched content over defaults so any missing section/field
// keeps its default rather than rendering blank.
function merge(remote) {
  if (!remote || typeof remote !== "object") return DEFAULT_CONTENT;
  return {
    hero: { ...DEFAULT_CONTENT.hero, ...(remote.hero ?? {}) },
    about: { ...DEFAULT_CONTENT.about, ...(remote.about ?? {}) },
    pricing: {
      plans:
        Array.isArray(remote.pricing?.plans) && remote.pricing.plans.length > 0
          ? remote.pricing.plans
          : DEFAULT_CONTENT.pricing.plans,
    },
    social: { ...DEFAULT_CONTENT.social, ...(remote.social ?? {}) },
  };
}

export function LandingContentProvider({ children }) {
  const [content, setContent] = useState(DEFAULT_CONTENT);

  useEffect(() => {
    let active = true;
    fetch("/api/landing-content", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setContent(merge(data));
      })
      .catch(() => {
        /* keep defaults — the public page must never break on a failed fetch */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <LandingContentContext.Provider value={content}>{children}</LandingContentContext.Provider>
  );
}

export function useLandingContent() {
  return useContext(LandingContentContext);
}
