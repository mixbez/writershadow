import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTags, stripTags, appendTags } from '../../src/utils/tags.js';

test('appendTags помещает теги В НАЧАЛО текста', () => {
  const result = appendTags('Текст поста', ['Продакт', 'Вайбкодинг']);
  assert.ok(result.startsWith('## Продакт'), `ожидал теги в начале, получил: ${result}`);
  assert.ok(result.includes('Текст поста'));
});

test('appendTags без тегов возвращает текст без изменений', () => {
  assert.equal(appendTags('Текст', []), 'Текст');
  assert.equal(appendTags('Текст'), 'Текст');
});

test('stripTags убирает теги из начала текста', () => {
  const text = '## Продакт ## Вайбкодинг\n\nТекст поста';
  assert.equal(stripTags(text), 'Текст поста');
});

test('parseTags извлекает имена тегов', () => {
  const text = '## Продакт ## Вайбкодинг\n\nТекст';
  const tags = parseTags(text);
  assert.deepEqual(tags, ['Продакт', 'Вайбкодинг']);
});

test('strip → parse → append — roundtrip без потерь', () => {
  const original = '## Тег1 ## Тег2\n\nОсновной текст поста.';
  const tags = parseTags(original);
  const stripped = stripTags(original);
  const restored = appendTags(stripped, tags);
  assert.equal(stripTags(restored), 'Основной текст поста.');
  assert.deepEqual(parseTags(restored), ['Тег1', 'Тег2']);
});
