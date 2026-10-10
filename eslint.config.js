import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist", "coverage", "node_modules", ".changeset"] },
  {
    files: ["**/*.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // 库源码保持环境无关:不直接访问 DOM / Node 专有全局
    files: ["src/**/*.ts"],
    rules: {
      // reject 的原因来自使用者(pushReject / signal.reason),不一定是 Error
      "@typescript-eslint/prefer-promise-reject-errors": "off",
      "no-restricted-globals": [
        "error",
        ...[
          "window",
          "document",
          "navigator",
          "self",
          "global",
          "process",
          "Buffer",
          "require",
          "console",
        ].map((name) => ({
          name,
          message: "库源码需要保持环境无关,不要使用该全局变量",
        })),
      ],
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["test/**/*.test-d.ts"],
    rules: {
      // expectTypeOf(obj.method) 只在类型层面使用,不会真正解绑调用
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      // 测试里会故意构造非法入参、使用 void 丢弃 Promise
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
);
