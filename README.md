# AI Chat Demo

**Language: English | [简体中文](README.zh-CN.md)**

**Author of this customized version: bsh**

A static chat demo that now supports **multiple API providers and models** and ships as an **Android app**. The browser or WebView talks to the configured API service directly; there is no application backend.

Originally based on [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo). The customization in this repository was developed and is maintained by **bsh**; it is not an official DeepSeek project. You can still open `dist/index.html` directly, or install `release/AI-Chat-Demo-0.2.0.apk` on an Android phone. Prebuilt web and Android artifacts live in `release/`.

## What was added

- **API & models settings**: add, edit, and delete providers; choose the active provider and model from the model picker in the chat input.
- **Three provider kinds**:
  - `DeepSeek`: the original Anthropic-compatible Messages / Files protocol with DeepSeek extensions (search, link reading, server titles, speech, thinking).
  - `OpenAI`: any OpenAI-compatible `/chat/completions` endpoint, including OpenRouter, SiliconFlow, Moonshot, Zhipu, DashScope, and self-hosted gateways.
  - `Anthropic`: native Anthropic-compatible `/v1/messages` endpoints.
- **Model discovery**: “Fetch models” calls `GET /models` on the provider and fills the model list.
- **Capability-aware UI**: features a provider cannot support are hidden instead of failing (search, speech, thinking toggle, server titles).
- **Android WebView shell**: file picker, microphone permission, external links, downloads, system back handling, safe-area-friendly layout, and an export bridge that saves ZIP history exports to Downloads.

## Supported capabilities

| Capability | DeepSeek | OpenAI-compatible | Anthropic-compatible |
| --- | --- | --- | --- |
| Streaming replies | Yes | Yes | Yes |
| Thinking / reasoning display | Yes | `reasoning_content` / `reasoning` when returned | Native thinking blocks when returned |
| Deep-thinking switch | Yes | Hidden | Hidden |
| Web search & link reading | Yes | — | — |
| Automatic server title | Yes | Local fallback from the first message | Local fallback |
| Attachments | Files API (images + documents) | Images only, inlined as data URLs | Images only, inlined as base64 |
| Voice input / read aloud | Yes | — | — |
| Continue generating | Yes | — | — |

API keys and settings stay in `localStorage`; conversations and original attachments stay in IndexedDB. Requests go directly from the app to the provider you configure.

## Getting started (web)

Requires Node.js 22.12+ and pnpm:

```sh
pnpm install
pnpm dev
```

Open http://localhost:8090. To build the static site:

```sh
pnpm build
```

Output goes to `dist/`. A prebuilt offline bundle is also published in [`release/AI-Chat-Demo-Web-0.2.0.zip`](release/AI-Chat-Demo-Web-0.2.0.zip): unzip it, then open `index.html` directly or serve the folder with any static file server. It can be served from a static host or opened as a file. When opened from `file://`, storage and cross-origin access depend on the browser and on the API service allowing that origin; the Android WebView build enables universal access explicitly.

Build the offline bundle yourself with:

```sh
pnpm release:web
```

## Configure a provider

1. Open **Settings → API & models**.
2. Choose a preset (DeepSeek, OpenAI, OpenRouter, SiliconFlow, Moonshot, Zhipu, DashScope, Anthropic) or a custom OpenAI/Anthropic-compatible entry.
3. Fill in the base URL, API key, and models. Use **Fetch models** to query `GET /models`, or type one model ID per line.
4. Save. The provider becomes active; pick a model from the model menu at the bottom-left of the chat input.

Base URL examples:

| Provider | Base URL | Kind |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com` | DeepSeek |
| OpenAI | `https://api.openai.com/v1` | OpenAI |
| OpenRouter | `https://openrouter.ai/api/v1` | OpenAI |
| SiliconFlow | `https://api.siliconflow.cn/v1` | OpenAI |
| Moonshot | `https://api.moonshot.cn/v1` | OpenAI |
| Zhipu | `https://open.bigmodel.cn/api/paas/v4` | OpenAI |
| DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI |
| Anthropic | `https://api.anthropic.com` | Anthropic |

For DeepSeek, `/anthropic/v1` is appended automatically; a base URL that already ends with it is accepted as-is. For OpenAI-compatible endpoints, only a bare origin gets `/v1` appended — include the path yourself when in doubt.

## Android app

A prebuilt APK is available at [`release/AI-Chat-Demo-0.2.0.apk`](release/AI-Chat-Demo-0.2.0.apk) (debug-signed, ~1.9 MB). Install it with:

```sh
adb install -r release/AI-Chat-Demo-0.2.0.apk
```

A debuggable build for WebView inspection (`chrome://inspect`) is at `release/AI-Chat-Demo-0.2.0-debug.apk`. Or copy the APK to the phone and allow installation from unknown sources.

### Build with Android Studio

