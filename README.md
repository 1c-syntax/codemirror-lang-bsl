# @1c-syntax/codemirror-lang-bsl

[![npm](https://img.shields.io/npm/v/@1c-syntax/codemirror-lang-bsl.svg)](https://www.npmjs.com/package/@1c-syntax/codemirror-lang-bsl)
[![CI](https://github.com/1c-syntax/codemirror-lang-bsl/actions/workflows/ci.yml/badge.svg)](https://github.com/1c-syntax/codemirror-lang-bsl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[CodeMirror 6](https://codemirror.net/) language support package for
**1C:Enterprise (BSL)** and **OneScript** — Russian and English keyword syntax,
preprocessor directives, compilation annotations, multi-line string literals,
and embedded query language (SDBL) inside string literals.

## 👉 Live demo

**<https://1c-syntax.github.io/codemirror-lang-bsl/>** — two side-by-side
CodeMirror 6 editors: one with a sample BSL module (procedure with annotation,
control flow, async function, region), another with a function whose query
string body is highlighted by the embedded SDBL grammar. Add `?theme=light` to
the URL for the light theme.

The grammar is implemented in [Lezer](https://lezer.codemirror.net/), references
the [`1c-syntax/bsl-parser`](https://github.com/1c-syntax/bsl-parser) ANTLR4
grammars for structure and the
[`1c-syntax/vsc-language-1c-bsl`](https://github.com/1c-syntax/vsc-language-1c-bsl)
TextMate grammar for token style mapping.

## Install

```bash
npm install @1c-syntax/codemirror-lang-bsl
```

## Usage

```ts
import {EditorView, basicSetup} from "codemirror"
import {bsl} from "@1c-syntax/codemirror-lang-bsl"

new EditorView({
  doc: 'Процедура Привет() Экспорт\n    Сообщить("Привет, мир!");\nКонецПроцедуры',
  extensions: [basicSetup, bsl()],
  parent: document.body
})
```

## What's covered

- Module-level: variable declarations (`Перем`/`Var`), procedure/function
  declarations with `Экспорт`, default parameters and `Знач`/`Val`, async
  modifier `АСИНХ`
- Control flow: `Если`/`ИначеЕсли`/`Иначе`/`КонецЕсли`,
  `Пока`/`КонецЦикла`, `Для … По … Цикл`/`КонецЦикла`,
  `Для Каждого … Из`/`КонецЦикла`, `Попытка`/`Исключение`/`КонецПопытки`
- Statements: `Возврат`/`Продолжить`/`Прервать`/`Перейти`, labels `~Метка:`,
  `Ждать` as both standalone statement and expression, `ВызватьИсключение`,
  `Выполнить`, `ДобавитьОбработчик`/`УдалитьОбработчик`
- Expressions: number literals, string literals (single-line and multi-line
  with `|` continuation), date literals `'YYYYMMDDHHMMSS'`,
  booleans `Истина`/`Ложь`, `Неопределено`, `Null`, `Новый`, ternary `?(…)`
- Operators: arithmetic, comparison, logical (`И`/`Или`/`Не`)
- Annotations: `&НаКлиенте`, `&НаСервере`, `&НаКлиентеНаСервереБезКонтекста`, …
  including annotation parameters
- Preprocessor: `#Если`/`#ИначеЕсли`/`#Иначе`/`#КонецЕсли`,
  `#Область`/`#КонецОбласти`, `#Использовать`, `#native`
- Comments: `//` (single-line), `///` (BSLDescription doc-comments)
- **SDBL** (BSL query language) **embedded inside query string literals** —
  a separate Lezer grammar covering 100+ keywords (statement / operator /
  function / type / metadata-object / virtual-table categories) is mounted
  as an overlay onto any string literal that starts with `ВЫБРАТЬ`/`SELECT`/
  `УНИЧТОЖИТЬ`/`DROP`. Russian and English keyword variants are both
  recognised and styled identically.

## Upstream references

The grammar and style mapping are derived from the following 1c-syntax
projects. When updating this package, diff against the recorded commit to
catch grammar changes upstream.

| Project | Used for | Pinned commit | Tag |
|---------|----------|---------------|-----|
| [`1c-syntax/bsl-parser`](https://github.com/1c-syntax/bsl-parser) | Lexer/parser structure (BSL + SDBL ANTLR4 grammars) | `a30f8169885836226208041fbc41001bd64d710e` | `v0.34.1` |
| [`1c-syntax/vsc-language-1c-bsl`](https://github.com/1c-syntax/vsc-language-1c-bsl) | TextMate scope reference (`1c.tmLanguage.json`, `1c-query.tmLanguage.json`) | `30e6c7994a2ee745c92fa0238fa2e81c78d4781d` | `v1.33.1` |
| [`1c-syntax/bsl-language-server`](https://github.com/1c-syntax/bsl-language-server) | Semantic-token → LSP token type mapping (`SemanticTokensProvider`, `*SemanticTokensSupplier`) — pinned against the active `develop` branch, not the latest release | `be49fcbf45d082a1db15504b51a551f6a55183c0` (`develop`) | latest release at the time: `v0.29.0` |

To re-sync after an upstream change: bump the relevant pinned commit in the
table above, replay the upstream diff against `src/bsl.grammar` and
`src/index.ts` (styleTags), and add regression tests in `test/cases.txt`.

## Limitations

A handful of intentional simplifications, mostly to keep the LR grammar
free of ambiguity:

- **Trailing semicolons** after *flat* statements (`Возврат`, `Прервать`,
  assignment, call) are required. ANTLR allows them to be optional; we force
  them because the optional form clashes with valid statement starters like
  `Ждать` or identifiers as the next statement. Block statements (`Если`,
  `Пока`, `Для`, `Попытка`) still accept an optional trailing `;`.
- **Context-sensitive preprocessor identifiers.** `#Если`/`#Иначе`/
  `#КонецЕсли`/`#Тогда`/`#И`/`#Или`/`#Не` reuse the corresponding BSL keyword
  terms — styleTags discriminates them via parent selectors. The remaining
  preprocessor-only words (`Область`, `КонецОбласти`, `Использовать`,
  `native`) are specialized globally; if you use one as an ordinary
  identifier outside `#` context, it will be tagged as a preprocessor
  token. BSL convention does not collide with these names in practice.
- **Comma-skipping in call arguments** (`Метод(a,,b)`) is not supported. All
  arguments must be non-empty expressions.

Out of scope (defer to other tools):

- IntelliSense / completion / hover — that belongs in
  [`bsl-language-server`](https://github.com/1c-syntax/bsl-language-server).
- Refactorings, diagnostics — same.

## Build & test

```bash
npm install
npm run build   # runs lezer-generator + rollup + tsc
npm test        # mocha against test/cases.txt fixtures
```

The repo ships a public-npm `.npmrc` so contributors on networks that default
to a private mirror (e.g. corporate Artifactory) still resolve packages from
`https://registry.npmjs.org/`. Publishing requires a separate `npm login`
against the public registry.

## Demo

The hosted version at <https://1c-syntax.github.io/codemirror-lang-bsl/> is
deployed automatically by `.github/workflows/pages.yml` on every push to
`main`. To build the demo locally:

```bash
npm install
npm run build       # main library, dist/
npm run build:demo  # static demo, docs/
# serve docs/ via any HTTP server, e.g.
python3 -m http.server -d docs 8080
```

`examples/demo.ts` is the source; `examples/index.html` is the HTML shell that
the rollup config copies into `docs/index.html` alongside the bundled
`bundle.js`.

## Publishing a release

Releases are cut by publishing a GitHub Release with a tag of the form
`v<version>` (matching `package.json#version`). The
`.github/workflows/publish.yml` workflow then builds, tests, and runs
`npm publish --provenance --access public` against npmjs.org.

### First-time setup (NPM_TOKEN)

npm does not allow configuring Trusted Publishers for a package that does
not exist yet, so the first release must be authenticated with an
[Automation token](https://docs.npmjs.com/about-access-tokens):

1. Generate an **Automation** access token at
   <https://www.npmjs.com/settings/USERNAME/tokens> (a user-scope token works;
   org-scope is fine too if the package lives under an npm org).
2. Add it as a repository secret named `NPM_TOKEN` at
   <https://github.com/1c-syntax/codemirror-lang-bsl/settings/secrets/actions>.
3. Bump `package.json#version`, commit, push, then create a Release at
   <https://github.com/1c-syntax/codemirror-lang-bsl/releases/new> with tag
   `v<version>`. The workflow picks up the release-published event and
   publishes the tarball.

The `workflow_dispatch` trigger has a `dry_run` input that runs
`npm publish --dry-run` against the same workflow — useful for verifying
the tarball contents and packaged size before cutting a real release.

### After the first release (Trusted Publishing)

Once `@1c-syntax/codemirror-lang-bsl` exists on npmjs.org, switch to
[Trusted Publishing](https://docs.npmjs.com/trusted-publishers) to drop the
NPM_TOKEN secret:

1. <https://www.npmjs.com/package/@1c-syntax/codemirror-lang-bsl/access> →
   *Trusted Publishers* → *Add*
2. Provider: GitHub Actions; Repository: `1c-syntax/codemirror-lang-bsl`;
   Workflow file: `.github/workflows/publish.yml`; Environment: `npm`.
3. Remove the `NPM_TOKEN` secret from the repo (the `NODE_AUTH_TOKEN`
   env var still gets populated, just from npm's OIDC exchange).

## License

MIT — see [LICENSE](LICENSE).
