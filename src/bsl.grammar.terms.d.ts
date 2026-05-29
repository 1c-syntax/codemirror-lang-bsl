// Type declarations for the term-constants module produced from bsl.grammar
// at build time by @lezer/generator/rollup. The plugin emits two virtual
// modules from a single `.grammar` file: the parser module (`./bsl.grammar`)
// and the term ID module (`./bsl.grammar.terms`). This file gives tsc
// visibility into the latter so external specializer code in ./tokens.ts
// type-checks.

export const Procedure: number
export const Function: number
export const EndProcedure: number
export const EndFunction: number
export const Export: number
export const Val: number
export const Var: number
export const If: number
export const Then: number
export const Elsif: number
export const Else: number
export const EndIf: number
export const While: number
export const Do: number
export const EndDo: number
export const For: number
export const To: number
export const Each: number
export const In: number
export const Try: number
export const Except: number
export const EndTry: number
export const Return: number
export const Continue: number
export const Break: number
export const Raise: number
export const Execute: number
export const Goto: number
export const New: number
export const AddHandler: number
export const RemoveHandler: number
export const Async: number
export const Await: number
export const And: number
export const Or: number
export const Not: number
export const True: number
export const False: number
export const Undefined: number
export const Null: number

export const PreprocRegion: number
export const PreprocEndRegion: number
export const PreprocUse: number
export const PreprocNative: number
export const PreprocDelete: number
export const PreprocEndDelete: number
export const PreprocInsert: number
export const PreprocEndInsert: number
