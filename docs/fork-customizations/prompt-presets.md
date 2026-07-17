# Fork 定制：提示词预设 (Prompt Presets)

> 本文档记录本 fork 相对上游 `tongjibridge/TouchAI` 的改动，便于上游更新后快速 rebase / 重做。
> 所有路径相对仓库根目录，锚点尽量选稳定的符号名（类型名、export 常量），而非行号。

## 功能概述

在聊天输入框（SearchBar）下方横排显示用户自定义的预设提示词，点击即插入到光标处；
在设置窗口新增「提示词预设」独立分区，支持新增 / 编辑 / 删除 / 上移下移排序。
预设持久化到 SQLite settings 表（key = `prompt_presets`），跨窗口自动同步，无需数据库迁移。

默认内置 5 个预设：翻译成中文、翻译成英文、总结全文、改写润色、解释代码。

---

## 新增文件（6 个）

| 文件 | 职责 | 受上游影响？ |
|---|---|---|
| `apps/desktop/src/stores/setting/sections/promptPresets.ts` | section 模块：数据模型、zod schema、parse/serialize、默认预设 | 低（独立模块） |
| `apps/desktop/src/views/SettingsView/components/PromptPresets/index.vue` | 设置区管理 UI（列表 + 编辑对话框 + 增删改排序 + 250ms 自动保存） | 中（依赖 store/DialogShell/useConfirm 模式） |
| `apps/desktop/tests/SettingsView/promptPresetsConfig.test.ts` | config 解析/序列化/容错测试 | 低 |
| `apps/desktop/tests/SettingsView/settingsPromptPresetsSection.test.ts` | 组件交互 + 自动保存测试 | 中 |
| `apps/desktop/tests/SettingsView/promptPresetsI18n.test.ts` | 双 locale 文案断言 | 低 |
| `docs/fork-customizations/prompt-presets.md` | 本文档 | 无 |

---

## 修改文件（10 个）

> 锚点 = 在该文件内搜索此关键词即可定位改动。

### 1. `apps/desktop/src/stores/setting/sections/registry.ts`
**锚点**：`JSON_SETTINGS_SECTIONS` 数组、类型联合 `JsonSettingsKey` / `JsonSettingsStateKey` / `JsonSettingsComputedName` / `JsonSettingsUpdaterName` / `RegisteredJsonSettingsValue`、`ui.sectionId` 联合。

改动：
- import promptPresets 模块
- 上述 5 个类型联合各加一个 `prompt_presets` / `promptPresets` / `updatePromptPresets` 分支
- `ui.sectionId` 联合加 `'prompt-presets'`
- `JSON_SETTINGS_SECTIONS` 数组新增一项（navigationOrder: 15，icon: 'sparkles'）
- 新增 `validatePromptPresets()` 函数（返回空数组）

### 2. `apps/desktop/src/stores/setting/index.ts`
**锚点**：`GeneralSettingsData`、`GeneralSettingsComputedRefs`、`GeneralSettingUpdaters` 三个 interface。

改动：
- import `PromptPresetsConfig` 类型
- `GeneralSettingFieldValue` 联合加 `PromptPresetsConfig`
- `GeneralScalarSettingStateKey` 的 Exclude 列表加 `'promptPresets'`
- 三个 interface 各加一个 `promptPresets` / `promptPresets` / `updatePromptPresets` 字段

> 完成后 store 自动暴露 `promptPresets` computed 和 `updatePromptPresets()`，无需改 `stores/settings.ts`。

### 3. `apps/desktop/src/components/appIconMap.ts`
**锚点**：`import IconSearch`、`search: IconSearch`。

改动：加 `import IconSparkles from '~icons/lucide/sparkles';` 和 `sparkles: IconSparkles`。

### 4. `apps/desktop/src/views/SettingsView/settingsNavigation.ts`
**锚点**：`NavigationSection` 联合类型。

改动：联合加 `'prompt-presets'`。

> 导航项会从 `JSON_SETTINGS_SECTIONS` 自动生成（`jsonSettingsNavigationDefinitions`），无需手写导航数组条目。

### 5. `apps/desktop/src/views/SettingsView/index.vue`
**锚点**：`const SearchView = defineAsyncComponent`、`settingsContentSections`。

改动：
- 加 `const PromptPresetsView = defineAsyncComponent(...)`
- `settingsContentSections` 加 `'prompt-presets': { component, loadingKey: 'settings.loading.promptPresets', scrollable: true }`

### 6. `apps/desktop/src/views/SearchView/index.vue`
**锚点**：`const { searchWindowDefaultSize } = storeToRefs(settingsStore);`、`<SearchBar ref="searchBar"`、`sessionHistory.length === 0` 的 `QuickSearchPanel` 容器。

改动：
- storeToRefs 解构加 `promptPresets`
- 新增 `visiblePromptPresets` computed 和 `handlePresetClick(text)` 函数
- 模板在 `<SearchBar>` 与 `QuickSearchPanel` 容器之间插入预设行（chip 风格按钮），显示条件：`sessionHistory.length === 0 && visiblePromptPresets.length > 0`
- click 调 `searchBar.value?.insertTextAtCursor(preset.text)`（该方法在上游 SearchBar `defineExpose` 中已存在）