1. Build the web assets once: `pnpm install && pnpm build`.
2. Open the `android/` directory as a project in Android Studio.
3. Use JDK 17+ and an Android SDK with platform 36 and build-tools 36.
4. Run **app** or **Build → Build APK(s)**.

`app/build.gradle.kts` syncs `../dist` into the packaged assets before every build and stops with a clear message if `dist/index.html` is missing.

### Build from the command line

```sh
pnpm android          # release variant -> release/AI-Chat-Demo-<version>.apk
pnpm android:debug    # debug variant, supports chrome://inspect
```

The Gradle wrapper is included (`Gradle 8.14.3`, `AGP 8.13.0`). The first build downloads Gradle/AGP dependencies; `local.properties` points at the local Android SDK and is gitignored. `android/gradle.properties` pins `org.gradle.java.home` to the JDK 21 installed on this machine because Android Studio's bundled JBR 25 is newer than Gradle 8.14 supports — update that path (or the Gradle JDK in Android Studio) when building on another machine.

App details:

- Package `com.chatdemo.app`, version 0.2.0, minSdk 26 (Android 8), targetSdk 34, compileSdk 36.
- The UI is packaged under `assets/` and loaded from `file:///android_asset/index.html`.
- `setAllowUniversalAccessFromFileURLs(true)` lets the web app call third-party APIs that do not send CORS headers; cleartext HTTP is allowed so self-hosted endpoints work.
- Files, microphone, links, downloads, and the back button are handled natively. History export uses `AndroidBridge.saveBase64` to write to Downloads.
- The release variant is signed with the standard Android debug keystore so it installs directly. Replace `signingConfig` in `android/app/build.gradle.kts` with your own keystore before publishing.

## Data and storage

Your API keys and settings are stored in the browser's localStorage. Specifically, provider entries (including each provider's `apiKey`) are kept under `chat-demo:providers`; the active provider and per-provider model choices are in `chat-demo:active-provider` and `chat-demo:selected-models`. Conversations, attachment originals, and their metadata are stored in IndexedDB database `chat-demo` (`sessions`, `sessionSummaries`, `files`), and unsent drafts live in page memory only. Local data is isolated by browser profile and origin, so the `file://` copy, a locally served copy, and the GitHub Pages copy use separate storage. Use Settings → Data to export or delete it. Sending messages, uploading attachments, and using speech features sends the relevant content to the configured API service; this project has no server that receives your key or chats.

History import/export in Settings uses ZIP archives. Importing replaces all local conversations and attachments after confirmation and validation. Exports include conversations and locally available original images, but exclude API keys, settings, and original non-image attachments. See the [history import/export documentation (Chinese)](src/services/chat/history/README.md).

Settings → Data → Delete all chats clears local conversations, original attachments, and unsent drafts. API keys and settings are preserved; files already uploaded to the API service are not deleted.

## Development

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Build the static site into `dist/` |
| `pnpm type` | TypeScript type checks |
| `pnpm lint` | Lint with oxlint |
| `pnpm format` | Format with oxfmt |
| `pnpm android` | Build the release APK |
| `pnpm android:debug` | Build the debug APK |
| `pnpm release:web` | Build the offline web ZIP |

```text
src/
  app/                 Application layout, themes, and global styles
  components/          Chat, settings, Markdown, and other UI components
  i18n/                English and Chinese translations
  services/
    api/               DeepSeek request/SSE plumbing and protocol types
    providers/         Provider types, presets, model discovery, OpenAI/Anthropic adapters
    chat/              Conversations, message branches, storage, history import/export
    markdown/          Markdown parsing, syntax highlighting, and diagrams
    speech/            Audio recording and read-aloud playback
  utils/               Shared utilities
android/
  app/                 Android app module (WebView shell, resources, manifest)
  gradle/              Gradle wrapper
scripts/               Cross-platform web and Android build scripts
```

## Limitations and security notes

- API keys are stored locally in plaintext. Use the app on a trusted device and do not share exported browser profiles.
- On non-DeepSeek providers, server-side web search, speech, and continuation are unavailable by design. Only images can be attached; older document attachments are skipped when building the request.
- Some providers reject browser-origin requests entirely. The Android WebView bypasses CORS, but the desktop web build may need a CORS-enabled gateway or a local proxy.
- This is a demo, not an official DeepSeek product. Provider names and model IDs are configured by the user.

## Credits and authorship

This repository is a derivative of [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo) (MIT License). The original project, its code, UI, and documentation are copyright DeepSeek; the original license is retained in [LICENSE](LICENSE). The multi-provider support, model management, Android app shell, build tooling, documentation, and release packaging in this repository were developed and are maintained by **bsh**, with assistance from **DeepSeek Harness**; all commits and releases were reviewed by bsh. This is not an official DeepSeek project. No upstream or third-party work is claimed as original here; third-party dependencies remain under their own licenses.

## License

[MIT](LICENSE). The build copies the license to `dist/LICENSE`; include it when distributing the app. Third-party dependencies are subject to their own licenses.
