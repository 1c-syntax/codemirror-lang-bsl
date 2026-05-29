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
import {mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync} from "node:fs"

mkdirSync("docs", {recursive: true})

// Pages serves with cache-control: max-age=600, which means browsers and the
// edge CDN keep serving the same `bundle.js` for ten minutes after a deploy.
// Naming the entry with a content-hash sidesteps the cache entirely: the
// HTML always points at the freshly-named asset, so consumers download the
// new bytes on the first navigation after a deploy.

export default {
  input: "examples/demo.ts",
  output: {
    dir: "docs",
    entryFileNames: "bundle-[hash].js",
    format: "iife",
    inlineDynamicImports: true,
    sourcemap: false
  },
  plugins: [
    lezer(),
    resolve({browser: true}),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.demo.json",
      // Without this the plugin downgrades type errors to warnings and still
      // emits — that's how the previous `astUpdateField is not defined` bug
      // reached production. `noEmitOnError` makes the build fail loudly.
      noEmitOnError: true
    }),
    terser({
      format: {comments: false},
      compress: {passes: 2}
    }),
    {
      name: "html-with-hashed-bundle",
      // Runs after Rollup decides on chunk names; we pick up the actual
      // emitted filename and inject it into the HTML shell.
      writeBundle(_, bundle) {
        const entry = Object.values(bundle).find(c => c.type === "chunk" && c.isEntry)
        if (!entry) throw new Error("rollup-plugin html-with-hashed-bundle: no entry chunk")
        const html = readFileSync("examples/index.html", "utf8")
          .replace(/\.\/bundle(?:-[^"]+)?\.js/, `./${entry.fileName}`)
        writeFileSync("docs/index.html", html)
        // Clean up stale bundle-*.js files from previous builds so we don't
        // pile them up across rebuilds.
        for (const f of readdirSync("docs")) {
          if (/^bundle-.*\.js$/.test(f) && f !== entry.fileName) {
            rmSync(`docs/${f}`)
          }
        }
      }
    }
  ]
}
