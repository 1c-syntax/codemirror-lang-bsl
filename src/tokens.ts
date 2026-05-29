// External token specializer for case-insensitive BSL keyword resolution.
//
// Lezer's @tokens block cannot match keywords case-insensitively. BSL is fully
// case-insensitive and ships keywords in parallel Russian and English forms.
// We therefore tokenize all identifier-shaped words as a generic `Identifier`
// in the grammar, then re-dispatch each one through this specializer, which
// lowercases the text and looks it up in a static keyword table.

import {
  Procedure, Function, EndProcedure, EndFunction,
  Export, Val, Var,
  If, Then, Elsif, Else, EndIf,
  While, Do, EndDo,
  For, To, Each, In,
  Try, Except, EndTry,
  Return, Continue, Break, Raise, Execute, Goto,
  New, AddHandler, RemoveHandler,
  Async, Await,
  And, Or, Not,
  True, False, Undefined, Null,
  PreprocRegion, PreprocEndRegion, PreprocUse, PreprocNative,
  PreprocDelete, PreprocEndDelete, PreprocInsert, PreprocEndInsert
} from "./bsl.grammar.terms"

// Map of lowercased keyword text → Lezer term ID. Both Russian and English
// spellings point at the same term, so the surface dialect mixes freely in a
// single source file (a real-world quirk of BSL).
const KEYWORDS: Record<string, number> = {
  // Subroutines
  "процедура": Procedure, "procedure": Procedure,
  "функция": Function, "function": Function,
  "конецпроцедуры": EndProcedure, "endprocedure": EndProcedure,
  "конецфункции": EndFunction, "endfunction": EndFunction,
  "экспорт": Export, "export": Export,
  "знач": Val, "val": Val,
  "перем": Var, "var": Var,

  // Control flow
  "если": If, "if": If,
  "тогда": Then, "then": Then,
  "иначеесли": Elsif, "elsif": Elsif,
  "иначе": Else, "else": Else,
  "конецесли": EndIf, "endif": EndIf,
  "пока": While, "while": While,
  "цикл": Do, "do": Do,
  "конеццикла": EndDo, "enddo": EndDo,
  "для": For, "for": For,
  "по": To, "to": To,
  "каждого": Each, "each": Each,
  "из": In, "in": In,
  "попытка": Try, "try": Try,
  "исключение": Except, "except": Except,
  "конецпопытки": EndTry, "endtry": EndTry,
  "возврат": Return, "return": Return,
  "продолжить": Continue, "continue": Continue,
  "прервать": Break, "break": Break,
  "вызватьисключение": Raise, "raise": Raise,
  "выполнить": Execute, "execute": Execute,
  "перейти": Goto, "goto": Goto,
  "новый": New, "new": New,
  "добавитьобработчик": AddHandler, "addhandler": AddHandler,
  "удалитьобработчик": RemoveHandler, "removehandler": RemoveHandler,
  "асинх": Async, "async": Async,
  "ждать": Await, "await": Await,

  // Operators
  "и": And, "and": And,
  "или": Or, "or": Or,
  "не": Not, "not": Not,

  // Literals
  "истина": True, "true": True,
  "ложь": False, "false": False,
  "неопределено": Undefined, "undefined": Undefined,
  "null": Null
}

// Preprocessor-only directive vocabulary — only words that don't shadow a BSL
// keyword. The other preproc surface forms (`Если`, `Иначе`, `КонецЕсли`,
// `Тогда`, `И`, `Или`, `Не`) are intentionally absent here because they share
// a term with the BSL control-flow keyword; the parser handles them via
// preprocessor productions, and styleTags routes them via parent selectors
// like `"PreprocessorIf/If"`.
const PREPROC_KEYWORDS: Record<string, number> = {
  "область": PreprocRegion, "region": PreprocRegion,
  "конецобласти": PreprocEndRegion, "endregion": PreprocEndRegion,
  "использовать": PreprocUse, "use": PreprocUse,
  "native": PreprocNative,
  // Configuration-extension directives
  "удаление": PreprocDelete, "delete": PreprocDelete,
  "конецудаления": PreprocEndDelete, "enddelete": PreprocEndDelete,
  "вставка": PreprocInsert, "insert": PreprocInsert,
  "конецвставки": PreprocEndInsert, "endinsert": PreprocEndInsert
}

// Specializer invoked by Lezer for every Identifier token. Returns a term ID
// (the keyword token to substitute) or -1 to leave the token as a plain
// Identifier. Lookups are O(1).
export function keyword(name: string): number {
  const lower = name.toLowerCase()
  if (lower in KEYWORDS) return KEYWORDS[lower]
  if (lower in PREPROC_KEYWORDS) return PREPROC_KEYWORDS[lower]
  return -1
}
