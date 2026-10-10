import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // 内存释放测试需要手动触发 gc
    execArgv: ["--expose-gc"],
    typecheck: {
      include: ["test/**/*.test-d.ts"],
      tsconfig: "tsconfig.json",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "html"],
      // 当前实测约 100% / 98% / 98% / 100%,留出少量余量
      thresholds: {
        statements: 98,
        branches: 95,
        functions: 95,
        lines: 98,
      },
    },
  },
});
