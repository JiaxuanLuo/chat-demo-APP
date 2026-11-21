# AI Chat Demo

一个静态聊天示例，现在支持**添加多个 API 平台与模型**，并可以打包成**安卓 App**。浏览器或 WebView 直接请求已配置的 API 服务，不需要应用后端。

项目基于 [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo)。仍然可以直接打开 `dist/index.html`，或在安卓手机上安装 `release/AI-Chat-Demo-0.2.0.apk`。

## 新增内容

- **API 与模型设置**：添加、编辑、删除平台；在输入框左下角的模型菜单中选择当前平台和模型。
- **三种接口类型**：
  - `DeepSeek`：原有的 Anthropic 兼容 Messages / Files 协议，支持联网搜索、链接阅读、服务端标题、语音和深度思考等扩展。
  - `OpenAI`：任意 OpenAI 兼容的 `/chat/completions` 接口，包括 OpenRouter、硅基流动、Moonshot、智谱、阿里云百炼和自建网关。
  - `Anthropic`：原生 Anthropic 兼容的 `/v1/messages` 接口。
- **自动获取模型**：「获取模型列表」会请求平台的 `GET /models` 并填入模型。
- **按能力降级**：平台不支持的功能会隐藏，而不是点击后报错（搜索、语音、深度思考开关、服务端标题）。
- **安卓 WebView 外壳**：文件选择、麦克风权限、外部链接、下载、系统返回键和导出桥（把历史 ZIP 保存到下载目录）。

## 能力对照

| 能力 | DeepSeek | OpenAI 兼容 | Anthropic 兼容 |
| --- | --- | --- | --- |
| 流式回复 | 支持 | 支持 | 支持 |
| 思考过程展示 | 支持 | 返回 `reasoning_content` / `reasoning` 时展示 | 返回原生 thinking 块时展示 |
| 深度思考开关 | 支持 | 隐藏 | 隐藏 |
| 联网搜索、链接阅读 | 支持 | — | — |
| 服务端自动标题 | 支持 | 用首条提问生成 | 用首条提问生成 |
| 附件 | Files API（图片和文档） | 仅图片，内联为 data URL | 仅图片，内联为 base64 |
| 语音输入、朗读 | 支持 | — | — |
| 继续生成 | 支持 | — | — |

API Key 和设置保存在 `localStorage`；会话和附件原件保存在 IndexedDB。请求由应用直接发往你配置的平台。

## 运行（网页）

需要 Node.js 22.12+ 和 pnpm：

```sh
pnpm install
pnpm dev
```

打开 http://localhost:8090 。生成静态产物：

```sh
pnpm build
```

产物位于 `dist/`。直接打开 `dist/index.html` 时，存储和跨域能力取决于浏览器以及 API 平台是否允许该来源；安卓 WebView 版本已显式放开限制。

## 配置平台

1. 打开**设置 → API 与模型**。
2. 选择预设（DeepSeek、OpenAI、OpenRouter、硅基流动、Moonshot、智谱、阿里云百炼、Anthropic）或自定义 OpenAI / Anthropic 兼容平台。
3. 填写接口地址、API Key 和模型。可点**获取模型列表**请求 `GET /models`，也可以每行手动填写一个模型 ID。
4. 保存后该平台立即生效；在输入框左下角的模型菜单中选择平台和模型。

常用接口地址：

| 平台 | 接口地址 | 类型 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com` | DeepSeek |
| OpenAI | `https://api.openai.com/v1` | OpenAI |
| OpenRouter | `https://openrouter.ai/api/v1` | OpenAI |
| 硅基流动 | `https://api.siliconflow.cn/v1` | OpenAI |
| Moonshot | `https://api.moonshot.cn/v1` | OpenAI |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | OpenAI |
| 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI |
| Anthropic | `https://api.anthropic.com` | Anthropic |

DeepSeek 会自动补上 `/anthropic/v1`，如果填写的地址已经包含它则原样使用。OpenAI 兼容平台只有写成纯域名时才会自动补 `/v1`，不确定时请写完整路径。

## 安卓 App

预构建的 APK 位于 [`release/AI-Chat-Demo-0.2.0.apk`](release/AI-Chat-Demo-0.2.0.apk)（debug 签名，约 1.9 MB）。安装：

```sh
adb install -r release/AI-Chat-Demo-0.2.0.apk
```

需要调试 WebView（`chrome://inspect`）时可以使用 `release/AI-Chat-Demo-0.2.0-debug.apk`。也可以把 APK 复制到手机，允许「安装未知来源应用」后安装。

