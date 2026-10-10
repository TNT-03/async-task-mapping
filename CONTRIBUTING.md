# 参与贡献

感谢你愿意为 async-task-mapping 出力。提交 Issue 或 Pull Request 之前请先读完本文。

## 环境要求

- Node.js >= 22.18
- pnpm,版本以 `package.json` 里的 `packageManager` 字段为准(推荐用 `corepack enable` 自动匹配)

```sh
pnpm install
```

## 常用脚本

| 命令                     | 说明                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm run build`         | 用 tsdown 构建到 `dist/`,并自动运行 publint 与 attw 检查          |
| `pnpm run typecheck`     | `tsc --noEmit`                                                    |
| `pnpm run lint`          | ESLint(typescript-eslint strict)                                  |
| `pnpm run format`        | Prettier 格式化;`format:check` 只检查不修改                       |
| `pnpm test`              | Vitest,包含 `*.test-d.ts` 类型测试                                |
| `pnpm run test:watch`    | Vitest 监听模式                                                   |
| `pnpm run test:coverage` | 带覆盖率阈值的测试,阈值在 `vitest.config.ts` 里                   |
| `pnpm run test:package`  | 打包后在临时目录安装 tarball,校验 import / require 与 TS 类型消费 |

## 提交之前

下面这些检查需要全部通过,CI 会在 Node 22 与 24 上运行同样的步骤(Node 26 作为非阻塞项):

```sh
pnpm run format:check
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run test:package
```

## 测试约定

- 测试文件放在 `test/`,运行时测试以 `*.test.ts` 命名,类型测试以 `*.test-d.ts` 命名。
- 内存释放测试依赖手动触发 gc,`vitest.config.ts` 已经带上了 `--expose-gc`;单独用 `node` 跑这类测试时需要自己加这个参数。
- 内存测试用 `WeakRef` 加 `test/helpers.ts` 里的 `collectGarbage` 轮询判断对象是否被回收,不要依赖固定的等待时间。
- 修改行为时请同时补测试;新增或变更对外 API 时请同步更新 `README.md` 与 `README-zh_CN.md`(中英文结构保持一致)。

## 代码约定

- 源码使用 TypeScript strict,注释使用中文。
- `src/` 不依赖运行环境的全局对象(`window`、`process`、`console` 等),ESLint 会检查。
- 不引入运行时依赖;新增 devDependency 前请确认它仍在维护。

## Changeset 与版本

版本号和 `CHANGELOG.md` 由 [changesets](https://github.com/changesets/changesets) 管理。任何会影响使用者的改动(功能、修复、破坏性变更)都需要附带一个 changeset:

```sh
pnpm changeset
```

按提示选择 patch / minor / major,并用中文写清楚改了什么。生成的 `.changeset/*.md` 一起提交即可。仅改文档、测试或内部工具的 PR 不需要。

## 发布流程(维护者)

1. 在 `master` 上运行 `pnpm run version`,它会消耗所有 changeset,更新 `package.json` 的版本号并写入 `CHANGELOG.md`。
2. 提交这些改动。
3. 打一个与 `package.json` 版本一致的 tag 并推送,例如版本是 `2.1.0` 时:

   ```sh
   git tag v2.1.0
   git push origin v2.1.0
   ```

4. `release.yml` 会被 tag 触发:校验 tag 指向的提交已经在 `master` 上、tag 与版本一致、`CHANGELOG.md` 里有对应版本的小节(三项任一不满足都会在发布之前失败),跑完整检查,通过 npm Trusted Publishing(OIDC)带 provenance 发布,并从 `CHANGELOG.md` 对应小节生成 GitHub Release。含 `-` 的预发布版本(如 `2.1.0-beta.1`)会发布到 `next` 标签,不会覆盖 `latest`。

首次发布前,需要在 npmjs.com 的包设置里添加 Trusted Publisher:owner `TNT-03`、repository `async-task-mapping`、workflow 文件名 `release.yml`。

`pnpm run release`(`changeset publish`)只用来在 CI 不可用时手动兜底。
