import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "neutral",
  target: "es2023",
  tsconfig: "tsconfig.build.json",
  dts: true,
  sourcemap: true,
  clean: true,
  // 库代码保持可读,不压缩,也不删除 console
  minify: false,
  publint: true,
  attw: {
    profile: "esm-only",
    level: "error",
  },
});
