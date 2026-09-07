import { mergeConfig } from "vitest/config";
import baseConfig from "./vite.config";

const config = mergeConfig(baseConfig, { test: { testTimeout: 60_000 } });
config.test.include = ["src/**/*.perf.ts"];

export default config;
