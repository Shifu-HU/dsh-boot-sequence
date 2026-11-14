# 素材署名与许可

本插件包含两处**非自行创作**的第三方素材。它们各自的许可义务如下，分发或改编时请保留本文件。

## 1. 鲸鱼娘形象（`assets/mascot/whalegirl.webp`）

基于成熟版（女仆装）设定图 `dafeiyu-mature-character-sheet.png`，
取该图**左上约 75% 区域**（正面立绘的头部与上身，非全身），
再经边缘检测提取线稿、去除相邻人物的串入部分、并以单色重绘为**无颜色线稿**。

> 该设定图沿用 [xiaoweigen/deepseek-dafeiyu-assets](https://github.com/xiaoweigen/deepseek-dafeiyu-assets)
> 所整理的 DeepSeek 大肥鱼／鲸鱼娘形象体系：
> 原始角色形象「上善无形（上善）」；DeepSeek 女仆形象二次设计「ZipZipPipe」；
> Q 版设定图参考「YunYueSama」（https://github.com/YunYueSama/codex-deepseek-pet）；
> 本组改编与整理「xiaoweigen」。
>
> 上游改编贡献许可：**CC BY-NC-SA 4.0**
> （https://creativecommons.org/licenses/by-nc-sa/4.0/），保留适用的完整上游许可。
>
> 本插件新增修改：裁切为正面头身、提取边缘线稿、剔除相邻视图残影、
> 去除全部色彩并以单色重绘、缩放至 520px 高。

**非商业使用**：不得以获取商业优势或金钱报酬为主要目的使用该素材。
如用于商业场景，请替换为自有素材。

## 2. 启动音效（`audio/*.wav`）

直接取自 [GitSquared/edex-ui](https://github.com/GitSquared/edex-ui) 的
`src/assets/audio/`，未作修改：

| 文件 | 用途 | 原路径 |
|---|---|---|
| `stdout.wav` | 每打印一行 boot log 时播放 | `src/assets/audio/stdout.wav` |
| `granted.wav` | 打印到 `Boot Complete` 时播放 | `src/assets/audio/granted.wav` |
| `theme.wav` | 标题屏出现时播放 | `src/assets/audio/theme.wav` |

eDEX-UI 以 **GPL-3.0** 发布；其自带音效文件随仓库分发。本项目对 eDEX-UI 的
使用限于此三份音频素材，未复制其代码（时序逻辑为依据 `boot_screen.css` /
`_renderer.js` 的公开行为重新实现）。

## 3. 字体

| 文件 | 来源 | 许可 |
|---|---|---|
| `build/fonts/*.woff2` | United Sans Medium、Fira Mono 子集 | 各自 OFL / 随 eDEX-UI 分发 |

字体经 `pyftsubset` 子集化后以 base64 内联进样式表，未修改字形设计。