### 使用 Android Studio 构建

1. 先构建网页产物：`pnpm install && pnpm build`。
2. 在 Android Studio 中打开 `android/` 目录。
3. 使用 JDK 17+，并安装 Android SDK platform 36、build-tools 36。
4. 运行 **app**，或选择 **Build → Build APK(s)**。

`app/build.gradle.kts` 会在每次构建前把 `../dist` 同步进安装包资源；如果 `dist/index.html` 不存在，会给出明确提示。

### 命令行构建

```sh
pnpm android          # release 变体 -> release/AI-Chat-Demo-<版本>.apk
pnpm android:debug    # debug 变体，可用 chrome://inspect 调试
```

项目自带 Gradle wrapper（Gradle 8.14.3、AGP 8.13.0）。首次构建需要联网下载 Gradle 与 AGP 依赖；`local.properties` 指向本机 Android SDK，已被 git 忽略。`android/gradle.properties` 用 `org.gradle.java.home` 固定了本机的 JDK 21，因为 Android Studio 自带的 JBR 25 超出 Gradle 8.14 的支持范围；换机器构建时请修改该路径，或在 Android Studio 中设置 Gradle JDK。

应用信息：

- 包名 `com.chatdemo.app`，版本 0.2.0，minSdk 26（Android 8），targetSdk 34，compileSdk 36。
- 网页资源打包在 `assets/`，从 `file:///android_asset/index.html` 加载。
- 打开 `setAllowUniversalAccessFromFileURLs(true)`，让不返回 CORS 头的第三方 API 也能被调用；允许明文 HTTP，方便自建接口。
- 文件选择、麦克风、外部链接、下载和返回键由原生处理；历史导出通过 `AndroidBridge.saveBase64` 写入下载目录。
- release 变体使用 Android 标准 debug 密钥签名，方便直接安装；正式发布前请把 `android/app/build.gradle.kts` 中的 `signingConfig` 换成自己的密钥。

## 数据

API Key 和设置保存在浏览器 localStorage，会话及附件原件保存在 IndexedDB，本地数据按浏览器用户配置和站点源隔离。发送对话、上传附件和使用语音功能时，相应内容会提交给配置的 API 服务。

设置中的历史导入导出使用 ZIP 格式。导入会在确认并校验成功后替换全部本地会话和附件；导出包含会话与本地可用的图片原件，不包含 API Key、设置或非图片附件原件。格式与保留范围见[历史导入导出](src/services/chat/history/README.md)。

设置 → 数据管理 → 删除所有对话，会在确认后清空全部本地会话、附件原件和未发送的草稿，停止正在生成的回复并回到新对话。API Key 和其他设置保留，已上传到 API 服务的文件不受影响。

## 开发

| 命令                | 用途                    |
| ------------------- | ----------------------- |
| `pnpm dev`          | 启动开发服务器          |
| `pnpm build`        | 构建到 `dist/`          |
| `pnpm type`         | TypeScript 类型检查     |
| `pnpm lint`         | oxlint 检查             |
| `pnpm format`       | oxfmt 格式化            |
| `pnpm android`      | 构建 release APK        |
| `pnpm android:debug`| 构建 debug APK          |

```text
src/
  app/                 应用布局、主题与全局样式
  components/          聊天、设置、Markdown 等界面组件
  i18n/                中英文文案
  services/
    api/               DeepSeek 请求、SSE 与协议类型
    providers/         平台类型、预设、模型获取、OpenAI/Anthropic 适配
    chat/              会话、消息分支、本地存储与历史导入导出
    markdown/          Markdown 解析、代码高亮与图表
    speech/            录音与朗读
  utils/               通用工具
android/
  app/                 安卓应用模块（WebView 外壳、资源、清单）
  gradle/              Gradle wrapper
scripts/               跨平台网页与安卓构建脚本
```

## 限制与安全提示

- API Key 以明文保存在本机。请在可信设备上使用，不要分享导出的浏览器配置。
- 非 DeepSeek 平台不提供服务端联网搜索、语音和继续生成；附件仅支持图片，历史中的文档附件在构造请求时会被跳过。
- 部分平台完全拒绝浏览器来源的请求。安卓 WebView 已绕过 CORS；桌面网页版仍可能需要支持 CORS 的网关或本地代理。
- 这是演示项目，不是 DeepSeek 官方产品。平台名称和模型 ID 均由用户配置。

## 许可证

[MIT](LICENSE)。构建会将许可证复制到 `dist/LICENSE`，分发时请一并保留；第三方依赖遵循各自的许可证。
