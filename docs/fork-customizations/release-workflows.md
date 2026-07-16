# Fork 定制：禁用 Release 自动化流程

> 本 fork 仓库默认不运行上游的自动发版流程，避免因缺少 token / Cloudflare 配置而在每次 push 时产生失败噪音。

## 背景

上游 `tongjibridge/TouchAI` 配置了完整的自动发版流水线：

| Workflow | 触发 | 依赖 |
|---|---|---|
| `release-please.yml` | push 到 main | `RELEASE_PLEASE_TOKEN` (PAT) + Cloudflare R2 |
| `release.yml` (Prerelease) | 手动 / 每日 cron | Cloudflare R2 + Velopack |

fork 仓库自用开发时，这些流程缺少必要 secret（尤其 `RELEASE_PLEASE_TOKEN`），每次 push main 都会失败，干扰正常 CI 信号。

## 改动

给两个 release workflow 的入口 job 各加一个门禁条件：

```yaml
if: ${{ vars.ENABLE_RELEASE == 'true' }}
```

- 默认（不设 `ENABLE_RELEASE` 变量）→ 这两个 workflow 的 job 直接跳过，不报错
- 想恢复发版流程时，在 GitHub **Settings → Secrets and variables → Actions → Variables** 里新建仓库变量 `ENABLE_RELEASE = true`，无需改代码

## 恢复完整发版的步骤

1. 仓库 Settings → Variables → New variable：`ENABLE_RELEASE` = `true`
2. 仓库 Settings → Secrets → New secret：
   - `RELEASE_PLEASE_TOKEN`：一个有 `contents:write` + `pull-requests:write` 权限的 PAT
   - `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`：Cloudflare 凭证
3. 配置 R2 bucket（`apps/desktop/product.json` 里的 `services.updates.deployment.bucketName`）

## 受影响文件

| 文件 | 改动 |
|---|---|
| `.github/workflows/release-please.yml` | `release-please` job 加 `if: vars.ENABLE_RELEASE == 'true'` |
| `.github/workflows/release.yml` | `resolve` job 加 `if: vars.ENABLE_RELEASE == 'true'`（`publish-release` needs resolve，会连带跳过） |

## 上游同步

rebase 上游后，若这两个 workflow 有更新，只需重新在对应入口 job（`release-please` / `resolve`）顶部保留那行 `if: ${{ vars.ENABLE_RELEASE == 'true' }}` 即可。
