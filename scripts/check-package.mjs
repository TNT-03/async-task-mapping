// 发布包校验:build -> pack -> 在临时目录安装 -> 以 import / require / TS 三种方式消费,
// 并用 publint 与 @arethetypeswrong/cli 做门禁。任何一步失败都会让脚本以非零状态退出。
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const bin = (name) => join(root, "node_modules", ".bin", name);

function step(title) {
  console.log(`\n==> ${title}`);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const workDir = mkdtempSync(join(tmpdir(), "async-task-mapping-"));

try {
  step("构建");
  run("pnpm", ["run", "build"]);

  step("pnpm pack");
  const packDir = join(workDir, "pack");
  mkdirSync(packDir);
  run("pnpm", ["pack", "--pack-destination", packDir]);
  const tarballName = readdirSync(packDir).find((name) =>
    name.endsWith(".tgz"),
  );
  if (!tarballName) {
    throw new Error("pnpm pack 没有产出 .tgz");
  }
  const tarball = join(packDir, tarballName);

  step("校验 tarball 内容(files)");
  const entries = run("tar", ["-tzf", tarball])
    .split("\n")
    .filter(Boolean)
    .filter((entry) => !entry.endsWith("/"));
  const allowed = /^package\/(package\.json|README\.md|LICENSE|dist\/[^/]+)$/;
  const unexpected = entries.filter((entry) => !allowed.test(entry));
  if (unexpected.length > 0) {
    throw new Error(`tarball 中包含不应发布的文件:\n${unexpected.join("\n")}`);
  }
  for (const required of ["package/dist/index.js", "package/dist/index.d.ts"]) {
    if (!entries.includes(required)) {
      throw new Error(`tarball 缺少 ${required}`);
    }
  }

  step("publint(tarball)");
  console.log(
    run(bin("publint"), ["run", tarball, "--level", "warning", "--strict"]),
  );

  step("@arethetypeswrong/cli(tarball)");
  console.log(
    run(bin("attw"), [tarball, "--profile", "esm-only", "--no-emoji"]),
  );

  step("在临时目录安装 tarball");
  const consumerDir = join(workDir, "consumer");
  mkdirSync(consumerDir);
  writeJson(join(consumerDir, "package.json"), {
    name: "consumer",
    private: true,
    type: "module",
  });
  run(
    "npm",
    [
      "install",
      tarball,
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      "--loglevel=error",
    ],
    { cwd: consumerDir },
  );

  const behaviorCheck = `
    import assert from "node:assert/strict";
    const lib = await import("async-task-mapping");
    __BODY__
  `;
  const behaviorBody = `
    assert.deepEqual(Object.keys(lib).sort(), [
      "TaskClearedError",
      "TaskTimeoutError",
      "createStepTask",
      "createTaskList",
      "createTaskOrder",
    ]);
    const list = lib.createTaskList({ ordered: false });
    const pending = list.request();
    list.pushResolve(1, "one");
    assert.deepEqual(await pending, { list: [1], dataMap: { one: 1 } });
    const order = lib.createTaskOrder();
    order.pushResolve("x");
    assert.equal(await order, "x");
    const settled = await lib.createStepTask([() => 1], { limit: 1 });
    assert.deepEqual(settled, [{ status: "fulfilled", value: 1 }]);
  `;

  step("以 import 加载并运行");
  writeFileSync(
    join(consumerDir, "check.mjs"),
    behaviorCheck.replace("__BODY__", behaviorBody),
  );
  run("node", ["check.mjs"], { cwd: consumerDir });

  step("以 require() 加载并运行(Node 22.18+且无实验警告)");
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  if (major > 22 || (major === 22 && minor >= 18)) {
    writeFileSync(
      join(consumerDir, "check.cjs"),
      `const assert = require("node:assert/strict");
const lib = require("async-task-mapping");
(async () => {
  ${behaviorBody}
})().catch((error) => { console.error(error); process.exit(1); });
`,
    );
    // 以 --throw-deprecation 运行,任何实验性警告都会直接失败
    run("node", ["--throw-deprecation", "check.cjs"], { cwd: consumerDir });
  } else {
    console.log(
      `当前 Node ${process.versions.node} 低于 22.18,跳过 require() 校验`,
    );
  }

  step("TypeScript 消费:moduleResolution × 类型环境 × tsc 版本");
  writeFileSync(
    join(consumerDir, "consumer.ts"),
    `import {
  TaskClearedError,
  TaskTimeoutError,
  createStepTask,
  createTaskList,
  createTaskOrder,
} from "async-task-mapping";
import type {
  StepTaskOptions,
  TaskList,
  TaskListOptions,
  TaskListResult,
  TaskOrder,
} from "async-task-mapping";

const options: TaskListOptions = { ordered: false, taskCount: 2, timeout: 100 };
const list: TaskList<number> = createTaskList<number>(options);
const order: TaskOrder<string> = createTaskOrder<string>();
const stepOptions: StepTaskOptions<number> = { limit: 1 };

export async function main(): Promise<number> {
  const result: TaskListResult<number> = await list;
  const text: string = await order;
  const settled: PromiseSettledResult<number>[] = await createStepTask(
    [() => 1],
    stepOptions,
  );
  const errors: Error[] = [new TaskClearedError(), new TaskTimeoutError()];
  return (result.list[0] ?? 0) + text.length + settled.length + errors.length;
}

// @ts-expect-error 数据类型必须是 number
list.pushResolve("text");
`,
  );

  const resolutions = [
    { name: "node16", module: "node16", moduleResolution: "node16" },
    { name: "nodenext", module: "nodenext", moduleResolution: "nodenext" },
    { name: "bundler", module: "esnext", moduleResolution: "bundler" },
  ];
  const environments = [
    { name: "dom", lib: ["ES2023", "DOM"], types: [] },
    {
      name: "node",
      lib: ["ES2023"],
      types: ["node"],
      typeRoots: [join(root, "node_modules", "@types")],
    },
  ];
  // tsc 为 TypeScript 7,tsc6 为并存的 TypeScript 6
  for (const compiler of ["tsc", "tsc6"]) {
    for (const resolution of resolutions) {
      for (const environment of environments) {
        const name = `${compiler}-${resolution.name}-${environment.name}`;
        const tsconfig = join(consumerDir, `tsconfig.${name}.json`);
        writeJson(tsconfig, {
          compilerOptions: {
            target: "ES2023",
            lib: environment.lib,
            types: environment.types,
            ...(environment.typeRoots
              ? { typeRoots: environment.typeRoots }
              : {}),
            module: resolution.module,
            moduleResolution: resolution.moduleResolution,
            strict: true,
            noEmit: true,
            skipLibCheck: false,
          },
          files: ["consumer.ts"],
        });
        run(bin(compiler), ["-p", tsconfig], { cwd: consumerDir });
        console.log(`ok  ${name}`);
      }
    }
  }

  console.log("\n发布包校验全部通过");
} catch (error) {
  const output = [error.stdout, error.stderr].filter(Boolean).join("\n");
  console.error(`\n发布包校验失败:${error.message}\n${output}`);
  process.exitCode = 1;
} finally {
  if (existsSync(workDir)) {
    rmSync(workDir, { recursive: true, force: true });
  }
}
