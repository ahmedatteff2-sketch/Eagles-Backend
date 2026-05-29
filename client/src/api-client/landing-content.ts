import { customFetch } from "./custom-fetch";

export interface LandingPricingPlan {
  badge: string;
  price: string;
  period: string;
  features: string[];
  highlighted: boolean;
  image?: string;
}

export interface LandingContent {
  hero: {
    headingTop: string;
    headingBottom: string;
    ctaText: string;
    backgroundImage?: string;
  };
  about: {
    heading: string;
    paragraph: string;
  };
  pricing: {
    plans: LandingPricingPlan[];
  };
  social: {
    facebook: string;
    instagram: string;
    tiktok: string;
    whatsapp: string;
    phone: string;
  };
}

export const getLandingContent = () => customFetch<LandingContent>("/api/landing-content", { method: "GET" });

export const updateLandingContent = (data: LandingContent) =>
  customFetch<LandingContent>("/api/landing-content", {
    method: "PUT",
    body: JSON.stringify(data),
  });
