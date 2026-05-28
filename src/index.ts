// CodeMirror 6 language support for 1C:Enterprise / OneScript (BSL).
//
// Exports:
//   - bslLanguage: LRLanguage configured with the Lezer parser, fold/indent
//     properties, and a styleTags table that maps AST nodes to
//     @lezer/highlight tags.
//   - bsl(): LanguageSupport factory — drop into CodeMirror `extensions`.
//
// The styleTags mapping is informed by the SemanticTokensProvider tree in
// https://github.com/1c-syntax/bsl-language-server which encodes the canonical
// BSL → LSP semantic-token mapping used by the official language server.

import {parser} from "./bsl.grammar"
import {
  LRLanguage,
  LanguageSupport,
  indentNodeProp,
  foldNodeProp,
  foldInside,
  delimitedIndent
} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight"

export const bslLanguage = LRLanguage.define({
  name: "bsl",
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        // Inside-call and inside-list — delimited by parentheses, no extra
        // alignment so closing paren goes back to column 0 of the opening line.
        callArgs: delimitedIndent({closing: ")", align: false}),
        AnnotationParams: delimitedIndent({closing: ")", align: false}),
        // Body of a procedure / function — indent one unit inside.
        ProcedureDecl: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        FunctionDecl: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        IfStatement: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        WhileStatement: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        ForStatement: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        ForEachStatement: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit,
        TryStatement: ctx => ctx.lineIndent(ctx.node.from) + ctx.unit
      }),
      foldNodeProp.add({
        // Fold the inside of compound blocks. The header line (Процедура …,
        // Если … Тогда, etc.) stays visible; the body collapses.
        "ProcedureDecl FunctionDecl IfStatement WhileStatement ForStatement ForEachStatement TryStatement": foldInside,
        AnnotationParams: foldInside,
        callArgs: foldInside
      }),
      styleTags({
        // ---- Definition / declaration keywords ----
        // bsl-language-server marks procedure/function/var keywords as part of
        // a Keyword token; we use the dedicated Lezer "definition keyword" tag
        // so themes can colour declarations distinctly from control flow.
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
        // Default to variableName; refine where the AST gives us context.
        Identifier: t.variableName,
        "SubName": t.function(t.definition(t.variableName)),
        "LabelName": t.labelName,
        "AnnotationParamName": t.local(t.variableName),

        // ---- Annotations (compiler directives like &НаКлиенте) ----
        // bsl-language-server maps these to Decorator. The annotation name and
        // the parameter names are tagged separately so themes can colour them.
        "Annotation/AnnotationName": t.annotation,

        // ---- Preprocessor ----
        // bsl-language-server: #Использовать and #Область → Namespace,
        // other directives (#Если/#КонецЕсли/...) → Macro,
        // region name → Variable (we already tag Identifier → variableName).
        "PreprocUse PreprocNative": t.namespace,
        "PreprocRegion PreprocEndRegion": t.namespace,
        "PreprocIf PreprocElsif PreprocElse PreprocEndIf PreprocThen PreprocNot PreprocOr PreprocAnd": t.macroName,
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
        LineComment: t.lineComment
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
 * CodeMirror 6 language support for BSL (1C:Enterprise / OneScript).
 *
 * @example
 * ```ts
 * import {EditorView, basicSetup} from "codemirror"
 * import {bsl} from "codemirror-lang-bsl"
 *
 * new EditorView({
 *   doc: 'Процедура Тест() Сообщить("Привет"); КонецПроцедуры',
 *   extensions: [basicSetup, bsl()],
 *   parent: document.body
 * })
 * ```
 */
export function bsl(): LanguageSupport {
  return new LanguageSupport(bslLanguage)
}
