export * from "./generated/api";
export * from "./generated/api.schemas";
// Hand-written trainer-portal client. Lives here (rather than in
// `pages/trainer/`) so the rest of the app — and any future automated
// generator — can import the same hooks.
export * from "./trainer";
export {
  setBaseUrl,
  setAuthTokenGetter,
  setAuthRefreshHandler,
  setUnauthorizedHandler,
} from "./custom-fetch";
export type { AuthTokenGetter, AuthRefreshHandler, UnauthorizedHandler } from "./custom-fetch";
