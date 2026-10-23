/**
 * OpenRouter is CORS-enabled, so it should be called directly instead of
 * through this app's own /api/openrouter hop. The hop is only needed to borrow
 * the server's key, so it must remain the fallback for keyless callers.
 */
import { ApiPath, OPENROUTER_BASE_URL } from "../app/constant";
import { resolveOpenRouterBaseUrl } from "../app/utils/provider-routing";

const base = (over: Partial<Parameters<typeof resolveOpenRouterBaseUrl>[0]>) =>
  resolveOpenRouterBaseUrl({
    isApp: false,
    useCustomConfig: false,
    customUrl: "",
    hasOwnKey: false,
    ...over,
  });

describe("resolveOpenRouterBaseUrl", () => {
  test("goes direct when the caller has its own key", () => {
    expect(base({ hasOwnKey: true })).toBe(OPENROUTER_BASE_URL);
  });

  test("uses the same-origin route when it needs the server's key", () => {
    expect(base({ hasOwnKey: false })).toBe(ApiPath.OpenRouter);
  });

  test("goes direct in the packaged app, which has no server to route through", () => {
    expect(base({ isApp: true })).toBe(OPENROUTER_BASE_URL);
  });

  test("honours a custom endpoint over everything else", () => {
    expect(
      base({
        useCustomConfig: true,
        customUrl: "https://my-gateway.example/v1",
        hasOwnKey: true,
        isApp: true,
      }),
    ).toBe("https://my-gateway.example/v1");
  });

  test("ignores an empty custom endpoint", () => {
    expect(base({ useCustomConfig: true, customUrl: "" })).toBe(
      ApiPath.OpenRouter,
    );
  });
});
