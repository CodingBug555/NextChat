/**
 * Regression tests for the "Reflection Rounds" input.
 *
 * Reported symptom: setting it to 2 did not stick — the field appeared stuck
 * between 1 and 5. The old input clamped on every keystroke, so clearing it to
 * retype a value collapsed to the minimum and the next digit landed on the end
 * of that minimum ("1" + "2" -> "12" -> clamped to 5). It also hard-capped at 5.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { ServiceProvider } from "../app/constant";
import type { CouncilConfig } from "../app/store/config";
import { CouncilConfigList } from "../app/components/council-config";

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

jest.mock("../app/icons/add.svg", () => () => <span />);
jest.mock("../app/icons/delete.svg", () => () => <span />);
jest.mock("../app/icons/reload.svg", () => () => <span />);

jest.mock("@/app/utils/council", () => ({
  COUNCIL_PROVIDERS: ["OpenAI", "OpenRouter"],
}));

jest.mock("@/app/utils/hooks", () => ({
  useAllModels: () => [
    {
      name: "gpt-4o",
      displayName: "gpt-4o",
      provider: { providerName: "OpenAI" },
    },
  ],
}));

jest.mock("@/app/store", () => ({
  useAppConfig: () => ({}),
}));

function makeConfig(rounds: number): CouncilConfig {
  return {
    enable: true,
    participants: [
      {
        id: "a",
        providerName: ServiceProvider.OpenAI,
        model: "gpt-4o",
        apiKey: "",
      },
      {
        id: "b",
        providerName: ServiceProvider.OpenAI,
        model: "gpt-4o",
        apiKey: "",
      },
    ],
    rounds,
    synthesizerIndex: 0,
    mergeMode: "synthesize",
  };
}

function renderRounds(rounds: number) {
  const config = makeConfig(rounds);
  render(
    <CouncilConfigList
      councilConfig={config}
      updateConfig={(updater) => updater(config)}
    />,
  );
  return { config, input: screen.getByRole("spinbutton") as HTMLInputElement };
}

describe("Council reflection rounds input", () => {
  test("accepts 2 and persists it", () => {
    const { config, input } = renderRounds(1);
    fireEvent.change(input, { target: { value: "2" } });
    expect(config.rounds).toBe(2);
  });

  test("clearing the field then typing 2 yields 2, not a clamped value", () => {
    const { config, input } = renderRounds(1);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "2" } });
    expect(config.rounds).toBe(2);
  });

  test("keeps the raw text while editing (does not rewrite the field)", () => {
    const { input } = renderRounds(1);
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
  });

  test("allows a value above 5", () => {
    const { config, input } = renderRounds(1);
    fireEvent.change(input, { target: { value: "8" } });
    expect(config.rounds).toBe(8);
  });

  test("falls back to 1 on blur when left empty", () => {
    const { config, input } = renderRounds(3);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(config.rounds).toBe(1);
  });
});
