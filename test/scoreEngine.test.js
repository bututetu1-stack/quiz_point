'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  parseValue, applyOp, teamScore, formatScore, ratToNumber,
} = require('../src/scoreEngine');

test('parseValue: 整数・小数・分数（有理数文字列で返る）', () => {
  assert.strictEqual(parseValue('2'), '2/1');
  assert.strictEqual(parseValue('0.5'), '1/2');
  assert.strictEqual(parseValue('-1.5'), '-3/2');
  assert.strictEqual(parseValue('1/2'), '1/2');
  assert.strictEqual(parseValue('-3/4'), '-3/4');
  assert.strictEqual(parseValue('  3 / 4 '), '3/4');
  assert.strictEqual(parseValue('4/2'), '2/1'); // 既約化
});

test('parseValue: 不正入力は null', () => {
  assert.strictEqual(parseValue(''), null);
  assert.strictEqual(parseValue('   '), null);
  assert.strictEqual(parseValue('abc'), null);
  assert.strictEqual(parseValue('1/0'), null);
  assert.strictEqual(parseValue('1/2/3'), null);
  assert.strictEqual(parseValue('1/'), null);
  assert.strictEqual(parseValue(NaN), null);
});

test('applyOp: 四則演算（有理数）', () => {
  assert.strictEqual(applyOp('3/1', '+', '2/1'), '5/1');
  assert.strictEqual(applyOp('3/1', '-', '2/1'), '1/1');
  assert.strictEqual(applyOp('3/1', '*', '2/1'), '6/1');
  assert.strictEqual(applyOp('6/1', '/', '2/1'), '3/1');
  assert.strictEqual(applyOp('4/1', '*', '1/2'), '2/1');
});

test('applyOp: 厳密性 — ÷3 してから ×3 で元に戻る', () => {
  const start = parseValue('1');           // '1/1'
  const divided = applyOp(start, '/', '3/1'); // '1/3'
  const back = applyOp(divided, '*', '3/1');  // '1/1'
  assert.strictEqual(back, '1/1');
});

test('applyOp: 0 除算と不正演算子は例外', () => {
  assert.throws(() => applyOp('6/1', '/', '0/1'));
  assert.throws(() => applyOp('6/1', '%', '2/1'));
});

test('teamScore: メンバー得点の積（会話の例 2×1×2×1×2 = 8）', () => {
  assert.strictEqual(teamScore(['2/1', '1/1', '2/1', '1/1', '2/1']), '8/1');
  assert.strictEqual(teamScore(['3/1', '3/1']), '9/1');
  assert.strictEqual(teamScore([]), '0/1');
  assert.strictEqual(teamScore(['5/1', '0/1', '2/1']), '0/1');
  assert.strictEqual(teamScore(['1/2', '1/2']), '1/4');
});

test('formatScore: 整数表示・小数丸め', () => {
  assert.strictEqual(formatScore('8/1'), '8');
  assert.strictEqual(formatScore('5/2'), '2.5');
  assert.strictEqual(formatScore('1/3'), '0.33');
  assert.strictEqual(formatScore('-3/2'), '-1.5');
  assert.strictEqual(formatScore(NaN), '0');
});

test('ratToNumber: ソート用の数値化', () => {
  assert.strictEqual(ratToNumber('8/1'), 8);
  assert.strictEqual(ratToNumber('1/2'), 0.5);
});
