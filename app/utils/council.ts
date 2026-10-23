import {
  ApiPath,
  ByteDance,
  ChatGLM,
  DeepSeek,
  OpenaiPath,
  ServiceProvider,
} from "../constant";
import { CouncilParticipant } from "../store/config";
import { RequestMessage } from "../client/api";
import { getHeadersForProvider } from "../client/api";
import { getClientConfig } from "../config/client";
import { prettyObject } from "./format";
import { resolveOpenRouterBaseUrl } from "./provider-routing";
import { fetch } from "./stream";

/**
 * Providers whose HTTP API is OpenAI chat-completions compatible, so the
 * council can talk to them directly. Non-compatible providers (Google,
 * Anthropic, Baidu, Alibaba, Tencent, Iflytek) are excluded from council.
 */
export const COUNCIL_PROVIDERS: ServiceProvider[] = [
  ServiceProvider.OpenAI,
  ServiceProvider.DeepSeek,
  ServiceProvider.Moonshot,
  ServiceProvider.XAI,
  ServiceProvider.ChatGLM,
  ServiceProvider.SiliconFlow,
  ServiceProvider["302.AI"],
  ServiceProvider.OpenRouter,
  ServiceProvider.NVIDIA,
  ServiceProvider.ByteDance,
];

export type CouncilParticipantStatus = "pending" | "running" | "done" | "error";

export interface CouncilParticipantState {
  index: number;
  providerName: ServiceProvider;
  model: string;
  status: CouncilParticipantStatus;
  chars?: number;
  error?: string;
}

export interface CouncilProgress {
  phase: "draft" | "reflect" | "merge";
  round: number;
  totalRounds: number;
  states: CouncilParticipantState[];
}

export interface CouncilOptions {
  messages: RequestMessage[];
  participants: CouncilParticipant[];
  rounds: number;
  synthesizerIndex: number;
  mergeMode: "synthesize" | "longest" | "vote";
  temperature?: number;
  top_p?: number;
  controller: AbortController;
  onProgress?: (progress: CouncilProgress) => void;
  onUpdate?: (merged: string) => void;
  onFinish: (merged: string, responses: string[]) => void;
  onError?: (err: Error) => void;
}

function providerApiPath(
  providerName: ServiceProvider,
  hasOwnKey: boolean = false,
): string {
  switch (providerName) {
    case ServiceProvider.Google:
      return ApiPath.Google;
    case ServiceProvider.Anthropic:
      return ApiPath.Anthropic;
    case ServiceProvider.Baidu:
      return ApiPath.Baidu;
    case ServiceProvider.ByteDance:
      return ApiPath.ByteDance;
    case ServiceProvider.Alibaba:
      return ApiPath.Alibaba;
    case ServiceProvider.Moonshot:
      return ApiPath.Moonshot;
    case ServiceProvider.Iflytek:
      return ApiPath.Iflytek;
    case ServiceProvider.DeepSeek:
      return ApiPath.DeepSeek;
    case ServiceProvider.XAI:
      return ApiPath.XAI;
    case ServiceProvider.ChatGLM:
      return ApiPath.ChatGLM;
    case ServiceProvider.SiliconFlow:
      return ApiPath.SiliconFlow;
    case ServiceProvider["302.AI"]:
      return ApiPath["302.AI"];
    case ServiceProvider.OpenRouter:
      // OpenRouter allows CORS, so a participant with its own key skips the
      // same-origin hop. NVIDIA has no CORS headers and must stay on the route.
      return resolveOpenRouterBaseUrl({
        isApp: !!getClientConfig()?.isApp,
        useCustomConfig: false,
        customUrl: "",
        hasOwnKey,
      });
    case ServiceProvider.NVIDIA:
      return ApiPath.NVIDIA;
    default:
      return ApiPath.OpenAI;
  }
}

function providerChatPath(providerName: ServiceProvider): string {
  switch (providerName) {
    case ServiceProvider.DeepSeek:
      return DeepSeek.ChatPath;
    case ServiceProvider.ByteDance:
      return ByteDance.ChatPath;
    case ServiceProvider.ChatGLM:
      return ChatGLM.ChatPath;
    default:
      return OpenaiPath.ChatPath;
  }
}

/**
 * Non-streaming single completion against a provider, using that
 * participant's own api key when one is supplied.
 */
async function askParticipant(
  participant: CouncilParticipant,
  messages: RequestMessage[],
  options: {
    temperature?: number;
    top_p?: number;
    signal: AbortSignal;
  },
): Promise<string> {
  const path = `${providerApiPath(
    participant.providerName,
    !!participant.apiKey?.trim(),
  )}/${providerChatPath(participant.providerName)}`;
  // An empty participant key means "use the provider's key from Settings",
  // so pass undefined rather than "" (which would skip that fallback).
  const override = participant.apiKey?.trim() ? participant.apiKey : undefined;
  const headers = getHeadersForProvider(participant.providerName, override);

  const res = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages,
      model: participant.model,
      stream: false,
      temperature: options.temperature,
      top_p: options.top_p,
    }),
    signal: options.signal,
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(prettyObject({ error: true, message: text }));
  }

  if (!res.ok || json?.error) {
    throw new Error(
      typeof json?.error === "string"
        ? json.error
        : json?.error?.message ?? prettyObject(json),
    );
  }

  return (
    json?.choices?.at(0)?.message?.content ??
    json?.choices?.at(0)?.text ??
    ""
  );
}

