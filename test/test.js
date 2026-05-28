// Mocha test runner — discovers every test/*.txt fixture, parses each case
// with the built BSL parser, and diffs the actual tree against the expected
// tree using Lezer's own assertion helper.
//
// The parser is loaded from the built `dist/` output, so `npm run build` must
// run first (the `test` and `build` scripts in package.json take care of the
// order in CI).

import * as fs from "node:fs"
import * as path from "node:path"
import {fileURLToPath} from "node:url"
import {fileTests} from "@lezer/generator/dist/test"
import {bslLanguage} from "../dist/index.js"

const caseDir = path.dirname(fileURLToPath(import.meta.url))

for (const file of fs.readdirSync(caseDir)) {
  if (!file.endsWith(".txt")) continue
  const name = path.basename(file, ".txt")
  describe(name, () => {
    const cases = fs.readFileSync(path.join(caseDir, file), "utf8")
    for (const {name: caseName, run} of fileTests(cases, file)) {
      it(caseName, () => run(bslLanguage.parser))
    }
  })
}

