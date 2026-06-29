const fs = require('fs')
const ts = require('typescript')
const path = require('path')

// Mock localStorage — wymagany przez getFullCatalog() w hardware-catalog.ts
const store = {}
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v },
  removeItem: (k) => { delete store[k] },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
}

require.extensions['.ts'] = (mod, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText
  mod._compile(output, filename)
}

require(path.join(__dirname, 'cabinet-test.ts'))
