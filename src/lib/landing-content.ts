import { z } from "zod";

// ── Landing CMS content model ────────────────────────────────────────────────
// The public marketing landing page (the standalone build served at /landing/)
// renders from this single document. Admins edit it from /admin/landing; the
// landing fetches it from GET /api/landing-content. Every field falls back to
// the landing's own hard-coded defaults when empty, so a partial document can
// never break the page.

// Images are stored inline as base64 data URLs — the same convention the app
// already uses for member progress photos. ~3MB ceiling keeps a single row
// from ballooning while comfortably fitting a downscaled hero/plan image.
const imageUrl = z.string().max(3_500_000);

export const landingContentSchema = z.object({
  hero: z.object({
    headingTop: z.string().max(120),
    headingBottom: z.string().max(120),
    ctaText: z.string().max(60),
    backgroundImage: imageUrl.optional().default(""),
  }),
  about: z.object({
    heading: z.string().max(200),
    paragraph: z.string().max(1000),
  }),
  pricing: z.object({
    plans: z
      .array(
        z.object({
          badge: z.string().max(60),
          price: z.string().max(40),
          period: z.string().max(40),
          features: z.array(z.string().max(200)).max(20),
          highlighted: z.boolean(),
          image: imageUrl.optional().default(""),
        }),
      )
      .max(12),
  }),
  social: z.object({
    facebook: z.string().max(500),
    instagram: z.string().max(500),
    tiktok: z.string().max(500),
    whatsapp: z.string().max(500),
    phone: z.string().max(40),
  }),
});

export type LandingContent = z.infer<typeof landingContentSchema>;

// Seed/fallback content mirrors the landing's original hard-coded copy so the
// page looks identical until an admin changes something.
export const DEFAULT_LANDING_CONTENT: LandingContent = {
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
