import { ApiPath, OPENROUTER_BASE_URL } from "../constant";

/**
 * Routing policy for OpenRouter.
 *
 * OpenRouter answers CORS preflight with `access-control-allow-origin: *`, so a
 * browser can call `https://openrouter.ai/api` directly. The same-origin
 * `/api/openrouter` route exists only to borrow the server's key, so we stay
 * direct whenever the request carries a key of its own — or when we are the
 * packaged app, which is not subject to CORS and has no server to route through.
 */
export function resolveOpenRouterBaseUrl(options: {
  isApp: boolean;
  useCustomConfig: boolean;
  customUrl: string;
  hasOwnKey: boolean;
}): string {
  const { isApp, useCustomConfig, customUrl, hasOwnKey } = options;

  if (useCustomConfig && customUrl.length > 0) {
    return customUrl;
  }

  return isApp || hasOwnKey ? OPENROUTER_BASE_URL : ApiPath.OpenRouter;
}
