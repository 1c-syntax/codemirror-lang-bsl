// Live demo: two-panel CodeMirror 6 + @1c-syntax/codemirror-lang-bsl showcase.
//
// Bundled to docs/bundle.js by `npm run build:demo` and deployed to GitHub
// Pages by the .github/workflows/pages.yml workflow.

import {EditorView, basicSetup} from "codemirror"
import {EditorState} from "@codemirror/state"
import {oneDark} from "@codemirror/theme-one-dark"
import {bsl} from "../src/index"

const moduleSample = `// Пример модуля 1С: процедура с аннотацией, ветвлением, циклом
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

const querySample = `// Демонстрация встроенной грамматики SDBL (язык запросов 1С) внутри строки.
// Подсветка ключевых слов запроса, типов метаданных и виртуальных таблиц
// активируется автоматически, когда строка начинается с ВЫБРАТЬ/SELECT.

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

// ----- helpers --------------------------------------------------------------

interface PanelState {
  view: EditorView
  dark: boolean
}

function makePanel(parent: HTMLElement, doc: string, dark: boolean): PanelState {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        basicSetup,
        bsl(),
        ...(dark ? [oneDark] : [])
      ]
    }),
    parent
  })
  return {view, dark}
}

function rebuild(panel: PanelState, doc: string): void {
  panel.view.setState(EditorState.create({
    doc,
    extensions: [
      basicSetup,
      bsl(),
      ...(panel.dark ? [oneDark] : [])
    ]
  }))
}

// ----- bootstrap ------------------------------------------------------------

const moduleHost = document.getElementById("editor-module") as HTMLElement
const queryHost = document.getElementById("editor-query") as HTMLElement
const themeBtn = document.getElementById("theme-toggle") as HTMLButtonElement

// Default to dark — One Dark contrasts highlight tags noticeably more than
// CM6's default light highlightStyle, which is what people open this demo
// for. A URL ?theme=light query param or the toggle below switches back.
let dark = new URLSearchParams(location.search).get("theme") !== "light"
themeBtn.textContent = dark ? "Светлая тема" : "Тёмная тема"
document.body.classList.toggle("dark", dark)

const modulePanel = makePanel(moduleHost, moduleSample, dark)
const queryPanel = makePanel(queryHost, querySample, dark)

themeBtn.addEventListener("click", () => {
  dark = !dark
  modulePanel.dark = dark
  queryPanel.dark = dark
  themeBtn.textContent = dark ? "Светлая тема" : "Тёмная тема"
  document.body.classList.toggle("dark", dark)
  rebuild(modulePanel, modulePanel.view.state.doc.toString())
  rebuild(queryPanel, queryPanel.view.state.doc.toString())
})
