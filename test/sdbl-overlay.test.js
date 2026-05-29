// Verify that BSL string literals that look like SDBL queries get a mounted
// overlay tree produced by the SDBL parser. The mounted tree is invisible to
// the standard `tree.toString()` walker but is what CodeMirror's highlighter
// traverses (via IterMode.IncludeMounts) — so this test exercises the actual
// highlight-relevant data path.

import assert from "node:assert/strict"
import {NodeProp} from "@lezer/common"
import {bslLanguage, sdblLanguage} from "../dist/index.js"

describe("SDBL parser standalone", () => {
  it("tokenises a simple SELECT into category-tagged nodes", () => {
    const tree = sdblLanguage.parse(
      "ВЫБРАТЬ * ИЗ Справочник.Контрагенты ГДЕ Поставщик = ИСТИНА"
    )
    const repr = tree.toString()
    // Expect statement keywords, MDO type, identifier, boolean literal.
    assert.match(repr, /Query\(/)
    assert.match(repr, /StmtKw/)
    assert.match(repr, /MdoKw/)
    assert.match(repr, /BoolLit/)
  })

  it("recognises Russian and English keywords identically", () => {
    const ru = sdblLanguage.parse("ВЫБРАТЬ ПЕРВЫЕ 10 ИЗ Справочник.Товары").toString()
    const en = sdblLanguage.parse("SELECT TOP 10 FROM Справочник.Товары").toString()
    assert.equal(ru, en)
  })

  it("parses `{...}` configuration blocks as a BraceGroup", () => {
    // 1C data-composition-system queries embed `{...}` blocks that the query
    // engine consumes out-of-band; we don't need to enforce their structure
    // but the parser must accept them without error tokens.
    const repr = sdblLanguage.parse(
      "ВЫБРАТЬ {Поле1, Поле2} ИЗ Справочник.Контрагенты"
    ).toString()
    // Inner Punct(Comma) contains a ')' so we can't use [^)]*; this matcher
    // just checks the BraceGroup opens with LBrace and contains RBrace.
    assert.match(repr, /BraceGroup\(LBrace,/)
    assert.match(repr, /,RBrace\)/)
    // No error markers anywhere in the tree.
    assert.doesNotMatch(repr, /⚠/)
  })
})

describe("SDBL embedded inside BSL string literal via parseMixed", () => {
  // SDBL overlays are attached to host nodes via NodeProp.mounted; a regular
  // cursor walk skips them by design (Lezer only enters overlays through
  // resolveInner / enter), so we have to look up the prop manually.
  // MountedTree.overlay ranges are *host-relative*, so we re-base them onto
  // the host node's absolute start.
  function findMountedSdblNode(tree) {
    function walk(cursor) {
      do {
        const subTree = cursor.tree
        if (subTree) {
          const mt = subTree.prop(NodeProp.mounted)
          if (mt && mt.overlay) {
            return {
              from: cursor.from + mt.overlay[0].from,
              to: cursor.from + mt.overlay[mt.overlay.length - 1].to,
              innerRoot: mt.tree.toString()
            }
          }
        }
        if (cursor.firstChild()) {
          const inner = walk(cursor)
          cursor.parent()
          if (inner) return inner
        }
      } while (cursor.nextSibling())
      return null
    }
    return walk(tree.cursor())
  }

  it("mounts an SDBL overlay inside a query-shaped string", () => {
    const src = 'Запрос.Текст = "ВЫБРАТЬ Контрагенты ИЗ Справочник.Контрагенты";'
    const tree = bslLanguage.parser.parse(src)
    const sdbl = findMountedSdblNode(tree)
    assert.ok(sdbl, "expected a mounted SDBL Query node, got none")
    // The overlay parses the *content* between the outer quotes.
    assert.equal(sdbl.from, src.indexOf('"') + 1, "overlay should start after opening quote")
    assert.equal(sdbl.to, src.lastIndexOf('"'), "overlay should end before closing quote")
    // SDBL grammar produced the right token categories.
    assert.match(sdbl.innerRoot, /StmtKw/, "expected StmtKw in inner SDBL tree")
    assert.match(sdbl.innerRoot, /MdoKw/, "expected MdoKw in inner SDBL tree")
  })

  it("does not mount SDBL inside a non-query string", () => {
    const src = 'с = "просто текст";'
    const tree = bslLanguage.parser.parse(src)
    const sdbl = findMountedSdblNode(tree)
    assert.equal(sdbl, null, "non-query strings must not produce a SDBL overlay")
  })

  it("mounts SDBL for an English SELECT prefix too", () => {
    const src = 'q.Text = "SELECT Имя FROM Каталог";'
    const tree = bslLanguage.parser.parse(src)
    const sdbl = findMountedSdblNode(tree)
    assert.ok(sdbl, "English SELECT must trigger SDBL embedding")
  })

  it("tolerates multi-line query strings with | continuation", () => {
    const src = `q.Text = "ВЫБРАТЬ
       |  Имя
       |ИЗ Справочник.Товары";`
    const tree = bslLanguage.parser.parse(src)
    const sdbl = findMountedSdblNode(tree)
    assert.ok(sdbl, "multi-line query strings should still trigger embedding")
  })
})
