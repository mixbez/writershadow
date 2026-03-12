/**
 * Import validation — проверяет что все именованные импорты между
 * внутренними модулями реально существуют как экспорты.
 * Ловит "export named X does not exist" до деплоя.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '../src');

function readFile(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function getExports(filePath) {
  const content = readFile(filePath);
  if (!content) return new Set();
  const exports = new Set();
  for (const m of content.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g)) {
    exports.add(m[1]);
  }
  return exports;
}

function getLocalImports(filePath) {
  const content = readFile(filePath);
  if (!content) return [];
  const imports = [];
  for (const m of content.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g)) {
    const names = m[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    const targetPath = resolve(dirname(filePath), m[2].replace(/\.js$/, '') + '.js');
    imports.push({ names, targetPath, from: m[2] });
  }
  return imports;
}

function getAllSrcFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getAllSrcFiles(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const srcFiles = getAllSrcFiles(srcDir);

for (const file of srcFiles) {
  const imports = getLocalImports(file);
  for (const { names, targetPath, from } of imports) {
    const label = file.replace(srcDir + '/', '') + ' → ' + from;
    test(label, () => {
      const exports = getExports(targetPath);
      assert.ok(exports.size > 0, `Целевой файл не найден или пуст: ${targetPath}`);
      for (const name of names) {
        assert.ok(
          exports.has(name),
          `"${name}" не экспортируется из ${from} (используется в ${file.replace(srcDir + '/', '')})`
        );
      }
    });
  }
}
