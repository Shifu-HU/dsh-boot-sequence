# dsh-boot-sequence

把开机动画接进 the agent runtime 的 **Web UI 插件**：`shell.overlay` 上的全屏浮层，
启动后播放一遍 eDEX-UI 风格的开机序列，然后自行卸载。

## 状态

| 项 | 状态 |
|---|---|
| 包安装 | ✅ `install_bundle` 返回 `application: applied`，无 warnings |
| Host 条目 | ✅ `include:dsh-boot-sequence` 已在 Loader 中 |
| Client 模块 | ⚠️ **需要重启一次**才生效（见下） |

### 为什么必须重启

`clientModules` 服务在**构造时**做一次 `dsh.client` 扫描
（`@deepseek-ai/dsh-client-modules` 的 `flush()`），之后的增量重建只由
`internal/plugin` 事件驱动。插件是在该服务已经起来之后热安装的，
所以它没被算进 boot graph —— 因此 `shell.overlay` 的 occupants 里暂时看不到
`dsh-boot-sequence`。

重启 Harness 后，新进程启动期的扫描会带上这个包，前端加载时即出现动画。

## 播放行为

- **触发**：页面加载即播放，全程约 8.5 秒
- **跳过**：`Esc` 或任意点击 —— 但不是硬切，同样走 620ms 淡出
- **收尾**：淡出结束后组件卸载，DOM / 定时器 / 音频上下文全部释放
- **一次性**：只在页面加载时播，不随会话切换重播

### 视觉

| 项 | 取值 | 说明 |
|---|---|---|
| 前景 | `#eef2f7` 白 | 深底白字，对比度 ~15:1；早期版本用 DeepSeek 蓝，在同底色下偏暗 |
| 底板 | `#05080d` | 纯色态背景 |
| 倒角 | `--bevel: 1.5vh` | 八角切角板，见下 |
| 标题字 | United Sans Medium 子集 | eDEX 同款 |

**倒角实现**：`clip-path` 会把 `border` 斜边切豁，所以边框不是 border 而是**两层板叠出来的** ——
外层 `padding: var(--ring)` 的白板，里层再叠一块按 `--ring` 缩小倒角的板，
两条斜边步进量一致，斜边才能等厚。

### 音效

eDEX 原版的 wav 是 CC-BY-NC-SA 且体积大，没有搬运，改用 **Web Audio 现场合成**，
cue 结构与原版一致：

| 时机 | 声音 |
|---|---|
| 每打印一行日志 | 6ms 滤波 blip（约 1.8–2.8kHz，`i % 5` 换频） |
| 打印到 `Boot Complete` | 上行四音 chime（C5-E5-G5-C6） |
| 标题屏出现 | 55Hz + 82.5Hz sub 低频 swell |

浏览器自动播放策略会拦截无手势的音频；组件在 `pointerdown` / `keydown` 时尝试
`resume()`，所以只要你在播放期间点过页面，后续 cue 就会响。**静音不会阻塞动画。**

## 数据来源

| 内容 | 来源 |
|---|---|
| 逐行节奏表 | 逐行移植 `edex-ui` 的 `displayLine()` `switch(true)` |
| 标题屏 8 段演出 | 移植 `displayTitleScreen()` |
| 网格背景 / 竖排日志 | 照抄 `main.css` 与 `boot_screen.css` |
| glitch 错位 | `derezzer_top/bottom`：50ms 线性 alternate-reverse，用 JS 复算位移 |
| 鲸鱼线稿 | 官方 `icon.png` 经 potrace 描矢量（`../dexui-boot/assets/whale-paths.js`） |
| 字体 | united_sans_medium + fira_mono，**子集化后内联**（389KB → 7KB） |

主题色取 DeepSeek 蓝 `rgb(127,160,255)`，替换原版的 tron 冷灰 `rgb(170,207,209)`。

## 构建

`client.js` 是生成物，不要手改。源文件是 `src/client.template.js`：

```bash
# 1. 字体子集（一次性，需要 fonttools）
bash tools/subset-fonts.sh          # 在 WSL 里跑，产出 build/fonts/*.woff2

# 2. 字体 base64 内联
python3 tools/build-fonts-css.py

# 3. 把 boot-log 数据 + 字体 CSS 折进模板
node tools/build-client.cjs

# 4. 装前自检（语法、清单、locale、icon、注入声明）
node tools/precheck.cjs
```

改完代码后需要重新 `install_bundle` **并且重启 Harness**，因为 Client 模块是启动期扫描的。

## 文件

```
dsh-boot-plugin/
├─ package.json          dsh.bundle.patch + dsh.client (platform=web, immediately)
├─ cordis.patch.yml      插入 dsh-boot-sequence 行
├─ index.js              Host 半部：apply() 为空，渲染全在 Client
├─ client.js             ⚠️ 生成物（由 src/client.template.js 构建）
├─ src/client.template.js 渲染、时间轴、清理逻辑（可读源）
├─ build/boot-log.js     85 行日志 + 鲸鱼路径
├─ build/fonts.css       内联字体（生成物）
├─ build/fonts/*.woff2   子集字体
├─ locale/{en,zh}.json   Plugin Manager 显示用的标题与描述
├─ icon.svg              自绘图标：终端扫描线 + 鲸鱼线稿
└─ tools/                子集化、构建、自检脚本
```

## 验证手段

```bash
node tools/precheck.cjs        # 清单 / locale / icon / 注入声明
node tools/contract-test.cjs   # 真跑 client.js：apply 不抛错、注册槽位、四点评测回归
bash  tools/render-stills.sh 5200,6200   # 在 WSL 无头 Chromium 里渲染真代码的静帧
```

`contract-test.cjs` 是为「模块能加载但 `apply()` 抛错」这类故障加的 —— 它抓出过
`styles` 不存在的真 bug。`render-stills.cjs` 用一个极小的 React 桩把真组件渲成 DOM，
所以看到的是**真代码**的效果，不是另画的预览。

## 踩过的坑

1. **`inject: []` 是错的**。`ctx.slots` 只有在 `inject: ['slots']` 时才存在；
   否则 `apply()` 抛错，但表现只是"slot 里没东西"，很难定位。
2. **用 `dsh.client.external` 引用包内子路径行不通**。loader 会把 `require('./x')`
   当成裸模块名解析，直接把 JSON 插到 `<head>` 里（会触发语法错误）。
   最终改为**构建期内联**数据，Client 只 `require('react')`。
3. **`type: "module"` 的包里 `.js` 工具脚本不能用 `require`**，要写成 `.cjs`。
4. **不要在模板注释里写占位符字样**，构建会连带替换注释，把文件写坏。
5. **`border` 会被 `clip-path` 斜边裁豁**。倒角边框要用两层板叠（外白板当描边，
   内板按描边宽度缩小倒角），不能直接给切角元素加 border。
6. **不在 `apply()` 里给 `<style>` 打 `data-plugin`**。模块系统按 factory 执行期间
   新增的未标记 `<style>` 自动认领（`claimStyles`），手动标记会和主题插件的
   `data-plugin-css` 约定打架；只标 `data-plugin-css` 用于识别即可。

## 卸载

```bash
plugin_manager remove_bundle @local/dsh-boot-sequence
```

或临时禁用：`plugin_manager set_plugin` / 在设置里关掉。
运行中禁用会走 `ctx.effect` 清理，浮层与样式一并移除。
