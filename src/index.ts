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

// Every BSL keyword that the @external specialize hook might produce, so a
// styleTags selector can enumerate them where they appear after `.`. Kept
// here so `index.ts` doesn't drown in a 40-token-wide selector literal.
const BSL_KEYWORDS_AFTER_DOT = [
  "Procedure", "Function", "EndProcedure", "EndFunction",
  "Export", "Val", "Var",
  "If", "Then", "Elsif", "Else", "EndIf",
  "While", "Do", "EndDo",
  "For", "To", "Each", "In",
  "Try", "Except", "EndTry",
  "Return", "Continue", "Break", "Raise", "Execute", "Goto",
  "New", "AddHandler", "RemoveHandler",
  "Async", "Await",
  "And", "Or", "Not",
  "True", "False", "Undefined", "Null"
]
const DOT_KEYWORD_SELECTORS = ["PropertyAccess", "CallAccess"]
  .flatMap(parent => BSL_KEYWORDS_AFTER_DOT.map(k => `${parent}/${k}`))
  .join(" ")
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
      // Metadata-object roots (Справочник/Документ/РегистрСведений/…).
      // bsl-language-server tags them as Namespace at the LSP level.
      MdoKw: t.namespace,
      // Identifier components inside an MdoRef path become Class — the
      // table name (`Контрагенты` in `Справочник.Контрагенты`) and the
      // optional virtual-table suffix (`Остатки` in
      // `РегистрНакопления.ТоварыНаСкладах.Остатки`) both qualify. Outside
      // of MdoRef the same words stay as plain variableName so query
      // aliases like `КАК Остатки` don't get the metadata-class colour.
      "MdoRef/Identifier": t.className,
      // Field accessors (ТочкаМаршрута, ROUTEPOINT) — propertyName tier.
      FieldKw: t.propertyName,
      // Literals.
      BoolLit: t.bool,
      "NullLit UndefinedLit": t.null,
      // Identifiers, numbers, strings inside the query.
      Identifier: t.variableName,
      Number: t.number,
      StringLit: t.string,
      // Parameter references (&ИмяПараметра) — the `sdblName` rule is
      // inlined (lowercase), so its children sit directly under Parameter
      // in the tree. Both the `&` and every possible inner-leaf token
      // (Identifier *or* a category-keyword term that the specializer
      // produced for the name) get the same `t.special(t.variableName)`
      // tag so the parameter renders as one visual block. We enumerate the
      // keyword categories because @lezer/highlight resolves at the leaf
      // level and the global FuncKw / StmtKw / etc. tags would otherwise win.
      "Parameter/Ampersand Parameter/Identifier Parameter/StmtKw Parameter/OpKw Parameter/FuncKw Parameter/TypeKw Parameter/MdoKw Parameter/FieldKw Parameter/BoolLit Parameter/NullLit Parameter/UndefinedLit": t.special(t.variableName),
      // Punctuation
      "LParen RParen": t.paren,
      // `{...}` configuration blocks — tag the whole group as t.meta so a
      // theme can fade them; the braces themselves get the brace tag.
      "LBrace RBrace": t.brace,
      BraceGroup: t.meta,
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

        // After `.` a BSL keyword may be used as a method/property name
        // (`Запрос.Выполнить()`, `Объект.Значение`, …). Re-tag every keyword
        // term to propertyName when it sits inside an access node, overriding
        // the default control-keyword/definitionKeyword/etc. colouring those
        // terms get elsewhere. The `dotKeyword` rule is lowercase (inlined),
        // so its children sit directly under PropertyAccess/CallAccess and
        // each leaf keyword has to be enumerated explicitly — see
        // DOT_KEYWORD_SELECTORS at the top of this file.
        [DOT_KEYWORD_SELECTORS]: t.propertyName,

        // ---- Annotations (compiler directives like &НаКлиенте) ----
        // Every leaf token of an annotation gets `t.annotation` so the whole
        // `&Имя` reads as one visual unit. AnnotationName/Identifier is
        // needed because @lezer/highlight resolves at the leaf level —
        // `AnnotationName: t.annotation` alone would lose against the global
        // `Identifier: t.variableName`.
        "Annotation/AnnotationName AnnotationName/Identifier Annotation/Ampersand": t.annotation,

        // ---- Preprocessor ----
        // Per bsl-language-server PreprocessorSemanticTokensSupplier:
        //   • #Использовать and #Область/#КонецОбласти → Namespace
        //   • #Если/#ИначеЕсли/#Иначе/#КонецЕсли, #native,
        //     #Удаление/#Вставка → Macro
        //   • Region name → Variable (kept as variableName from the global
        //     Identifier rule)
        //
        // For every directive variant we tag the parent wrapper, the `#`
        // punctuation, and the directive keyword *all* with the same tag so
        // each directive renders as a single visual block. The leaf selectors
        // (PreprocRegion etc.) are needed because @lezer/highlight resolves
        // at the leaf — parent-only tags lose against any leaf rule.

        // Namespace bucket — regions and use directive.
        "Region EndRegion PreprocUseDirective Region/Hash EndRegion/Hash PreprocUseDirective/Hash PreprocRegion PreprocEndRegion PreprocUse": t.namespace,

        // Macro bucket — conditional directives, native, configuration-
        // extension markers. The `Preprocessor*/If` etc. selectors retag
        // BSL control-flow terms that share their surface form with
        // preprocessor keywords.
        "PreprocessorIf PreprocessorElsif PreprocessorElse PreprocessorEndIf PreprocessorDelete PreprocessorEndDelete PreprocessorInsert PreprocessorEndInsert PreprocNativeDirective PreprocessorIf/Hash PreprocessorElsif/Hash PreprocessorElse/Hash PreprocessorEndIf/Hash PreprocessorDelete/Hash PreprocessorEndDelete/Hash PreprocessorInsert/Hash PreprocessorEndInsert/Hash PreprocNativeDirective/Hash PreprocessorIf/If PreprocessorIf/Then PreprocessorElsif/Elsif PreprocessorElsif/Then PreprocessorElse/Else PreprocessorEndIf/EndIf PreprocessorIf/Not PreprocessorElsif/Not PreprocessorIf/And PreprocessorElsif/And PreprocessorIf/Or PreprocessorElsif/Or PreprocDelete PreprocEndDelete PreprocInsert PreprocEndInsert PreprocNative": t.macroName,

        ShebangLine: t.processingInstruction,
        "Region/RegionName": t.variableName,

        // ---- Punctuation and operators ----
        // Every lexeme is named (Ampersand, Hash, Dot, …) so styleTags can
        // reference them by identifier — no quoted-literal syntax needed.
        // Leaf tokens get their tag directly; the *Op wrappers also get a
        // tag for downstream consumers walking the tree, but the leaves win
        // for highlighting.
        "OrOp AndOp": t.logicOperator,
        "CmpOp Assign NotEqual Less LessOrEqual Greater GreaterOrEqual": t.compareOperator,
        "AddOp Plus Minus": t.arithmeticOperator,
        "MulOp Mul Quotient Modulo": t.arithmeticOperator,
        UnaryOp: t.operator,
        "LParen RParen": t.paren,
        "LBrack RBrack": t.squareBracket,
        "Comma Semicolon": t.separator,
        Colon: t.punctuation,
        Dot: t.derefOperator,
        Question: t.controlOperator,
        // Default colour for `&`/`~`/`#` outside their usual contexts —
        // contextual selectors above (Annotation/Ampersand, *Preprocessor/Hash,
        // etc.) take precedence when the token sits inside the matching parent.
        "Ampersand Tilda Hash": t.punctuation,

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
