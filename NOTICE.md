# 项目来源与致谢 / Attribution

## 上游项目 / Upstream project

本仓库是 [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo) 的二次开发版本。基础项目及其原始代码、界面与文档的版权归 DeepSeek 所有，按 MIT License 授权。原始许可证保留在 [LICENSE](LICENSE)（Copyright (c) 2026 DeepSeek），分发本仓库时请一并保留。

This repository is a derivative work based on [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo). The original project, its code, UI, and documentation are copyright DeepSeek and licensed under the MIT License. The original license is kept in [LICENSE](LICENSE) and must be retained when redistributing this repository.

## 本仓库的二次开发 / Customization in this repository

本仓库在上游项目基础上新增或修改了以下内容：

- 多平台 API 与模型管理：DeepSeek、OpenAI 兼容、Anthropic 兼容
- 平台预设、模型发现（`GET /models`）与模型切换
- 按平台能力降级、非 DeepSeek 平台的图片内联与文本上下文转换
- 安卓 WebView 应用外壳、构建脚本、图标与安装包
- 相关界面、文档、发布整理

上述二次开发、集成、打包与发布由 **bsh** 完成并维护。除上游代码与第三方依赖外，本仓库新增/修改部分的版权归 bsh 所有，并同样以 MIT License 发布。

维护者 / Maintainer: **bsh**

The customization above (multi-provider API/model management, provider presets, model discovery and switching, capability-aware fallbacks, image inlining and request conversion for non-DeepSeek providers, the Android WebView shell, build tooling, icons, documentation, and release packaging) was developed and is maintained by **bsh**. Except for upstream code and third-party dependencies, the new and modified portions of this repository are copyright bsh and released under the MIT License as well.

## 开发说明 / Development note

本仓库由 bsh 发起、完成并维护；开发过程中使用了 AI 编程助手辅助生成部分代码和文档，所有提交与发布由 bsh 审核决定。

This repository was initiated, completed, and is maintained by bsh. An AI coding assistant was used to help generate part of the code and documentation; all commits and releases were reviewed and decided by bsh.

## 非官方声明 / Not an official project

本项目不是 DeepSeek 官方项目，不代表 DeepSeek 官方立场。DeepSeek 名称与商标归其权利人所有。

This is not an official DeepSeek project and does not represent DeepSeek. The DeepSeek name and trademarks belong to their respective owners.

## 第三方依赖 / Third-party dependencies

项目使用 React、Rspack、KaTeX、Mermaid、Prism、zustand、fflate、idb 等开源依赖，以及 Android Gradle Plugin；它们各自遵循自己的许可证，版权归各自作者所有。完整依赖见 `package.json`、`pnpm-lock.yaml` 与 `android/` 构建配置。

This project uses open-source dependencies including React, Rspack, KaTeX, Mermaid, Prism, zustand, fflate, and idb, as well as the Android Gradle Plugin. Each dependency follows its own license and remains copyright of its respective authors. See `package.json`, `pnpm-lock.yaml`, and the `android/` build configuration for the full list.

## 原创性声明 / No plagiarism

本仓库没有把上游项目、第三方代码或他人的成果声称为原创；所有引用、依赖与素材均保留其原始归属和许可证。如果发现归属或授权问题，请通过仓库 Issue 联系维护者。

This repository does not claim the upstream project, third-party code, or other people's work as original. All references, dependencies, and assets retain their original attribution and licenses. If you find an attribution or licensing problem, please contact the maintainer through the repository issues.
