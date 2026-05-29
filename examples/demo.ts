// Live demo: CodeMirror 6 editor + side-by-side AST viewer, sample picker,
// and drag-and-drop file loading.
//
// Bundled to docs/bundle.js by `npm run build:demo` and deployed to GitHub
// Pages by .github/workflows/pages.yml. The AST viewer descends into mounted
// SDBL overlays so query strings show their inner Query(StmtKw, MdoKw, …)
// structure inline with the surrounding BSL tree.

import {EditorView, basicSetup} from "codemirror"
import {EditorState, type Extension} from "@codemirror/state"
import {syntaxTree} from "@codemirror/language"
import {oneDark} from "@codemirror/theme-one-dark"
import {NodeProp, type Tree as TreeT, type TreeCursor} from "@lezer/common"
import {bsl} from "../src/index"

// ---- Samples ---------------------------------------------------------------

interface Sample {
  id: string
  label: string
  doc: string
}

const SAMPLES: Sample[] = [
  {
    id: "module",
    label: "Модуль — процедура, аннотация, ветвление, цикл, async",
    doc: `// Пример модуля 1С: процедура с аннотацией, ветвлением, циклом
&НаКлиенте
Процедура ПриОткрытии(Отказ)
    Сообщить("Привет, " + Объект.Наименование + "!");

    Если ЗначениеЗаполнено(Объект.Дата) Тогда
        Возврат;
    КонецЕсли;

    Для Каждого Строка Из Объект.Товары Цикл
        Строка.Сумма = Строка.Количество * Строка.Цена;
    КонецЦикла;

    Попытка
        Результат = ВыполнитьЗапрос();
    Исключение
        ВызватьИсключение "Ошибка запроса: " + ОписаниеОшибки();
    КонецПопытки;
КонецПроцедуры

#Область СлужебныеПроцедуры

Асинх Функция ЗагрузитьДанные() Экспорт
    Перем Кэш;
    Результат = Ждать Сервер.Получить();
    Возврат Результат;
КонецФункции

#КонецОбласти
`
  },
  {
    id: "query",
    label: "Запрос — SDBL внутри строки, JOIN, ИТОГИ, параметры",
    doc: `// Демонстрация встроенной грамматики SDBL.
// SDBL подсветка автоматически включается, когда строка
// начинается с ВЫБРАТЬ/SELECT.
Функция ПолучитьКонтрагентов() Экспорт
    Запрос = Новый Запрос;
    Запрос.Текст =
        "ВЫБРАТЬ
        |    Контрагенты.Наименование КАК Имя,
        |    Контрагенты.ИНН КАК ИНН,
        |    Остатки.КоличествоОстаток КАК Остаток
        |ИЗ
        |    Справочник.Контрагенты КАК Контрагенты
        |        ЛЕВОЕ СОЕДИНЕНИЕ РегистрНакопления.ТоварыНаСкладах.Остатки КАК Остатки
        |        ПО Остатки.Контрагент = Контрагенты.Ссылка
        |ГДЕ
        |    Контрагенты.Поставщик = ИСТИНА
        |    И Контрагенты.ДатаСоздания МЕЖДУ &НачалоПериода И &КонецПериода
        |СГРУППИРОВАТЬ ПО
        |    Контрагенты.Наименование,
        |    Контрагенты.ИНН,
        |    Остатки.КоличествоОстаток
        |УПОРЯДОЧИТЬ ПО
        |    Имя
        |ИТОГИ
        |    СУММА(Остаток)
        |ПО
        |    Имя";

    Запрос.УстановитьПараметр("НачалоПериода", '20240101');
    Запрос.УстановитьПараметр("КонецПериода", ТекущаяДата());

    Возврат Запрос.Выполнить().Выгрузить();
КонецФункции
`
  },
  {
    id: "preproc",
    label: "Препроцессор — #Если / #Область / #Использовать",
    doc: `#Использовать "vanessa-runner"

#Область ПрограммныйИнтерфейс

#Если Клиент Тогда

&НаКлиенте
Процедура ВыполнитьНаКлиенте() Экспорт
    Сообщить("работаем на клиенте");
КонецПроцедуры

#ИначеЕсли Сервер И Не ВнешнееСоединение Тогда

&НаСервере
Процедура ВыполнитьНаСервере() Экспорт
    Сообщить("работаем на сервере");
КонецПроцедуры

#Иначе

Процедура НеподдерживаемоеОкружение()
    ВызватьИсключение "Не поддерживается";
КонецПроцедуры

#КонецЕсли

#КонецОбласти
`
  },
  {
    id: "doc",
    label: "Описание метода (1С-конвенция) и метки",
    // Структура соответствует 1c-syntax/bsl-parser BSLDescriptionParser:
    // обычные // комментарии, секции "Параметры:" / "Возвращаемое значение:",
    // параметры в формате "Имя - Тип - описание", без JSDoc-тегов.
    doc: `// Запускает выполнение процедуры в фоновом задании, если это возможно.
//
// При выполнении любого из следующих условий запуск выполняется не в фоне,
// а сразу в основном потоке:
//  * если вызов выполняется в файловой базе во внешнем соединении;
//  * если приложение запущено в режиме отладки;
//  * если выполняется процедура модуля внешней обработки.
//
// Параметры:
//  ИмяПроцедуры - Строка - имя экспортной процедуры общего модуля,
//                          которую необходимо выполнить в фоне.
//                          Например, "МойОбщийМодуль.МояПроцедура".
//  Параметры    - Структура - произвольные параметры вызова процедуры.
//
// Возвращаемое значение:
//  Структура - параметры выполнения задания:
//   * Статус               - Строка - "Выполняется", "Выполнено",
//                                     "Ошибка" или "Отменено".
//   * ИдентификаторЗадания - УникальныйИдентификатор - идентификатор
//                                     запущенного фонового задания.
//
// Пример:
//  Параметры = Новый Структура("ИмяПараметра", "Значение");
//  Результат = Запустить("МойМодуль.Метод", Параметры);
//
Функция Запустить(ИмяПроцедуры, Параметры) Экспорт
    Возврат Новый Структура("Статус, ИдентификаторЗадания",
                            "Выполняется", Новый УникальныйИдентификатор);
КонецФункции

Процедура ОбходПоМеткам()
    Сч = 0;
    ~Начало:
    Сч = Сч + 1;
    Если Сч < 5 Тогда
        Перейти ~Начало;
    КонецЕсли;
КонецПроцедуры
`
  }
]

