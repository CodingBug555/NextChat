import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.js", "**/*.test.ts", "**/*.test.jsx", "**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  injectGlobals: true,
};

// next/jest prepends its own "/node_modules/" entry to transformIgnorePatterns,
// and Jest skips a file when *any* pattern matches — so appending a negated
// pattern to `config` has no effect. Rewrite the resolved list instead, to let
// SWC transform the ESM-only packages the app imports into CommonJS.
const esmPackages = ["nanoid", "lodash-es"];

export default async (
  ...args: Parameters<ReturnType<typeof createJestConfig>>
) => {
  const resolved = await createJestConfig(config)(...args);
  resolved.transformIgnorePatterns = [
    `/node_modules/(?!(?:${esmPackages.join("|")})/)`,
    "^.+\\.module\\.(css|sass|scss)$",
  ];
  return resolved;
};
