// External token specializer for case-insensitive SDBL keyword resolution.
//
// SDBL (Язык запросов 1С) is fully case-insensitive and ships every keyword
// in parallel Russian and English forms. We tokenize identifier-shaped words
// as a generic `Identifier` in `./sdbl.grammar`, then dispatch each one
// through this function which lowercases the text and looks it up against
// the SDBL keyword vocabulary mirrored from `1c-syntax/bsl-parser →
// SDBLLexer.g4`.

import {
  StmtKw, OpKw, FuncKw, TypeKw, MdoKw, VtKw, FieldKw,
  BoolLit, NullLit, UndefinedLit
} from "./sdbl.grammar.terms"

// Statement / clause keywords: SELECT, FROM, WHERE, GROUP BY, ORDER BY, etc.
// Multi-word constructs (e.g. "GROUP BY") are tagged at the individual-word
// level — the surface still reads correctly because adjacent StmtKw tokens
// share the same style tag.
const STMT_WORDS = [
  "select", "выбрать",
  "from", "из",
  "where", "где",
  "having", "имеющие",
  "into", "поместить",
  "group", "сгруппировать",
  "order", "упорядочить",
  "by", "по",          // BY is also "ON" in JOIN clauses; same colour either way
  "on",
  "of",
  "asc", "возр",
  "desc", "убыв",
  "union", "объединить",
  "all", "все",
  "for", "для",
  "update", "изменения",
  "join", "соединение",
  "inner", "внутреннее",
  "left", "левое",      // also a substring fn; classified as statement keyword for join
  "right", "правое",
  "full", "полное",
  "outer", "внешнее",
  "totals", "итоги",
  "overall", "общие",
  "periods", "периодами",
  "hierarchy", "иерархия",
  "hierarchii", "иерархии",
  "only", "только",
  "in", "в",
  "as", "как",
  "top", "первые",
  "distinct", "различные",
  "allowed", "разрешенные",
  "index", "индексировать",
  "sets", "наборам",
  "grouping", "группирующим",
  "groupedby", "сгруппированопо",
  "autoorder", "автоупорядочивание",
  "unique", "уникально",
  "drop", "уничтожить",
  "add", "добавить",
  "case", "выбор",
  "when", "когда",
  "then", "тогда",
  "else", "иначе",
  "end", "конец",
  "between", "между",
  "like", "подобно",
  "escape", "спецсимвол",
  "is", "есть",
  "isnull", "естьnull",
  "cast", "выразить"
]

// Boolean operators: AND/OR/NOT.
const OP_WORDS = [
  "and", "и",
  "or", "или",
  "not", "не"
]

// Aggregate, scalar and date functions.
const FUNC_WORDS = [
  // aggregates
  "avg", "среднее",
  "count", "количество",
  "sum", "сумма",
  "min", "минимум",
  "max", "максимум",
  // math
  "acos", "asin", "atan", "cos", "sin", "tan",
  "exp", "log", "log10", "pow", "sqrt",
  "int", "цел",
  "round", "окр",
  // dates
  "beginofperiod", "началопериода",
  "endofperiod", "конецпериода",
  "date", "дата",
  "datetime", "датавремя",
  "dateadd", "добавитькдате",
  "datediff", "разностьдат",
  "day", "день",
  "dayofyear", "деньгода",
  "halfyear", "полугодие",
  "hour", "час",
  "minute", "минута",
  "month", "месяц",
  "quarter", "квартал",
  "second", "секунда",
  "tendays", "декада",
  "week", "неделя",
  "weekday", "деньнедели",
  "year", "год",
  // strings
  "left", "лев",
  "right", "прав",
  "lower", "нрег",
  "upper", "врег",
  "trimall", "сокрлп",
  "triml", "сокрл",
  "trimr", "сокрп",
  "stringlength", "длинастроки",
  "substring", "подстрока",
  "strfind", "стрнайти",
  "strreplace", "стрзаменить",
  // misc
  "emptytable", "пустаятаблица",
  "emptyref", "пустаяссылка",
  "presentation", "представление",
  "refpresentation", "представлениессылки",
  "recordautonumber", "автономерзаписи",
  "storeddatasize", "размерхранимыхданных",
  "refs", "ссылка",
  "type", "тип",
  "valuetype", "типзначения",
  "value", "значение",
  "uuid", "уникальныйидентификатор"
]

// Built-in data types: BOOLEAN, NUMBER, STRING, DATE.
const TYPE_WORDS = [
  "boolean", "булево",
  "number", "число",
  "string", "строка"
  // "date" intentionally NOT here — already classified as a date *function*
]

// Metadata object types: CATALOG, DOCUMENT, ENUM, REGISTER variants, etc.
const MDO_WORDS = [
  "catalog", "справочник",
  "document", "документ",
  "documentjournal", "журналдокументов",
  "enum", "перечисление",
  "exchangeplan", "планобмена",
  "filtercriterion", "критерийотбора",
  "businessprocess", "бизнеспроцесс",
  "task", "задача",
  "constant", "константа",
  "informationregister", "регистрсведений",
  "accumulationregister", "регистрнакопления",
  "accountingregister", "регистрбухгалтерии",
  "calculationregister", "регистррасчета",
  "chartofaccounts", "плансчетов",
  "chartofcalculationtypes", "планвидоврасчета",
  "chartofcharacteristictypes", "планвидовхарактеристик",
  "sequence", "последовательность",
  "externaldatasource", "внешнийисточникданных"
]

// Virtual table suffixes that appear after the metadata-object name:
// e.g. `РегистрНакопления.Товары.Остатки`, `РегистрСведений.Курсы.СрезПоследних`.
const VT_WORDS = [
  "balance", "остатки",
  "balanceandturnovers", "остаткииобороты",
  "boundaries", "границы",
  "drcrturnovers", "оборотыдткт",
  "extdimensions", "субконто",
  "recordswithextdimensions", "движенияссубконто",
  "scheduledata", "данныеграфика",
  "slicefirst", "срезпервых",
  "slicelast", "срезпоследних",
  "taskbyperformer", "задачипоисполнителю",
  "turnovers", "обороты",
  "actualactionperiod", "фактическийпериоддействия",
  "table", "таблица",
  "cube", "куб",
  "dimensiontable", "таблицаизмерения"
]

// Special field accessors (route points etc.).
const FIELD_WORDS = [
  "routepoint", "точкамаршрута", "точки"
]

const MAP: Record<string, number> = {}
for (const w of STMT_WORDS) MAP[w] = StmtKw
for (const w of OP_WORDS) MAP[w] = OpKw
for (const w of FUNC_WORDS) MAP[w] = FuncKw
for (const w of TYPE_WORDS) MAP[w] = TypeKw
for (const w of MDO_WORDS) MAP[w] = MdoKw
for (const w of VT_WORDS) MAP[w] = VtKw
for (const w of FIELD_WORDS) MAP[w] = FieldKw

// Literals
MAP["true"] = BoolLit; MAP["истина"] = BoolLit
MAP["false"] = BoolLit; MAP["ложь"] = BoolLit
MAP["null"] = NullLit
MAP["undefined"] = UndefinedLit; MAP["неопределено"] = UndefinedLit

// Specializer invoked by the SDBL parser for every identifier-shaped token.
// Returns the term ID of the keyword variant, or -1 to leave the token as a
// plain Identifier.
export function sdblKeyword(name: string): number {
  const lower = name.toLowerCase()
  return lower in MAP ? MAP[lower] : -1
}
