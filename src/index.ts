/**
 * CodeMirror 6 language support for **1C:Enterprise (BSL)** and **OneScript**.
 *
 * The package exports three things:
 *
 * - {@link bsl} — factory returning a {@link LanguageSupport} extension you
 *   drop straight into a CodeMirror `EditorState`.
 * - {@link bslLanguage} — the underlying {@link LRLanguage} instance, useful
 *   if you want to attach extra `LanguageSupport` extras
 *   (autocompletion data, lint sources, …) without re-creating the parser.
 * - {@link sdblLanguage} — a stand-alone {@link LRLanguage} for the **SDBL**
 *   query language. You normally don't have to touch it directly: when a BSL
 *   string literal starts with `ВЫБРАТЬ`/`SELECT`/`УНИЧТОЖИТЬ`/`DROP` the
 *   BSL parser mounts SDBL as an overlay via
 *   {@link https://lezer.codemirror.net/docs/ref/#common.parseMixed | parseMixed}.
 *   Export is provided for cases where you want to highlight a stand-alone
 *   query buffer.
 *
 * The styleTags mapping is informed by the
 * {@link https://github.com/1c-syntax/bsl-language-server | bsl-language-server}
 * `SemanticTokensProvider` tree, which encodes the canonical BSL → LSP
 * semantic-token mapping used by the official language server.
 *
 * @example
 * Basic editor:
 * ```ts
 * import {EditorView, basicSetup} from "codemirror"
 * import {bsl} from "@1c-syntax/codemirror-lang-bsl"
 *
 * new EditorView({
 *   doc: 'Процедура Тест() Сообщить("Привет"); КонецПроцедуры',
 *   extensions: [basicSetup, bsl()],
 *   parent: document.body
 * })
 * ```
 *
 * @example
 * Highlighting a stand-alone SDBL query buffer:
 * ```ts
 * import {EditorState} from "@codemirror/state"
 * import {LanguageSupport} from "@codemirror/language"
 * import {sdblLanguage} from "@1c-syntax/codemirror-lang-bsl"
 *
 * EditorState.create({
 *   doc: "ВЫБРАТЬ * ИЗ Справочник.Контрагенты",
 *   extensions: [new LanguageSupport(sdblLanguage)]
 * })
 * ```
 *
 * @packageDocumentation
 */

import {parser as bslParser} from "./bsl.grammar"
import {parser as sdblParser} from "./sdbl.grammar"
import {
  LRLanguage,
  LanguageSupport,
  indentNodeProp,
  foldNodeProp,
  foldInside,
  delimitedIndent
} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight"
import {parseMixed, type SyntaxNodeRef, type Input} from "@lezer/common"

// ---------------------------------------------------------------------------
// SDBL — configured with its own styleTags so embedded query content lights
// up with category-specific colours. Not exported as a top-level language
// because SDBL is only ever consumed nested inside BSL string literals.
// ---------------------------------------------------------------------------

/**
 * Stand-alone {@link LRLanguage} for the BSL query language (SDBL / Язык
 * запросов 1С).
 *
 * Pre-configured with category-specific `styleTags`:
 * statement keywords (`ВЫБРАТЬ`/`SELECT`, `ИЗ`/`FROM`, `ГДЕ`/`WHERE`, …) →
 * `t.controlKeyword`; aggregate / scalar functions → `t.function(t.keyword)`;
 * type-name keywords → `t.typeName`; metadata-object roots
 * (`Справочник`/`Документ`/`РегистрСведений`/…) → `t.namespace`;
 * virtual-table suffixes → `t.className`; parameter references `&Имя` →
 * `t.local(t.variableName)`.
 *
 * Used internally by {@link bslLanguage} via `parseMixed` to overlay onto
 * BSL string literals that look like queries. Exported on its own for cases
 * where you want to highlight a stand-alone SDBL buffer (e.g. a query
 * console in your app).
 *
 * Russian and English keyword variants are recognised identically; the
 * surface dialect mixes freely.
 *
 * @public
 */
