# async-task-mapping 升级清单(2.0.0)

## 已确认前提

- 整个项目重构为 TypeScript(`strict`),旧 JS 实现与配置直接删除,不考虑旧代码兼容
- `createTaskList` 与 `createTaskOrder` 保持两个独立模块,不合并
- 仅支持 Node 22+(`engines.node` 下限见 Q8)
- 测试全部重写,不迁移任何旧用例
- 凡会改变现有公开 API 使用方式(方法名、参数、默认值、返回结构、抛错/警告行为、引入方式)的条目,标记【需确认 Qn】:实施前必须单独向用户确认,未确认不得改动;未标记的条目均不改变现有用法

## 待确认事项

- [x] Q1 是否删除 0.x 旧 API:`requestCount/responseCount` 参数、`pushResponse`、`request(cb)`
- [x] Q2 `createTaskList` 的 `ordered` 默认值:代码为 `true`,README 写 `false`,以哪个为准
  - 决策:默认 `true`,README 待 §8 修正
- [x] Q3 `getStatus()` 字段名:`createTaskOrder` 代码返回 `pendingResolve`,README 写 `pendingResponses`,以哪个为准
  - 决策:保持 `pendingRequests` / `pendingResolve`
- [x] Q4 异常表达方式:`request` 超限(现返回 `undefined` 后在 `.then` 处抛 TypeError)、`pushResolve` 超限/顺序错误(现返回字符串)、`clear()` 后悬挂的 Promise 如何结算(reject 或 resolve)、入参非法是否抛错、库内 `console.warn` 是否保留
  - 决策:request 超限返回 reject 的 `RangeError`;pushResolve 超限/顺序错误同步抛错;clear 以 `TaskClearedError` reject;入参非法抛 `RangeError/TypeError`(undefined 取默认 1);删除库内 console
- [x] Q5 无序列表在 fulfilled 后再 `request`:现返回裸数组,是否统一为 `{ list, dataMap }`
  - 决策:统一返回 `{ list, dataMap }`
- [x] Q6 `paused()/running()` 是否改名(如 `pause()/resume()`)
  - 决策:不改名
- [x] Q7 是否保留 thenable 设计(实例可直接 `await`/`.then`,且每次调用消耗一个 request 名额)
  - 决策:保留 thenable(显式定义 then/catch/finally)
- [x] Q8 产物格式:仅 ESM(Node 22.12+ 起 `require()` 可加载 ESM,22.13 起无实验警告,`engines` 下限需 `>=22.13`)还是 ESM + CJS 双产物
  - 决策:仅 ESM,`engines.node >=22.18`(与 tsdown 的 `^22.18` 对齐)
- [x] Q9 构建工具:`tsup` 官方 README 已标注“不再积极维护,推荐 tsdown”(最后发布 2025-11),`tsdown` 仍为 0.x;选 tsdown 还是其他
  - 决策:tsdown ^0.23.0;TypeScript 7.0.x 与 TS 6(`@typescript/typescript6` 别名)并存,供 typescript-eslint 使用
- [x] Q10 新增 API 的签名与语义:`pushReject`、超时、`AbortSignal` 取消、`StepTask`(并发池)是否对外导出及其参数
  - 决策:新增 `pushReject`、`timeout`、`signal`,导出 `createStepTask`(签名见实现)
- [x] Q11 运行环境:是否仍保证浏览器可用(影响 `lib`/类型环境与是否允许访问 `window`)
  - 决策:环境无关,不提供 IIFE/CDN
- [x] Q12 工程选型:唯一包管理器(npm / pnpm)、Git 钩子(husky + lint-staged + commitlint)是否引入、dev 示例方案(替换原 `demo/` 流程或删除)、是否需要 IIFE/CDN 产物
  - 决策:pnpm、不引入 Git 钩子、删除 dev 脚本、无 IIFE

