/**
 * Phone-number helpers. Mirror the backend rules in `src/lib/phone.ts`:
 * normalize to digits-only for lookup/storage, and validate the raw input
 * with the same regex.
 */

export const PHONE_INPUT_REGEX = /^[0-9+\-\s()]{5,20}$/;

export function normalizePhone(input: string): string {
  return (input ?? "").replace(/\D+/g, "");
}

export function isValidPhoneInput(input: string): boolean {
  return PHONE_INPUT_REGEX.test(input ?? "");
}

/**
 * Build an international phone number suitable for `wa.me/<intl>` deep-links.
 * Handles common Egyptian and `+`-prefixed inputs without baking in a single
 * country code.
 */
export function toInternationalPhone(input: string, defaultCountryCode = "20"): string {
  const digits = normalizePhone(input);
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return defaultCountryCode + digits.slice(1);
  return digits;
}
