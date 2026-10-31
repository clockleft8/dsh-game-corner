# dsh-game-corner

DSH 小游戏角：五子棋 / 2048 / 扫雷 / 坦克 / 象棋 / 国象 / 围棋(19路) / 公式本，外加一个可拖动的浮窗。
纯本地代码；只有你自己配了模型接口，才会向那个地址发一次请求。

## 安装

**方式 A（推荐）**：把仓库地址丢给 DSH

> 帮我把 https://github.com/clockleft8/dsh-game-corner 装成插件

**方式 B（手动）**

```bash
cd ~/.dsh/profiles/<你的 profile>/node_modules
git clone https://github.com/clockleft8/dsh-game-corner.git
```

profile 的 `package.json` 加 `"dsh-game-corner": "file:./node_modules/dsh-game-corner"`，
启用清单加名字，重启 DSH。装完顶栏多一个「小游戏」。

## 玩法

- 顶栏「小游戏」。顶行有「开浮窗 / 收浮窗」；浮窗可拖动，收起来只隐藏、局面不丢。
- 八个标签：五子棋、2048、扫雷、坦克、象棋、国象、围棋（19 路）、公式本。
- 棋类都有「先后手」切换；坦克可调血量、敌车数 1–6、地图 13/15/19/23；扫雷三档；围棋固定 19 路。
- 坦克：方向键移动、J/K/L 或空格开火，子弹最多弹两次。
- 公式本：七节要点（各棋种 + 2048/扫雷/坦克 + 先后手差异），可滚动、顶部可跳转。

## 接模型（可选）——怎么填 API key

不填也能玩，四款棋走本地搜索。想让模型当对手就三步：

**第一步：建文件**

Windows：`C:\Users\<你的用户名>\.dsh\game-corner\config.json`
其它系统：`~/.dsh/game-corner/config.json`
（`.dsh` 和 `game-corner` 目录不存在就手动建。）

**第二步：写内容**（把 `apiKey` 换成你自己的）

```json
{
  "apiKey": "你自己的 key",
  "baseUrl": "https://api.deepseek.com/chat/completions",
  "model": "deepseek-chat",
  "timeoutMs": 15000
}
```

- `baseUrl` 只要是兼容 OpenAI 的 `/chat/completions` 端点就能用，换别家只改这一项和 `model`。
- `timeoutMs` 是单次请求上限，网络慢可以调大。
- 存盘即生效，**不用重启 DSH**（每次请求现读这个文件）。

**第三步：验证**

浏览器打开 `http://<你的 DSH 端口>/game-corner/api/status`：

- `{"ok":true,"configured":true,"model":"deepseek-chat"}` → 通了
- `{"configured":false}` → 没读到 key：路径不对，或 JSON 写坏了（少引号、多逗号）
- 404 → 插件宿主半没加载，重启 DSH

然后回到游戏，把棋类难度切到标着「deepseek 模型」的那一档。

**排错**

| 现象 | 原因 |
|---|---|
| 401 | key 不对或余额不足 |
| 400 / 404 | `baseUrl` 或 `model` 名字写错 |
| 一直等不到落子 | 网络到不了那个服务，或 `timeoutMs` 太小 |
| 模型档和普通档没区别 | 请求失败，已自动退回本地搜索（不会卡住，但也没用上模型） |

## 关于密钥（重要）

仓库里**没有**任何 key。代码只做一件事：读**使用者自己机器上**的那个 `config.json`。
谁的机器读谁的 key，不写日志、不回显、不上传。所以把这个仓库给别人，不会带走你的 key。

也请不要把自己的 key 贴到 issue、群聊或截图里。想停用就把 `apiKey` 清空，游戏自动退回本地搜索。

## 兼容性

在 DSH 更新前后两个版本上都验证过：插件状态 active、宿主接口正常。依赖 DSH 的插件 API
（客户端 slot、`webServer.register`、`pluginManager`）。接口大改的版本可能不适用。

## 卸载

插件列表关掉它，从 profile 的 `package.json` 去掉那一行、删掉 `node_modules` 下的目录，重启。
模型配置 `config.json` 是独立文件，想彻底清干净可以一起删。

## 许可

MIT
