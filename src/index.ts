// CodeMirror 6 language support for 1C:Enterprise / OneScript (BSL).
//
// Exports:
//   - bslLanguage: LRLanguage configured with the Lezer BSL parser, mixed
//     parsing for SDBL inside query string literals, fold/indent properties,
//     and a styleTags table mapping AST nodes to @lezer/highlight tags.
//   - bsl(): LanguageSupport factory — drop into CodeMirror `extensions`.
//
// The styleTags mapping is informed by the SemanticTokensProvider tree in
// https://github.com/1c-syntax/bsl-language-server which encodes the canonical
// BSL → LSP semantic-token mapping used by the official language server.

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

// Exported so consumers (and tests) can run SDBL directly when needed,
// independent of the BSL host parser.
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

// Compose wrap (parseMixed) and props in a single configure call. Two
// separate configures would clobber `wrap`: parser.configure replaces, not
// merges, configuration fields.

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
 * CodeMirror 6 language support for BSL (1C:Enterprise / OneScript) with
 * embedded SDBL highlighting inside query string literals.
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
 */
export function bsl(): LanguageSupport {
  return new LanguageSupport(bslLanguage)
}