export const sdblLanguage = sdblParser.configure({
  props: [
    styleTags({
      // Statement / clause keywords — same colour as BSL control flow so
      // queries look consistent with the surrounding code.
      StmtKw: t.controlKeyword,
      // Boolean operator words (И/ИЛИ/НЕ inside the query).
      OpKw: t.logicOperator,
      // Aggregate and scalar functions (СУММА, ДЛИНАСТРОКИ, ВЫРАЗИТЬ, …).
      FuncKw: t.function(t.keyword),
      // Built-in type names (Булево/Число/Строка used in CAST etc.).
      TypeKw: t.typeName,
      // Metadata-object roots (Справочник/Документ/РегистрСведений/…). The
      // bsl-language-server tags these as Namespace at the LSP level.
      MdoKw: t.namespace,
      // Virtual table suffixes (.Остатки, .СрезПоследних, .Обороты). Tagged
      // as className so themes can distinguish them from base metadata.
      VtKw: t.className,
      // Field accessors (ТочкаМаршрута, ROUTEPOINT) — propertyName tier.
      FieldKw: t.propertyName,
      // Literals.
      BoolLit: t.bool,
      "NullLit UndefinedLit": t.null,
      // Identifiers, numbers, strings inside the query.
      Identifier: t.variableName,
      Number: t.number,
      StringLit: t.string,
      // Parameter references (&ИмяПараметра) — tagged as a typed local so
      // they stand out from regular identifiers.
      "Parameter/Identifier": t.local(t.variableName),
      "Parameter/&": t.modifier,
      // Punctuation
      "( )": t.paren,
      "AddOp MulOp": t.arithmeticOperator,
      CmpOp: t.compareOperator,
      Punct: t.punctuation,
      // Comments inside the query (rare — only some servers accept inline //).
      LineComment: t.comment
    })
  ]
})

// ---------------------------------------------------------------------------
// parseMixed wrapper: detect query-shaped BSL string literals and switch to
// the SDBL parser for their *content*.
// ---------------------------------------------------------------------------

// A string is treated as a query when its first non-whitespace, non-`|`
// content matches one of these SDBL statement starters. Case-insensitive.
const QUERY_STARTERS = [
  "выбрать", "select",
  "уничтожить", "drop"
]

function looksLikeQuery(input: Input, from: number, to: number): boolean {
  // Skip the leading quote.
  let i = from + 1
  // Skip whitespace, newlines, `|` continuation markers.
  while (i < to) {
    const ch = input.read(i, i + 1)
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "|") {
      i++
      continue
    }
    break
  }
  // Read up to 16 chars and compare against the prefix table.
  const head = input.read(i, Math.min(i + 16, to - 1)).toLowerCase()
  return QUERY_STARTERS.some(kw => head.startsWith(kw))
}

/**
 * The {@link LRLanguage} for BSL (1C:Enterprise / OneScript).
 *
 * Composed of:
 *
 * - The Lezer BSL parser (case-insensitive RU+EN keywords, statements,
 *   expressions with precedence, annotations, preprocessor directives,
 *   regions, doc-comments, multi-line strings, date literals)
 * - A `parseMixed` wrap that mounts {@link sdblLanguage} as an overlay onto
 *   any BSL string literal whose first non-whitespace, non-`|` content
 *   matches `ВЫБРАТЬ`/`SELECT`/`УНИЧТОЖИТЬ`/`DROP` (case-insensitive)
 * - `indentNodeProp` for procedures/functions/control-flow bodies
 * - `foldNodeProp` for procedures, functions, regions, control-flow bodies,
 *   annotation parameter lists, and call argument lists
 * - `styleTags` mapping AST nodes to `@lezer/highlight` tags
 *   (mirroring the LSP semantic-token types used by `bsl-language-server`)
 * - `languageData` describing comment tokens, indent-on-input patterns
 *   (auto-dedent after `КонецЕсли`/`КонецЦикла`/etc.), and close-bracket
 *   pairs.
 *
 * Use this when you need to compose with extra `LanguageSupport` extras
 * (autocompletion, lint sources, …) without re-creating the parser; for
 * the common case use {@link bsl} instead.
 *
 * @public
 */