// ---- State -----------------------------------------------------------------

const params = new URLSearchParams(location.search)
let dark = params.get("theme") !== "light"
let currentSampleId = params.get("sample") ?? "module"

const editorHost = document.getElementById("editor") as HTMLElement
const astHost = document.getElementById("ast") as HTMLElement
const themeBtn = document.getElementById("theme-toggle") as HTMLButtonElement
const sampleSel = document.getElementById("sample") as HTMLSelectElement

// ---- Sample picker ---------------------------------------------------------

for (const s of SAMPLES) {
  const opt = document.createElement("option")
  opt.value = s.id
  opt.textContent = s.label
  sampleSel.appendChild(opt)
}
if (SAMPLES.some(s => s.id === currentSampleId)) {
  sampleSel.value = currentSampleId
} else {
  currentSampleId = "module"
  sampleSel.value = currentSampleId
}

// ---- AST viewer ------------------------------------------------------------

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function snippet(doc: string, from: number, to: number): string {
  const max = 40
  const raw = doc.slice(from, to).replace(/\n/g, "\\n").replace(/\s+/g, " ")
  return raw.length > max ? raw.slice(0, max) + "…" : raw
}

// Walk a tree and render its nodes as HTML. Descends into mounted overlay
// trees (the SDBL parser does this for query string literals via parseMixed)
// so the AST viewer shows the inner Query(StmtKw, …) structure aligned with
// the host BSL tree.
function renderTree(tree: TreeT, doc: string): string {
  const out: string[] = []

  function walk(cursor: TreeCursor, baseOffset: number, depth: number): void {
    do {
      // Cursor positions are zero-based against the *current* tree's input;
      // overlay trees use host-relative offsets, so we keep a running base.
      const from = cursor.from + baseOffset
      const to = cursor.to + baseOffset
      const text = escapeText(snippet(doc, from, to))
      out.push(
        `<div class="ast-node" data-from="${from}" data-to="${to}" ` +
        `style="padding-left:${depth * 14}px">` +
        `<span class="ast-name">${escapeText(cursor.name)}</span> ` +
        `<span class="ast-pos">${from}–${to}</span> ` +
        `<span class="ast-text">${text}</span>` +
        `</div>`
      )

      // Descend into mounted overlays (SDBL inside a BSL String node).
      const sub = cursor.tree
      const mount = sub && sub.prop(NodeProp.mounted)
      if (mount && mount.overlay) {
        const innerCursor = mount.tree.cursor()
        walk(innerCursor, cursor.from + baseOffset, depth + 1)
      }

      if (cursor.firstChild()) {
        walk(cursor, baseOffset, depth + 1)
        cursor.parent()
      }
    } while (cursor.nextSibling())
  }

  walk(tree.cursor(), 0, 0)
  return out.join("")
}


