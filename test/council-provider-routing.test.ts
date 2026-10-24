/**
 * Council routing: OpenRouter may be called directly (it allows CORS), but
 * NVIDIA must always go through this app's same-origin route because NVIDIA
 * NIM sends no CORS headers and the browser cannot reach it otherwise.
 *
 * Stubs only the network boundary and records the URL of every request.
 */
import {
  ApiPath,
  OPENROUTER_BASE_URL,
  ServiceProvider,
  TOKENHARBOR_BASE_URL,
} from "../app/constant";
import type { CouncilParticipant } from "../app/store/config";
const urls: string[] = [];
jest.mock("../app/utils/stream", () => ({
  fetch: async (url: string) => {
    urls.push(url);
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
    } as any;
  },
}));
jest.mock("../app/client/api", () => ({
  getHeadersForProvider: () => ({ "Content-Type": "application/json" }),
}));
import { runCouncil } from "../app/utils/council";
const run = (participants: CouncilParticipant[]) => {
  urls.length = 0;
  return runCouncil({
    messages: [{ role: "user", content: "hi" }],
    participants,
    rounds: 1,
    synthesizerIndex: 0,
    mergeMode: "longest",
    controller: new AbortController(),
    onFinish: () => {},
    onError: (e) => {
      throw e;
    },
  });
};
describe("council provider routing", () => {
  test("an OpenRouter participant with its own key calls OpenRouter directly", async () => {
    await run([
      {
        id: "a",
        providerName: ServiceProvider.OpenRouter,
        model: "openai/gpt-4o",
        apiKey: "sk-or-own",
      },
    ]);
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((u) => {
      expect(u.startsWith(`${OPENROUTER_BASE_URL}/`)).toBe(true);
      expect(u.includes(ApiPath.OpenRouter)).toBe(false);
    });
  });
  test("an OpenRouter participant without a key uses the same-origin route", async () => {
    await run([
      {
        id: "a",
        providerName: ServiceProvider.OpenRouter,
        model: "openai/gpt-4o",
        apiKey: "",
      },
    ]);
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((u) => {
      expect(u.startsWith(`${ApiPath.OpenRouter}/`)).toBe(true);
    });
  });
  test("an NVIDIA participant always uses the same-origin route, key or not", async () => {
    await run([
      {
        id: "a",
        providerName: ServiceProvider.NVIDIA,
        model: "nvidia/llama",
        apiKey: "nvapi-own",
      },
    ]);
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((u) => {
      expect(u.startsWith(`${ApiPath.NVIDIA}/`)).toBe(true);
    });
  });

  test("a Token Harbor participant with its own key calls Token Harbor directly", async () => {
    await run([
      {
        id: "a",
        providerName: ServiceProvider.TokenHarbor,
        model: "openai/gpt-4o",
        apiKey: "thk-own",
      },
    ]);
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((u) => {
      expect(u.startsWith(`${TOKENHARBOR_BASE_URL}/`)).toBe(true);
      expect(u.includes(ApiPath.TokenHarbor)).toBe(false);
    });
  });

  test("a Token Harbor participant without a key uses the same-origin route", async () => {
    await run([
      {
        id: "a",
        providerName: ServiceProvider.TokenHarbor,
        model: "openai/gpt-4o",
        apiKey: "",
      },
    ]);
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((u) => {
      expect(u.startsWith(`${ApiPath.TokenHarbor}/`)).toBe(true);
    });
  });
});