export const bslLanguage = LRLanguage.define({
  name: "bsl",
  parser: bslParser.configure({
    wrap: parseMixed((node: SyntaxNodeRef, input: Input) => {
      if (node.name !== "String") return null
      if (node.to - node.from < 6) return null
      if (!looksLikeQuery(input, node.from, node.to)) return null
      return {
        parser: sdblLanguage,
        overlay: [{from: node.from + 1, to: node.to - 1}]
      }
    }),
    props: [
      indentNodeProp.add({
        callArgs: delimitedIndent({closing: ")", align: false}),
        AnnotationParams: delimitedIndent({closing: ")", align: false}),
        ProcedureDecl: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        FunctionDecl: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        IfStatement: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        WhileStatement: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        ForStatement: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        ForEachStatement: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        TryStatement: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit
      }),
      foldNodeProp.add({
        "ProcedureDecl FunctionDecl IfStatement WhileStatement ForStatement ForEachStatement TryStatement": foldInside,
        AnnotationParams: foldInside,
        callArgs: foldInside
      }),
      styleTags({
        // ---- Definition / declaration keywords ----
        "Procedure Function EndProcedure EndFunction": t.definitionKeyword,
        "Var Export Val": t.modifier,
        "Async Await": t.modifier,
        "New": t.operatorKeyword,

        // ---- Control flow ----
        "If Then Elsif Else EndIf While Do EndDo For To Each In Try Except EndTry Return Continue Break Raise Execute Goto AddHandler RemoveHandler": t.controlKeyword,

        // ---- Logical / boolean operator words ----
        "And Or Not": t.logicOperator,

        // ---- Literals ----
        "True False": t.bool,
        "Undefined Null": t.null,
        Number: t.number,
        String: t.string,
        Date: t.literal,

        // ---- Identifiers ----
        Identifier: t.variableName,
        SubName: t.function(t.definition(t.variableName)),
        LabelName: t.labelName,
        AnnotationParamName: t.local(t.variableName),

        // ---- Annotations (compiler directives like &НаКлиенте) ----
        "Annotation/AnnotationName": t.annotation,

        // ---- Preprocessor ----
        // bsl-language-server: #Использовать and #Область → Namespace,
        // other directives (#Если/#КонецЕсли/...) → Macro,
        // region name → Variable (we already tag Identifier → variableName).
        "PreprocUse PreprocNative": t.namespace,
        "PreprocRegion PreprocEndRegion": t.namespace,
        // Preprocessor #Если/.../КонецЕсли — shared BSL keyword terms,
        // discriminated as macros only when sitting inside a preproc directive.
        "PreprocessorIf/If PreprocessorIf/Then PreprocessorElsif/Elsif PreprocessorElsif/Then PreprocessorElse/Else PreprocessorEndIf/EndIf PreprocessorIf/Not PreprocessorElsif/Not PreprocessorIf/And PreprocessorElsif/And PreprocessorIf/Or PreprocessorElsif/Or": t.macroName,
        ShebangLine: t.processingInstruction,
        "Region/RegionName": t.variableName,
        "Region EndRegion PreprocessorIf PreprocessorElsif PreprocessorElse PreprocessorEndIf PreprocUseDirective PreprocNativeDirective Shebang": t.processingInstruction,

        // ---- Punctuation and operators ----
        // Punctuation literals are tagged via their wrapping named nodes
        // (MulOp, AddOp, etc.) — the styleTags selector mini-language treats
        // a bare `*` as a wildcard, so we cannot list multiplication directly.
        "OrOp AndOp": t.logicOperator,
        CmpOp: t.compareOperator,
        AddOp: t.arithmeticOperator,
        MulOp: t.arithmeticOperator,
        UnaryOp: t.operator,
        "( )": t.paren,
        "[ ]": t.squareBracket,
        "{ }": t.brace,
        ", ;": t.separator,
        ":": t.punctuation,
        ".": t.derefOperator,
        "?": t.controlOperator,
        "& ~ #": t.punctuation,

        // ---- Comments ----
        LineComment: t.lineComment,
        DocComment: t.docComment
      })
    ]
  }),
  languageData: {
    commentTokens: {line: "//"},
    indentOnInput: /^\s*(КонецЕсли|ИначеЕсли|Иначе|КонецЦикла|КонецПопытки|Исключение|КонецПроцедуры|КонецФункции|EndIf|ElsIf|Else|EndDo|EndTry|Except|EndProcedure|EndFunction)\b/i,
    closeBrackets: {brackets: ["(", "[", '"']},
    wordChars: "_"
  }
})

/**
 * BSL language extension for CodeMirror 6.
 *
 * Returns a {@link LanguageSupport} bundling {@link bslLanguage} (with its
 * embedded SDBL overlay) ready to drop into an `EditorState`'s `extensions`
 * array. This is the canonical entry point — 99% of consumers should call
 * this and nothing else.
 *
 * Highlighting of an embedded query inside a string literal turns on
 * automatically: any string starting with `ВЫБРАТЬ`/`SELECT`/`УНИЧТОЖИТЬ`/
 * `DROP` (case-insensitive, after stripping leading `|` continuations)
 * gets parsed by the SDBL grammar and rendered with SDBL-specific
 * highlight tags. No configuration required.
 *
 * @returns A {@link LanguageSupport} instance ready to be passed to
 *          `EditorState.create({extensions: [..., bsl()]})`.
 *
 * @example
 * ```ts
 * import {EditorView, basicSetup} from "codemirror"
 * import {bsl} from "@1c-syntax/codemirror-lang-bsl"
 *
 * new EditorView({
 *   doc: 'Запрос.Текст = "ВЫБРАТЬ * ИЗ Справочник.Контрагенты";',
 *   extensions: [basicSetup, bsl()],
 *   parent: document.body
 * })
 * ```
 *
 * @public
 */
export function bsl(): LanguageSupport {
  return new LanguageSupport(bslLanguage)
}