const astUpdater = EditorView.updateListener.of(update => {
  if (!update.docChanged && !update.selectionSet) return
  const tree = syntaxTree(update.state)
  astHost.innerHTML = renderTree(tree, update.state.doc.toString())
})

// ---- Editor ----------------------------------------------------------------

function commonExtensions(): Extension[] {
  return [
    basicSetup,
    bsl(),
    astUpdater,
    ...(dark ? [oneDark] : [])
  ]
}

const initial = SAMPLES.find(s => s.id === currentSampleId) ?? SAMPLES[0]
const view = new EditorView({
  state: EditorState.create({
    doc: initial.doc,
    extensions: commonExtensions()
  }),
  parent: editorHost
})

// Initial render (no doc-change event will fire on its own at startup).
astHost.innerHTML = renderTree(syntaxTree(view.state), view.state.doc.toString())

// ---- Click on AST node → focus that region in the editor -------------------

astHost.addEventListener("click", e => {
  const node = (e.target as HTMLElement).closest(".ast-node") as HTMLElement | null
  if (!node) return
  const from = Number(node.dataset.from)
  const to = Number(node.dataset.to)
  view.dispatch({
    selection: {anchor: from, head: to},
    scrollIntoView: true
  })
  view.focus()
})

// ---- Sample picker behaviour -----------------------------------------------

function loadSample(id: string): void {
  const s = SAMPLES.find(x => x.id === id)
  if (!s) return
  currentSampleId = id
  view.setState(EditorState.create({
    doc: s.doc,
    extensions: commonExtensions()
  }))
  astHost.innerHTML = renderTree(syntaxTree(view.state), view.state.doc.toString())
}

sampleSel.addEventListener("change", () => loadSample(sampleSel.value))

// ---- Theme toggle ----------------------------------------------------------

function applyTheme(): void {
  document.body.classList.toggle("dark", dark)
  themeBtn.textContent = dark ? "Светлая тема" : "Тёмная тема"
}
applyTheme()

themeBtn.addEventListener("click", () => {
  dark = !dark
  applyTheme()
  const doc = view.state.doc.toString()
  view.setState(EditorState.create({doc, extensions: commonExtensions()}))
  astHost.innerHTML = renderTree(syntaxTree(view.state), doc)
})

// ---- Drag-and-drop file loading --------------------------------------------

;(["dragenter", "dragover"] as const).forEach(ev => {
  editorHost.addEventListener(ev, e => {
    e.preventDefault()
    editorHost.classList.add("drop-target")
  })
})
;(["dragleave", "drop"] as const).forEach(ev => {
  editorHost.addEventListener(ev, e => {
    e.preventDefault()
    editorHost.classList.remove("drop-target")
  })
})

editorHost.addEventListener("drop", async e => {
  const file = e.dataTransfer?.files[0]
  if (!file) return
  const text = await file.text()
  view.setState(EditorState.create({doc: text, extensions: commonExtensions()}))
  astHost.innerHTML = renderTree(syntaxTree(view.state), text)
  // Reset the sample picker to a custom-file marker by adding/selecting one.
  let opt = sampleSel.querySelector<HTMLOptionElement>('option[value="__file"]')
  if (!opt) {
    opt = document.createElement("option")
    opt.value = "__file"
    sampleSel.appendChild(opt)
  }
  opt.textContent = `Загружено: ${file.name}`
  sampleSel.value = "__file"
})
