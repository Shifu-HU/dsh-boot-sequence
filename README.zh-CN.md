# dsh-edex-boot

[English](README.md) | 中文

给 **the agent runtime** Web UI 的开机动画，致敬
[eDEX-UI](https://github.com/GitSquared/edex-ui)：全屏启动画面，逐行打印 85 行
boot log，落到一个会抖动的标题牌，然后淡出进入工作区。

![预览](https://raw.githubusercontent.com/Shifu-HU/dsh-edex-boot/main/docs/preview.png)

[![npm](https://img.shields.io/npm/v/dsh-edex-boot.svg)](https://www.npmjs.com/package/dsh-edex-boot)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 安装

已发布到 npm：**[dsh-edex-boot](https://www.npmjs.com/package/dsh-edex-boot)**

### 命令行安装

```bash
dsh plugin --profile desktop add dsh-edex-boot
```

### 在会话内安装

```
plugin_manager install_bundle dsh-edex-boot
```

锁定版本（不希望自动升级时）：

```bash
dsh plugin --profile desktop add dsh-edex-boot@1.0.0
```

### 从 Git

```bash
dsh plugin --profile desktop add github:Shifu-HU/dsh-edex-boot
```

### 从本地目录

```bash
dsh plugin --profile desktop add C:/path/to/dsh-edex-boot
```

安装后需**重启桌面端**。Client 模块在启动时扫描，热安装不会立即生效。

## 首次使用

无需任何配置。打开应用即播放一次，播完自行卸载。

| 操作 | 结果 |
|---|---|
| 按 `Esc` | 立即淡出 |
| 点击任意位置 | 立即淡出 |
| 等待约 8.5 秒 | 完整播放并淡入工作区 |

## 行为说明

- **每次页面加载播放一次**，不会随会话或路由切换重播。
- **自动卸载**：结束后组件返回 `null`，定时器、监听器、样式表一并释放。
- **不拦截点击**，淡出开始后不再遮挡操作。
- **声音可选**：浏览器策略会拦截无手势的音频，首次点击后才开始出声；静音不影响动画。

## 卸载

```bash
plugin_manager remove_bundle dsh-edex-boot
```

或在 **设置 → 插件** 中关闭。

## 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 装完没反应 | Client 模块启动时才扫描 | 重启桌面端 |
| 白屏，没有 boot log | 模块加载失败 | 看 DevTools Console 是否有 `slot entry crashed` |
| 没有声音 | 浏览器自动播放策略 | 播放期间点一下页面 |
| 鲸鱼娘不显示 | 资源路由被拦 | 确认 `/plugins/dsh-edex-boot/assets/mascot/whalegirl.webp` 返回 200 |
| 每次切换页面都重播 | 不应发生 | 请反馈，卸载守卫在 `client.js` 中 |

## 从源码构建

发布的 `client.js` 是生成物。改 `src/client.template.js`，然后：

```bash
python3 tools/build-fonts-css.py     # 内联字体子集
node tools/build-client.cjs          # 把数据、字体、音效折进 client.js
node tools/contract-test.cjs         # 加载并渲染契约测试
node tools/precheck.cjs              # 清单、资源、署名检查
```

`tools/render-stills.cjs` 可在无头 Chromium 里渲染真实组件做视觉核对。

## 已知限制

- boot log 为英文，与 eDEX-UI 的控制台输出保持一致。
- 鲸鱼娘是从第三方设定图提取的线稿，**并非原创美术**（见署名）。
- 暂无配置项。

## 署名

第三方素材与许可见 [CREDITS.md](CREDITS.md)。

- 鲸鱼娘形象 —— CC BY-NC-SA 4.0，上游作者：上善无形（上善）· ZipZipPipe · YunYueSama · xiaoweigen
- 启动音效 —— GitSquared/edex-ui，GPL-3.0

**鲸鱼娘素材为非商业使用**，任何商业发行前必须替换。

## 许可

插件源码采用 MIT —— 见 [LICENSE](LICENSE)。随附素材保留各自许可，不因本项目而重新授权。
