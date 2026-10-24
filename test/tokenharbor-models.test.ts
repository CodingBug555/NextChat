/**
 * End-to-end check of the Token Harbor model fetch. The network boundary is the
 * only thing stubbed: a fake `fetch` stands in for `GET /v1/models` and the real
 * `TokenHarborApi.models()` parses it into the picker's LLMModel shape.
 *
 * The store/api barrels reach ESM-only deps that jest cannot parse here, so the
 * modules the class reads at runtime are stubbed. The parsing logic under test
 * is the real implementation.
 */
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

jest.mock("../app/store", () => ({
  useAccessStore: {
    getState: () => ({
      tokenHarborApiKey: "",
      useCustomConfig: false,
      tokenHarborUrl: "",
      accessCode: "",
      enabledAccessControl: () => false,
    }),
  },
  useAppConfig: () => ({}),
  useChatStore: () => ({}),
  usePluginStore: () => ({}),
  ChatMessageTool: {},
}));

jest.mock("../app/utils/chat", () => ({
  preProcessImageContent: async (content: unknown) => content,
  streamWithThink: () => undefined,
}));

jest.mock("../app/utils", () => ({
  getMessageTextContent: () => "",
  getMessageTextContentWithoutThinking: () => "",
  isVisionModel: () => false,
  getTimeoutMSByModel: () => 1000,
}));

jest.mock("../app/client/api", () => ({
  getBearerToken: (key: string) => `Bearer ${key}`,
  getHeaders: () => ({}),
  validString: (x: unknown) => typeof x === "string" && x.trim().length > 0,
  ACCESS_CODE_PREFIX: "access-code-",
}));

jest.mock("../app/client/platforms/openai", () => ({}));

jest.mock("../app/utils/provider-routing", () => ({
  resolveTokenHarborBaseUrl: () => "https://tokenharbor.ai/v1",
}));

jest.mock("../app/utils/stream", () => ({
  fetch: (...args: unknown[]) => (globalThis as any).__thFetch(...args),
}));

import { TokenHarborApi } from "../app/client/platforms/tokenharbor";

const listResponse = {
  object: "list",
  data: [
    { id: "claude-opus-5.5", object: "model" },
    { id: "gpt-6-astra", object: "model" },
    { id: "kimi-k3.1-pro", object: "model" },
  ],
};

const fetchMock = jest.fn((..._args: unknown[]) =>
  Promise.resolve({
    json: async () => listResponse,
    ok: true,
    status: 200,
  }),
);

beforeEach(() => {
  (globalThis as any).__thFetch = fetchMock;
  fetchMock.mockClear();
});

describe("TokenHarborApi.models", () => {
  test("maps the /v1/models payload onto the picker model shape", async () => {
    const api = new TokenHarborApi();
    const models = await api.models();

    expect(models.map((m) => m.name)).toEqual([
      "claude-opus-5.5",
      "gpt-6-astra",
      "kimi-k3.1-pro",
    ]);
    models.forEach((m) => {
      expect(m.available).toBe(true);
      expect(m.provider.id).toBe("tokenharbor");
      expect(m.provider.providerType).toBe("tokenharbor");
    });
  });

  test("requests the Token Harbor model list path", async () => {
    const api = new TokenHarborApi();
    await api.models();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe("https://tokenharbor.ai/v1/models");
  });

  test("returns an empty list when the payload carries no data", async () => {
    (globalThis as any).__thFetch = jest.fn(async () => ({
      json: async () => ({}),
      ok: true,
      status: 200,
    }));
    const api = new TokenHarborApi();
    await expect(api.models()).resolves.toEqual([]);
  });
});
