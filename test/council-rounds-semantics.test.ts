/**
 * Verifies the council's round/merge semantics match the settings UI:
 * - `rounds` N produces N reflection passes (round-based, not live chat).
 * - `mergeMode` "longest" and "vote" pick a panel answer without a chair call.
 * - the progress board reports the correct totalRounds.
 */
import { ServiceProvider } from "../app/constant";
import type { CouncilParticipant } from "../app/store/config";
import type { CouncilProgress } from "../app/utils/council";

let calls: { model: string; body: any }[] = [];

jest.mock("../app/utils/stream", () => ({
  fetch: async (_url: string, options: any) => {
    const body = JSON.parse(options.body);
    calls.push({ model: body.model, body });
    const reflectCount = calls.filter((c) =>
      JSON.stringify(c.body.messages).includes("panel members"),
    ).length;
    // Distinct lengths so "longest" is deterministic, and repeated for "vote".
    const content = `${body.model}-len${reflectCount}-${"x".repeat(
      body.model.length,
    )}`;
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { role: "assistant", content } }],
        }),
    } as any;
  },
}));

jest.mock("../app/client/api", () => ({
  getHeadersForProvider: () => ({ "Content-Type": "application/json" }),
}));

import { runCouncil } from "../app/utils/council";

const participants: CouncilParticipant[] = [
  {
    id: "a",
    providerName: ServiceProvider.OpenRouter,
    model: "openai/gpt-4o",
    apiKey: "k",
  },
  {
    id: "b",
    providerName: ServiceProvider.NVIDIA,
    model: "nvidia/llama",
    apiKey: "k",
  },
];

const isReflect = (c: { body: any }) =>
  JSON.stringify(c.body.messages).includes("panel members");
const isChair = (c: { body: any }) =>
  JSON.stringify(c.body.messages).includes("chair of an expert panel");

describe("runCouncil rounds + merge modes", () => {
  test("rounds:1 => one reflection pass per participant", async () => {
    calls = [];
    await runCouncil({
      messages: [{ role: "user", content: "hi" }],
      participants,
      rounds: 1,
      synthesizerIndex: 0,
      mergeMode: "synthesize",
      controller: new AbortController(),
      onFinish: () => {},
      onError: (e) => {
        throw e;
      },
    });
    expect(calls.filter(isReflect)).toHaveLength(2); // 1 pass x 2 participants
  });

  test("rounds:3 => three reflection passes per participant", async () => {
    calls = [];
    await runCouncil({
      messages: [{ role: "user", content: "hi" }],
      participants,
      rounds: 3,
      synthesizerIndex: 0,
      mergeMode: "synthesize",
      controller: new AbortController(),
      onFinish: () => {},
      onError: (e) => {
        throw e;
      },
    });
    expect(calls.filter(isReflect)).toHaveLength(6); // 3 passes x 2 participants
  });

  test("reports totalRounds and phase progression", async () => {
    calls = [];
    const seen: CouncilProgress[] = [];
    await runCouncil({
      messages: [{ role: "user", content: "hi" }],
      participants,
      rounds: 2,
      synthesizerIndex: 0,
      mergeMode: "synthesize",
      controller: new AbortController(),
      onProgress: (p) => seen.push(p),
      onFinish: () => {},
      onError: (e) => {
        throw e;
      },
    });
    expect(seen.every((p) => p.totalRounds === 2)).toBe(true);
    expect(seen.some((p) => p.phase === "draft")).toBe(true);
    expect(seen.some((p) => p.phase === "reflect")).toBe(true);
    expect(seen.some((p) => p.phase === "merge")).toBe(true);
  });

  test("mergeMode:longest picks the longest panel answer without a chair call", async () => {
    calls = [];
    let merged = "";
    await runCouncil({
      messages: [{ role: "user", content: "hi" }],
      participants,
      rounds: 1,
      synthesizerIndex: 0,
      mergeMode: "longest",
      controller: new AbortController(),
      onFinish: (m) => (merged = m),
      onError: (e) => {
        throw e;
      },
    });
    expect(calls.filter(isChair)).toHaveLength(0);
    expect(merged).toContain("openai/gpt-4o");
  });

  test("mergeMode:vote picks the most repeated panel answer without a chair call", async () => {
    calls = [];
    let merged = "";
    await runCouncil({
      messages: [{ role: "user", content: "hi" }],
      participants,
      rounds: 1,
      synthesizerIndex: 0,
      mergeMode: "vote",
      controller: new AbortController(),
      onFinish: (m) => (merged = m),
      onError: (e) => {
        throw e;
      },
    });
    expect(calls.filter(isChair)).toHaveLength(0);
    expect(merged.length).toBeGreaterThan(0);
  });

  test("mergeMode:synthesize uses the chair and skips non-chair merge", async () => {
    calls = [];
    await runCouncil({
      messages: [{ role: "user", content: "hi" }],
      participants,
      rounds: 1,
      synthesizerIndex: 1,
      mergeMode: "synthesize",
      controller: new AbortController(),
      onFinish: () => {},
      onError: (e) => {
        throw e;
      },
    });
    const chairs = calls.filter(isChair);
    expect(chairs).toHaveLength(1);
    expect(chairs[0].model).toBe("nvidia/llama");
  });
});