## 1. 旧实现已知缺陷(重写时规避,并配回归测试)
- [x] `task/stepTask.js` 无法运行:`this.this.#index`、`checkTask()` 缺 `this.`、无越界判断、未导出;在新 StepTask 实现中解决(是否导出见 Q10)
- [x] `UnorderedList.request` 在 fulfilled 后返回裸数组 `resolveList`,与 pending 路径的 `{ list, dataMap }` 不一致【需确认 Q5】
- [x] request 超限返回 `undefined`,`Cell` 内 `this.request()[method]` 抛 TypeError(`await` 同理)【需确认 Q4】
- [x] `TaskOrder.getStatus()` 从链尾计数,`getTracks` 恒为 0;新实现必须返回正确的待匹配数量(字段名见 Q3)【字段名需确认 Q3】
- [x] `Cell` 中 `Reflect ? … : …` 在无 Reflect 环境直接 ReferenceError;`NOISE` 用字符串匹配 Symbol 永不命中,`Symbol.toStringTag` 被覆盖成函数;新实现不得依赖运行时拷贝 `Promise.prototype`(是否保留 thenable 见 Q7)
- [x] `TaskOrder.#zipUp` 遗留 `console.log("zipUp", next)`
- [x] `pushResolve` 用返回字符串表达错误,调用方无法感知【需确认 Q4】
- [x] `clear()` 直接丢弃 pending 的 resolve 函数,旧 Promise 永远悬挂【需确认 Q4】
- [x] `utils/checkEnvironment.js` 的 `window && …` 在 Node 下 ReferenceError;新实现不得直接访问 `window/navigator`(浏览器范围见 Q11)

## 2. 架构与 API
- [x] `createTaskList`(有序/无序)与 `createTaskOrder` 保持独立模块;TaskList 内部有序/无序重复的 `request` 逻辑可在模块内收敛为单一状态来源
- [x] 公开入口保持 `createTaskList`、`createTaskOrder`,实例方法名、参数名、返回结构保持现状,仅 Q1–Q7 经确认的项可变
- [x] 删除 0.x 旧 API:`requestCount/responseCount`、`pushResponse`、`request(cb)`/`checkCallback`、`addOldMotheds`【需确认 Q1】
- [x] 统一 `createTaskList` 的 `ordered` 默认值与文档【需确认 Q2】
- [x] 评估并确定 thenable 设计(每次 `then/catch/finally` 消耗一个 request 名额,且实例被 `return`/`await` 时会被隐式展开)【需确认 Q7】
- [x] `paused()` 与内部 `paused` 字段同名,公开方法是否改名【需确认 Q6】
- [x] 入参校验:`taskCount/resolveCount` 必须为正整数【需确认 Q4】
- [x] 新增失败路径:`pushReject`、超时、`AbortSignal` 取消,使 `.catch/.finally` 真正可用【新增 API,签名需确认 Q10】
- [x] 完成 StepTask(并发池:limit、结果/错误顺序、完成回调)【新增 API,是否导出需确认 Q10】
- [x] 内部命名语义化:`SeaAnemones/Cell/conch/lobster/dolphinTribe/jellyfishGroup…`、`MOTHODS/motheds` 拼写(均为内部名,不影响导出)
- [x] 魔法字符串状态(`static/pending/fulfilled`)改为联合类型/枚举
- [x] 清理无引用代码:`constant.js` 中 `DEFAULT_COBBLESTONE/BROOK/RIVERS/FLOOD/RIVER_NETWORK`、`explain.js` 的 `TURBOCHARGER*`、`getSpareParts`、`tips.js` 与 `getLanguage`(i18n 未接入)

## 3. TypeScript 迁移
- [x] 全部源码迁移为 `.ts`,开启 `strict`,产出 `.d.ts`
- [x] 源码统一放入现有空目录 `src/`(入口 `src/index.ts`),删除根目录 `index.js`、`task/`、`utils/`、`container/`
- [x] 泛型化:`createTaskList<T>`、`pushResolve<T>`、`dataMap` 类型
- [x] 导出公共类型
- [x] 编译 `target` 按 Node 22 能力设定(不低于 ES2022),不再降级私有字段
- [x] 清理 `.vscode/settings.json` 中 `mothed/Motheds/MOTHODS` 拼写词条
- [x] TypeScript 与 typescript-eslint、Vitest、构建工具的版本组合以实施时核实的兼容性为准

