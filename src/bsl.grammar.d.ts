// Type declarations for the parser module produced from bsl.grammar at build
// time by @lezer/generator/rollup. The plugin emits two virtual modules from
// a single `.grammar` file: the parser module (this one) and the term ID
// module (`./bsl.grammar.terms`).

import {LRParser} from "@lezer/lr"

export const parser: LRParser
