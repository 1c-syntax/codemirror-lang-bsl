# codemirror-lang-bsl

[![npm](https://img.shields.io/npm/v/codemirror-lang-bsl.svg)](https://www.npmjs.com/package/codemirror-lang-bsl)
[![CI](https://github.com/1c-syntax/codemirror-lang-bsl/actions/workflows/ci.yml/badge.svg)](https://github.com/1c-syntax/codemirror-lang-bsl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[CodeMirror 6](https://codemirror.net/) language support package for
**1C:Enterprise (BSL)** and **OneScript** — Russian and English keyword syntax,
preprocessor directives, compilation annotations, multi-line string literals,
and embedded query language (SDBL) inside string literals.

The grammar is implemented in [Lezer](https://lezer.codemirror.net/), references
the [`1c-syntax/bsl-parser`](https://github.com/1c-syntax/bsl-parser) ANTLR4
grammars for structure and the
[`1c-syntax/vsc-language-1c-bsl`](https://github.com/1c-syntax/vsc-language-1c-bsl)
TextMate grammar for token style mapping.

## Install

```bash
npm install codemirror-lang-bsl
```

## Usage

```ts
import {EditorView, basicSetup} from "codemirror"
import {bsl} from "codemirror-lang-bsl"

new EditorView({
  doc: 'Процедура Привет() Экспорт\n    Сообщить("Привет, мир!");\nКонецПроцедуры',
  extensions: [basicSetup, bsl()],
  parent: document.body
})
```

## What's covered

- Module-level: variable declarations (`Перем`/`Var`), procedure/function
  declarations with `Экспорт`, default parameters and `Знач`/`Val`
- Control flow: `Если`/`ИначеЕсли`/`Иначе`/`КонецЕсли`,
  `Пока`/`КонецЦикла`, `Для … По … Цикл`/`КонецЦикла`,
  `Для Каждого … Из`/`КонецЦикла`, `Попытка`/`Исключение`/`КонецПопытки`
- Statements: `Возврат`/`Продолжить`/`Прервать`/`Перейти`, labels `~Метка:`
- Expressions: number literals, string literals (incl. multi-line with `|`),
  date literals `'YYYYMMDDHHMMSS'`, booleans `Истина`/`Ложь`,
  `Неопределено`, `Null`, `Новый`, ternary `?(…)`
- Operators: arithmetic, comparison, logical (`И`/`Или`/`Не`)
- Annotations: `&НаКлиенте`, `&НаСервере`, `&НаКлиентеНаСервереБезКонтекста`, …
- Preprocessor: `#Если`/`#ИначеЕсли`/`#Иначе`/`#КонецЕсли`,
  `#Область`/`#КонецОбласти`, `#Использовать`
- Comments: `//` (single-line)
- SDBL embedded highlighting inside string literals (best-effort detection)

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

## Roadmap

v0.1 (this release) covers the BSL surface used by the SemanticTokensProvider
in bsl-language-server. The following are explicit non-goals of v0.1 and live
on the v0.2 backlog:

- **SDBL embedded grammar inside string-query literals.** Today query strings
  are highlighted as plain strings. Will require a separate Lezer parser for
  `1c-syntax/bsl-parser → SDBL{Lexer,Parser}.g4` + `parseMixed` from
  `@lezer/common` to switch parsers inside contexts like `Запрос.Текст = "…"`.
- **BSLDescription doc-comments** (`/// @param …`, `/// @returns …`).
- **Context-sensitive preprocessor identifiers.** Today `Использовать` /
  `Область` / `Native` etc. are global keywords and would be tagged as
  preprocessor tokens even if used as ordinary identifiers (rare in real code,
  but possible).
- **Trailing semicolons** after flat statements (`Возврат`, `Прервать`, …) are
  required. ANTLR allows them to be optional; v0.1 forces them to avoid
  LR ambiguity with optional trailing expressions.
- **Async/Await statements** (`Ждать F();` as a bare statement). `Ждать`
  inside expression position is supported.

Out of scope (defer to other tools):

- IntelliSense / completion / hover — that belongs in `bsl-language-server`.
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

`examples/demo.html` wires CodeMirror 6 + `bsl()` against a small sample
module. Open it through any ESM-aware dev server (esbuild, vite, etc.); a
bare file:// open will not work because CodeMirror's module graph requires
resolution.

## License

MIT — see [LICENSE](LICENSE).
