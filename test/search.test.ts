import {
  filterSelectorItems,
  matchesSearch,
} from "../app/utils/search";

describe("matchesSearch", () => {
  test("an empty or whitespace query matches everything", () => {
    expect(matchesSearch("anything", "")).toBe(true);
    expect(matchesSearch("anything", "   ")).toBe(true);
  });

  test("matching is case-insensitive and substring based", () => {
    expect(matchesSearch("GPT-4o Mini", "gpt-4o")).toBe(true);
    expect(matchesSearch("GPT-4o Mini", "MINI")).toBe(true);
    expect(matchesSearch("GPT-4o Mini", "claude")).toBe(false);
  });
});

describe("filterSelectorItems", () => {
  const items = [
    { title: "GPT-4o", value: "openai@gpt-4o" },
    { title: "Claude 3.5 Sonnet", value: "anthropic@claude" },
    { title: "Llama 3", subTitle: "NVIDIA", value: "nvidia@llama-3" },
  ];

  test("returns the original list for an empty query", () => {
    expect(filterSelectorItems(items, "")).toBe(items);
    expect(filterSelectorItems(items, "  ")).toBe(items);
  });

  test("filters by title", () => {
    expect(filterSelectorItems(items, "claude").map((i) => i.value)).toEqual([
      "anthropic@claude",
    ]);
  });

  test("also matches on subTitle", () => {
    expect(filterSelectorItems(items, "nvidia").map((i) => i.value)).toEqual([
      "nvidia@llama-3",
    ]);
  });

  test("returns nothing when no item matches", () => {
    expect(filterSelectorItems(items, "zzz")).toEqual([]);
  });
});
