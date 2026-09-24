import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // serwist 构建生成的 Service Worker 产物（压缩文件）
    "public/sw.js",
    // 本地验证/运维工具脚本（Node 环境 mjs，非应用代码）
    "scripts/**",
  ]),
  {
    rules: {
      // 未使用参数以下划线开头表示有意忽略（如路由 handler 的 _req/_ctx）
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // 以下两条为 react-hooks v6 新增的严格规则，与本项目既有架构有意冲突，降为 warn：
      // 1. set-state-in-effect：项目采用「进页面拉取」模式（AGENTS.md），effect 中同步进入
      //    loading 态驱动骨架屏；InstallGuide 的环境检测因 prerender 限制必须在 effect 中
      //    同步 setState（navigator/localStorage 渲染期不存在）。
      // 2. refs：手势组件（PullToRefresh/ImagePreview）在渲染期读 ref 判断拖拽中，
      //    避免 touchmove 每帧 setState 重渲，属有意的性能取舍。
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);

export default eslintConfig;
