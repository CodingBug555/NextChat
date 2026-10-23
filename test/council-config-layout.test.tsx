/**
 * Guards the Council settings layout.
 *
 * The participant rows previously rendered as a horizontal ListItem with the
 * whole form crammed into one flex row, which pushed the title and the inputs
 * out of alignment. Each participant must be its own vertical ListItem whose
 * controls are full width and left aligned.
 */
import { render, screen } from "@testing-library/react";
import { ServiceProvider } from "../app/constant";
import type { CouncilConfig } from "../app/store/config";
import { CouncilConfigList } from "../app/components/council-config";

// nanoid ships ESM only, which jest cannot parse here.
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

// SVGs are transformed into objects by the webpack loader, which React cannot
// render in jsdom. Stub them as plain spans.
jest.mock("../app/icons/add.svg", () => () => <span />);
jest.mock("../app/icons/delete.svg", () => () => <span />);
jest.mock("../app/icons/reload.svg", () => () => <span />);
jest.mock("../app/icons/three-dots.svg", () => () => <span />);
jest.mock("../app/icons/close.svg", () => () => <span />);
jest.mock("../app/icons/eye.svg", () => () => <span />);
jest.mock("../app/icons/eye-off.svg", () => () => <span />);
jest.mock("../app/icons/down.svg", () => () => <span />);
jest.mock("../app/icons/confirm.svg", () => () => <span />);
jest.mock("../app/icons/cancel.svg", () => () => <span />);
jest.mock("../app/icons/max.svg", () => () => <span />);
jest.mock("../app/icons/min.svg", () => () => <span />);
jest.mock("../app/icons/copy.svg", () => () => <span />);

// The real modules reach lodash-es (ESM) via the api/store barrel, which jest
// cannot parse. Only the symbols the component actually uses are needed.
jest.mock("@/app/utils/council", () => ({
  COUNCIL_PROVIDERS: ["OpenAI", "OpenRouter", "NVIDIA"],
}));

jest.mock("@/app/utils/hooks", () => ({
  useAllModels: () => [
    {
      name: "openai/gpt-4o",
      displayName: "openai/gpt-4o",
      provider: { providerName: "OpenRouter" },
    },
    {
      name: "nvidia/llama",
      displayName: "nvidia/llama",
      provider: { providerName: "NVIDIA" },
    },
  ],
}));

jest.mock("@/app/store", () => ({
  useAppConfig: () => ({}),
}));

const councilConfig: CouncilConfig = {
  enable: true,
  participants: [
    {
      id: "a",
      providerName: ServiceProvider.OpenRouter,
      model: "openai/gpt-4o",
      apiKey: "",
    },
    {
      id: "b",
      providerName: ServiceProvider.NVIDIA,
      model: "nvidia/llama",
      apiKey: "",
    },
  ],
  rounds: 1,
  synthesizerIndex: 0,
  mergeMode: "synthesize",
};

describe("CouncilConfigList layout", () => {
  test("gives every participant its own vertical ListItem", () => {
    const { container } = render(
      <CouncilConfigList councilConfig={councilConfig} updateConfig={() => {}} />,
    );

    // Two participants => two vertical rows, each owning its own form fields.
    const verticalRows = container.querySelectorAll(".list-item.vertical");
    expect(verticalRows.length).toBe(2);

    const fieldBlocks = container.querySelectorAll(
      '[class*="participant-fields"]',
    );
    expect(fieldBlocks.length).toBe(2);

    // Each field block holds provider, model, api key and the action buttons.
    fieldBlocks.forEach((block) => {
      expect(block.querySelectorAll("select").length).toBe(2);
      expect(block.querySelectorAll('input[type="text"]').length).toBe(1);
      expect(
        block.querySelectorAll('[class*="participant-actions"]').length,
      ).toBe(1);
    });
  });

  test("applies the full-width classes that override the global input rules", () => {
    const { container } = render(
      <CouncilConfigList councilConfig={councilConfig} updateConfig={() => {}} />,
    );

    expect(
      container.querySelectorAll('[class*="full-width-select"]').length,
    ).toBe(4); // 2 selects x 2 participants
    expect(
      container.querySelectorAll('[class*="api-key-input"]').length,
    ).toBe(2);
  });

  test("hides the participant rows while Council is disabled", () => {
    render(
      <CouncilConfigList
        councilConfig={{ ...councilConfig, enable: false }}
        updateConfig={() => {}}
      />,
    );
    expect(screen.queryByText(/Panel member 1/)).not.toBeInTheDocument();
  });
});