### 7. `apps/desktop/src/i18n/messages.ts`
**锚点**：`settings.loading.search`、`settings.nav.search.label`、`settings.nav.group.system`、`settings.search.title`（中英文各一组）。

改动：在上述锚点附近加 `settings.loading.promptPresets`、`settings.nav.promptPresets.*`、`settings.promptPresets.*` 一整组键（zh-CN 和 en-US 都要加，类型系统强制两套键一致）。

### 8-10. 测试文件（既有测试同步更新）
| 文件 | 锚点 | 改动 |
|---|---|---|
| `tests/SettingsView/settingsRegistry.test.ts` | `'registers json-backed settings sections by persistent key'` | 期望数组加 `'prompt_presets'` + 对应断言 |
| `tests/stores/setting.test.ts` | `EXPECTED_GENERAL_SETTING_KEYS`、`'declares stable computed and updater bindings'` | 两处期望数组加 `prompt_presets` / `promptPresets` / `updatePromptPresets` |
| `tests/SettingsView/navigation-sidebar-i18n.test.ts` | `flattenSettingsNavigation().map(...)` | 扁平导航期望加 `'Prompt Presets'`（排在 Search 和 Browser Control 之间） |

---

## 上游同步检查清单

rebase / merge 上游后逐一确认：

- [ ] `registry.ts` 的 6 个类型联合（`JsonSettingsKey` 等）和 `JSON_SETTINGS_SECTIONS` 数组仍存在 → 若上游重构了注册机制，对照 Search section 的新写法重做
- [ ] `setting/index.ts` 的 `GeneralSettingsData` / `GeneralSettingsComputedRefs` / `GeneralSettingUpdaters` 三个 interface 仍存在
- [ ] `settingsNavigation.ts` 的 `NavigationSection` 联合仍存在，且 `jsonSettingsNavigationDefinitions` 仍从 `JSON_SETTINGS_SECTIONS` 自动生成
- [ ] `SettingsView/index.vue` 的 `settingsContentSections` 仍存在
- [ ] `SearchView/index.vue` 里 `<SearchBar ref="searchBar">` 渲染处、`QuickSearchPanel` 容器、`searchBar.value?.insertTextAtCursor` 调用仍存在 → 若 `insertTextAtCursor` 改名，在 SearchBar `defineExpose` 里找对应方法
- [ ] `messages.ts` 的 `zhCNMessages` / `enUSMessages` 两个 map 仍存在
- [ ] `appIconMap.ts` 的 `appIconMap` 对象和 `~icons/lucide/sparkles` 图标可用
- [ ] `DialogShell.vue`、`useConfirm`、`useAlert`、`Button`、`Input` 组件 API 未变

## 冲突应对策略

- **上游重构 settings 注册机制** → 参考 Search section 在新版中的写法，把 promptPresets 对齐（核心是 key/stateKey/parse/serialize/validate/store/ui 七元组）
- **上游把 `insertTextAtCursor` 改名** → 在 SearchBar `defineExpose` 找新方法名；若改为命令式 API，改用新 API
- **上游改 i18n 键名前缀**（如 `settings.promptPresets` → `settings.prompts`）→ 全局替换 fork 新增的键
- **上游新增别的 JSON section** → 检查 `navigationOrder` 是否冲突，调整 promptPresets 的 order 值

## 验证命令

```bash
# 单独验证本功能（6 个相关测试文件，30 个测试）
cd apps/desktop && pnpm vitest run \
  tests/SettingsView/promptPresetsConfig.test.ts \
  tests/SettingsView/promptPresetsI18n.test.ts \
  tests/SettingsView/settingsPromptPresetsSection.test.ts \
  tests/SettingsView/settingsRegistry.test.ts \
  tests/SettingsView/navigation-sidebar-i18n.test.ts \
  tests/stores/setting.test.ts

# 类型检查
pnpm type:check        # src
pnpm test:typecheck    # tests

# 完整 PR 前门禁（注意：tests/utils/font.test.ts 在上游纯净代码也失败，与本 fork 无关）
pnpm test:pr
```

## 回滚指引

完全还原到上游状态：
1. 删除 6 个新增文件（见上表）
2. 在 10 个修改文件内搜索以下关键词删除对应改动段：
   - registry.ts：搜 `promptPresets` / `PROMPT_PRESETS`
   - setting/index.ts：搜 `promptPresets` / `PromptPresetsConfig`
   - appIconMap.ts：搜 `sparkles` / `IconSparkles`
   - settingsNavigation.ts：搜 `'prompt-presets'`
   - SettingsView/index.vue：搜 `PromptPresetsView` / `'prompt-presets'`
   - SearchView/index.vue：搜 `visiblePromptPresets` / `handlePresetClick` / `prompt-presets-row`
   - messages.ts：搜 `promptPresets`
   - 3 个既有测试文件：搜 `prompt_presets` / `promptPresets` / `Prompt Presets` 删除新增的期望项
