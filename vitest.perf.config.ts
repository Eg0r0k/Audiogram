import { mergeConfig } from "vitest/config";
import baseConfig from "./vite.config";

export default mergeConfig(baseConfig, {
  test: {
    include: ["src/**/*.perf.ts"],
    testTimeout: 60_000,
  },
});
