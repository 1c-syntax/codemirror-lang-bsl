// Bundle the live demo (examples/demo.ts) for static hosting on GitHub Pages.
//
// Unlike the main library build, this bundle inlines every CodeMirror
// dependency into a single browser-loadable IIFE so the resulting `docs/`
// folder is fully self-contained. Copies the HTML shell from
// `examples/index.html` into `docs/index.html` so the workflow can upload
// `docs/` as the Pages artifact unchanged.

import typescript from "@rollup/plugin-typescript"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import terser from "@rollup/plugin-terser"
import {lezer} from "@lezer/generator/rollup"
import {copyFileSync, mkdirSync} from "node:fs"

mkdirSync("docs", {recursive: true})

export default {
  input: "examples/demo.ts",
  output: {
    file: "docs/bundle.js",
    format: "iife",
    inlineDynamicImports: true,
    sourcemap: false
  },
  plugins: [
    lezer(),
    resolve({browser: true}),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.demo.json"
    }),
    terser({
      format: {comments: false},
      compress: {passes: 2}
    }),
    {
      name: "copy-html-shell",
      writeBundle() {
        copyFileSync("examples/index.html", "docs/index.html")
      }
    }
  ]
}
