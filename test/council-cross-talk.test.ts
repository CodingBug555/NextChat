/**
 * Proves the council actually shares answers between participants.
 *
 * Stubs only the network boundary (the `fetch` used by council.ts) and records
 * every request body, so we can assert on exactly what each model was sent.
 */
import { ServiceProvider } from "../app/constant";
import type { CouncilParticipant } from "../app/store/config";

const calls: { model: string; body: any }[] = [];

jest.mock("../app/utils/stream", () => ({
  fetch: async (_url: string, options: any) => {
    const body = JSON.parse(options.body);
    calls.push({ model: body.model, body });
    const content = `ANSWER-FROM-${body.model}`;
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

const systemOf = (c: { body: any }) =>
  c.body.messages.find((m: any) => m.role === "system")?.content ?? "";
const userOf = (c: { body: any }) =>
  c.body.messages.find((m: any) => m.role === "user")?.content ?? "";

describe("runCouncil cross-talk", () => {
  let merged: string;

  beforeAll(async () => {
    calls.length = 0;
    await runCouncil({
      messages: [{ role: "user", content: "What is 2+2?" }],
      participants,
      rounds: 1,
      synthesizerIndex: 0,
      mergeMode: "synthesize",
      controller: new AbortController(),
      onFinish: (m) => (merged = m),
      onError: (e) => {
        throw e;
      },
    });
  });

  test("runs one draft per participant", () => {
    const drafts = calls.filter(
      (c) => !systemOf(c).includes("panel") && !systemOf(c).includes("chair"),
    );
    expect(drafts.map((d) => d.model).sort()).toEqual([
      "nvidia/llama",
      "openai/gpt-4o",
    ]);
  });

  test("each reflector is sent the OTHER model's draft", () => {
    // The chair prompt also contains the word "panel", so exclude it explicitly.
    const reflects = calls.filter(
      (c) => systemOf(c).includes("panel") && !systemOf(c).includes("chair"),
    );
    expect(reflects).toHaveLength(2);

    const gptReflect = reflects.find((c) => c.model === "openai/gpt-4o")!;
    const nvidiaReflect = reflects.find((c) => c.model === "nvidia/llama")!;

    // gpt-4o must see nvidia's answer, and vice versa.
    expect(userOf(gptReflect)).toContain("ANSWER-FROM-nvidia/llama");
    expect(userOf(nvidiaReflect)).toContain("ANSWER-FROM-openai/gpt-4o");
  });

  test("each reflector also sees its own previous draft", () => {
    const gptReflect = calls.find(
      (c) =>
        systemOf(c).includes("panel") &&
        !systemOf(c).includes("chair") &&
        c.model === "openai/gpt-4o",
    )!;
    expect(userOf(gptReflect)).toContain("Your previous draft:");
    expect(userOf(gptReflect)).toContain("ANSWER-FROM-openai/gpt-4o");
  });

  test("chair receives both participants' answers", () => {
    const chair = calls.find((c) => systemOf(c).includes("chair"))!;
    expect(chair.model).toBe("openai/gpt-4o");
    expect(userOf(chair)).toContain("ANSWER-FROM-openai/gpt-4o");
    expect(userOf(chair)).toContain("ANSWER-FROM-nvidia/llama");
  });

  test("finishes with the chair's merged answer", () => {
    expect(merged).toBe("ANSWER-FROM-openai/gpt-4o");
  });
});
