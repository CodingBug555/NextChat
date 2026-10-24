/**
 * The model picker lists can hold hundreds of models, so every Selector now
 * renders a filter box. This guards that typing actually narrows the visible
 * rows and that selecting a filtered row still reports the right value.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { Selector } from "../app/components/ui-lib";

// nanoid ships ESM only, which jest cannot parse here (reached via ui-lib's
// locale -> config -> store import chain).
jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

// The real locales barrel pulls in the store barrel, which drags in an
// unparseable ESM dependency chain. Only the key the component reads is needed.
jest.mock("../app/locales", () => ({
  __esModule: true,
  default: { Select: { Search: "Search" } },
}));

jest.mock("../app/icons/three-dots.svg", () => () => <span />);
jest.mock("../app/icons/close.svg", () => () => <span />);
jest.mock("../app/icons/eye.svg", () => () => <span />);
jest.mock("../app/icons/eye-off.svg", () => () => <span />);
jest.mock("../app/icons/down.svg", () => () => <span />);
jest.mock("../app/icons/confirm.svg", () => () => <span />);
jest.mock("../app/icons/cancel.svg", () => () => <span />);
jest.mock("../app/icons/max.svg", () => () => <span />);
jest.mock("../app/icons/min.svg", () => () => <span />);

const items = [
  { title: "GPT-4o (OpenAI)", value: "gpt-4o@OpenAI" },
  { title: "Claude 3.5 Sonnet (Anthropic)", value: "claude@Anthropic" },
  { title: "Llama 3 (NVIDIA)", value: "llama-3@NVIDIA" },
];

describe("Selector search", () => {
  test("renders a search box when asked", () => {
    render(<Selector items={items} searchable />);
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
  });

  test("filters the rows as the query is typed", () => {
    render(<Selector items={items} searchable />);

    expect(screen.getByText("GPT-4o (OpenAI)")).toBeTruthy();
    expect(screen.getByText("Claude 3.5 Sonnet (Anthropic)")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "claude" },
    });

    expect(screen.getByText("Claude 3.5 Sonnet (Anthropic)")).toBeTruthy();
    expect(screen.queryByText("GPT-4o (OpenAI)")).toBeNull();
    expect(screen.queryByText("Llama 3 (NVIDIA)")).toBeNull();
  });

  test("selection after filtering reports the filtered item's value", () => {
    const onSelection = jest.fn();
    render(
      <Selector items={items} searchable onSelection={onSelection} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "llama" },
    });
    fireEvent.click(screen.getByText("Llama 3 (NVIDIA)"));

    expect(onSelection).toHaveBeenCalledWith(["llama-3@NVIDIA"]);
  });

  test("does not render a search box for short lists by default", () => {
    render(<Selector items={items.slice(0, 2)} />);
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
  });
});
