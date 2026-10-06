const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

const cache = new Map();
function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const localRequire = (specifier) => {
    // Native UUID generation is the only platform dependency in the repositories.
    if (specifier === 'expo-crypto') return { randomUUID };
    if (specifier.startsWith('.')) return loadTypeScript(path.resolve(path.dirname(filename), `${specifier}.ts`));
    throw new Error(`Unexpected runtime dependency: ${specifier}`);
  };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}

function database() {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    sqlite,
    async execAsync(sql) { sqlite.exec(sql); },
    async runAsync(sql, ...args) { return sqlite.prepare(sql).run(...args); },
    async getFirstAsync(sql, ...args) { return sqlite.prepare(sql).get(...args) ?? null; },
    async getAllAsync(sql, ...args) { return sqlite.prepare(sql).all(...args); },
    async withExclusiveTransactionAsync(callback) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        await callback(db);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return db;
}

module.exports = { loadTypeScript, database };