function toText(messages: RequestMessage[]): string {
  return messages
    .map((m) => {
      const content =
        typeof m.content === "string"
          ? m.content
          : m.content.map((c) => c.text ?? "").join(" ");
      return `${m.role}: ${content}`;
    })
    .join("\n");
}

export function buildCouncilPrompt(
  userRequest: string,
  draft: string,
  peers: { model: string; content: string }[],
): RequestMessage[] {
  const peerBlock = peers
    .map((p) => `### ${p.model}\n${p.content}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content:
        "You are a member of an expert panel. Several AI models each drafted an answer to the user's request. " +
        "Critique the drafts (including your own), point out errors and gaps, and produce your improved answer. " +
        "Be concise and do not restate the whole panel discussion.",
    },
    {
      role: "user",
      content:
        `User request:\n${userRequest}\n\n` +
        `Your previous draft:\n${draft}\n\n` +
        `Other panel members' drafts:\n${peerBlock}\n\n` +
        "Now give your refined answer.",
    },
  ];
}

function buildMergePrompt(
  userRequest: string,
  answers: { model: string; content: string }[],
): RequestMessage[] {
  const block = answers
    .map((a) => `### ${a.model}\n${a.content}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content:
        "You are the chair of an expert panel. Merge the panel's independent answers into ONE final, " +
        "self-contained answer for the user. Resolve contradictions, keep the strongest reasoning, and " +
        "do not mention the panel, the models, or the drafts. Output only the final answer in markdown.",
    },
    {
      role: "user",
      content: `User request:\n${userRequest}\n\nPanel answers:\n${block}`,
    },
  ];
}

function longestAnswer(answers: string[]): string {
  return answers.reduce((a, b) => (b.length > a.length ? b : a), "");
}

export async function runCouncil(options: CouncilOptions) {
  const {
    messages,
    participants,
    rounds,
    synthesizerIndex,
    mergeMode,
    controller,
    onProgress,
    onUpdate,
    onFinish,
    onError,
  } = options;

  try {
    const userRequest = toText(messages.filter((m) => m.role !== "system"));
    const totalRounds = Math.max(1, rounds);

    // The shared state board the UI renders. Updated in place so the chat
    // bubble shows every participant working at the same time.
    const states: CouncilParticipantState[] = participants.map((p, i) => ({
      index: i,
      providerName: p.providerName,
      model: p.model,
      status: "pending",
    }));
    const emit = (phase: CouncilProgress["phase"], round: number) =>
      onProgress?.({
        phase,
        round,
        totalRounds,
        states: states.map((s) => ({ ...s })),
      });

    /** Runs every participant at once; a failed participant must not sink the council. */
    const runRound = async (
      phase: CouncilProgress["phase"],
      round: number,
      build: (i: number) => RequestMessage[],
      previous: string[],
    ): Promise<string[]> => {
      const results = previous.slice();
      await Promise.all(
        participants.map(async (p, i) => {
          states[i].status = "running";
          states[i].error = undefined;
          emit(phase, round);
          try {
            const answer = await askParticipant(p, build(i), {
              temperature: options.temperature,
              top_p: options.top_p,
              signal: controller.signal,
            });
            results[i] = answer;
            states[i].status = "done";
            states[i].chars = answer.length;
          } catch (e) {
            if (controller.signal.aborted) throw e;
            states[i].status = "error";
            states[i].error = (e as Error).message;
          }
          emit(phase, round);
        }),
      );
      return results;
    };

    // Round 1: every participant answers independently, in parallel.
    let drafts = await runRound("draft", 1, () => messages, []);

    // Reflection rounds: each participant sees the others and refines, in parallel.
    for (let round = 2; round <= totalRounds + 1; round++) {
      const snapshot = drafts.slice();
      drafts = await runRound(
        "reflect",
        round,
        (i) => {
          const peers = participants
            .map((q, j) => ({ model: q.model, content: snapshot[j] ?? "" }))
            .filter((_, j) => j !== i);
          return buildCouncilPrompt(userRequest, snapshot[i] ?? "", peers);
        },
        snapshot,
      );
    }

    const usable = drafts.filter((d) => d && d.length > 0);
    if (usable.length === 0) {
      const reason =
        states.find((s) => s.error)?.error ?? "no participant returned an answer";
      throw new Error(reason);
    }

    // Merge into a single final answer.
    let merged: string;
    if (mergeMode === "longest") {
      merged = longestAnswer(usable);
    } else if (mergeMode === "vote") {
      const counts: Record<string, number> = {};
      usable.forEach((d) => (counts[d] = (counts[d] ?? 0) + 1));
      merged = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    } else {
      const chair = participants[synthesizerIndex] ?? participants[0];
      const chairIndex = participants.indexOf(chair);
      states.forEach((s) => {
        s.status = s.index === chairIndex ? "running" : "done";
      });
      emit("merge", totalRounds + 1);
      const answers = participants
        .map((p, i) => ({ model: p.model, content: drafts[i] ?? "" }))
        .filter((a) => a.content.length > 0);
      merged = await askParticipant(chair, buildMergePrompt(userRequest, answers), {
        temperature: options.temperature,
        top_p: options.top_p,
        signal: controller.signal,
      });
      states[chairIndex].status = "done";
      emit("merge", totalRounds + 1);
    }

    if (!merged) {
      merged = longestAnswer(usable);
    }

    onUpdate?.(merged);
    onFinish(merged, drafts);
  } catch (e) {
    onError?.(e as Error);
  }
}