## 4. 构建与发布
- [x] 以 Q9 选定的工具替换 rollup 2 + rollup-plugin-babel/terser/json(三者均已被 npm 官方标记弃用,2019-2020 后无更新)
- [x] 产物格式按 Q8 确定;现状仅 CJS,但 `module` 字段却指向它
- [x] `package.json`:补 `exports/types/sideEffects/engines(node)/repository/bugs`,移除非标准 `npmFileMap`
- [x] `dependencies` 中误置的 `rollup-plugin-json`(且无引用)移除,运行时依赖保持为空,与 README“零依赖”一致
- [x] 删除 `.babelrc`、`babel.config.js`、`config/rollup.config.*`;不再依赖构建期 `drop_console`(现状会删光产物中的 `console.warn`,警告在生产永不出现)
- [x] `npm test` 不再依赖先 build
- [x] 统一包管理器,删除多余锁文件(`package-lock.json` 与 `yarn.lock` 并存)【需确认 Q12】
- [x] dev 脚本依赖 rollup-plugin-serve/livereload(livereload 2021 后无更新),且 `demo/` 被 gitignore 且不存在,替换或删除【需确认 Q12】
- [ ] 发布流程:`release` 直接 `npm publish`,引入 changesets + CHANGELOG + `prepublishOnly` + provenance
  - 已完成:changesets 配置、`prepublishOnly`、`release` 改为 `changeset publish`(`package.json` 已是 2.0.0,2.0.0 的 CHANGELOG 手写,之后的改动再用 changeset)
  - 未完成:provenance 需要 CI 的 OIDC,放到 §7

## 5. 测试(全部重写,Vitest,直接测 `src/`)
- [x] 删除 `test/`、`old-test/` 全部旧用例,不迁移
- [x] 统一用 fake timers / 显式 `await`,禁止把 `expect` 写在不被等待的 `setTimeout` 回调里;用例名准确描述行为
- [x] 基础行为:`createTaskList`(有序、无序)与 `createTaskOrder` 的 `request/pushResolve/clear/getStatus/paused/running/getLastCompletedTask`(以最终 API 名称为准)、超限、先 `pushResolve` 后 `request`、fulfilled 后再 `request`
- [x] 并发竞态:同一 tick/微任务内多个 `request`/`pushResolve` 交错、乱序到达、`paused` 期间到达、`clear` 与 `pushResolve` 同时发生、StepTask 并发上限不被突破且结果顺序正确
- [x] 重复调用:重复 `pushResolve`、重复 `clear`、重复 `paused/running`、同名 key 覆盖、超限后重复 `request`、fulfilled 后重复 `request`
- [x] 内存释放:`clear` 后 pending Promise 被结算且无强引用残留;`TaskOrder` 已匹配节点可被回收;StepTask 完成后释放任务与结果引用;使用 `--expose-gc` + `WeakRef/FinalizationRegistry`,断言需防抖(多次 gc + 轮询)
- [x] 类型声明测试:Vitest typecheck(`expectTypeOf`、`@ts-expect-error`)覆盖泛型、公共类型导出与错误用法;并对产物 `.d.ts` 做独立 `tsc --noEmit` 消费验证
- [x] npm 包导出测试:`npm pack` 后在临时目录安装,按 Q8 的产物格式分别以 `import`/`require` 加载,并以 TS `moduleResolution: node16/nodenext/bundler` 消费;校验 `exports/types/files`;用 publint 与 @arethetypeswrong/cli 作为门禁
- [x] 覆盖率阈值(`@vitest/coverage-v8`)

## 6. 代码质量与工程化
- [x] 删除 `.eslintrc`(ESLint 8 与 @typescript-eslint 5 均已 EOL,配置含 JSON 尾逗号),改用 ESLint flat config + typescript-eslint,版本组合实施时核实兼容性
- [x] 增加 `lint`、`typecheck`、`format`、`test`、`build` 脚本,引入 Prettier 与 `.editorconfig`
- [x] Git 钩子(husky + lint-staged + commitlint)是否引入【需确认 Q12】
- [x] devDependencies 全面刷新,移除 rollup*/babel*/jest/tslib 等不再需要的包

## 7. CI/CD
- [ ] 新增 GitHub Actions:lint + typecheck + test(含类型、包导出、内存测试)+ build
- [ ] Node 版本矩阵:22(Jod)、24(Krypton)为 LTS;26 目前为 Current,仅作非阻塞项;不再测试 Node 20 及以下
- [ ] tag 触发自动发布(provenance)与 Release Notes
- [ ] 启用 Dependabot

## 8. 文档
- [x] README 与实现保持一致:`ordered` 默认值、`getStatus` 字段名、示例输出里的 `time 200: request-2`(随 Q2/Q3 结果同步)
- [x] 中英文 README 同步;补 TS 用法、Node 22+ 要求、引入方式(随 Q8)、1.x → 2.0 迁移指南(仅列经确认的 API 变更)
- [x] 补新增 API(失败路径、StepTask)文档(badge 本轮不做,未勾选的部分见下一项)
- [ ] 补 badge
- [x] 删除 `previousVersions/` 文档(不再兼容旧版本)
- [x] 补 CHANGELOG.md(2.0.0 手写)
- [ ] 补 CONTRIBUTING.md
