'use strict';

/**
 * 得点まわりの純粋ロジック。サーバ・テストの両方から再利用する。
 *
 * 得点は **有理数（分数）** として正確に保持する。表現は "n/d" 形式の文字列
 * （n は符号付き整数、d は正の整数、既約・JSON で安全に運べる）。
 * これにより「÷3 してから ×3」が誤差なく元に戻るなど、繰り返し演算でも厳密。
 * 表示時のみ小数へ変換して丸める（formatScore）。
 */

const ZERO = '0/1';
const OPERATORS = ['+', '-', '*', '/'];

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

/** BigInt の分子・分母から既約な "n/d" 文字列を作る。d===0 は null。 */
function makeRat(n, d) {
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  if (n === 0n) return ZERO;
  const g = gcd(n, d) || 1n;
  return `${n / g}/${d / g}`;
}

/** "n/d" 文字列 → { n, d }（BigInt）。 */
function parseRat(str) {
  const [n, d] = String(str).split('/');
  return { n: BigInt(n), d: BigInt(d) };
}

/** 整数または小数（スラッシュ無し）を { n, d } へ。不正なら null。 */
function decimalToRat(s) {
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;
  let sign = 1n;
  if (s[0] === '+') s = s.slice(1);
  else if (s[0] === '-') { sign = -1n; s = s.slice(1); }
  if (s.includes('.')) {
    const [intp, frac] = s.split('.');
    const n = BigInt((intp || '0') + frac) * sign;
    const d = 10n ** BigInt(frac.length);
    return { n, d };
  }
  return { n: BigInt(s) * sign, d: 1n };
}

/**
 * 入力値を有理数 "n/d" にパースする。
 * 対応: 整数 "2", 小数 "0.5"/"-1.5", 分数 "1/2"/"-3/4"（分母分子に小数も可）。
 * 不正な入力（空・記号・0 除算など）は null。
 * @returns {string|null}
 */
function parseValue(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    input = String(input);
  }
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (s === '') return null;

  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length !== 2) return null;
    const a = decimalToRat(parts[0].trim());
    const b = decimalToRat(parts[1].trim());
    if (!a || !b) return null;
    // (a.n/a.d) / (b.n/b.d) = a.n*b.d / (a.d*b.n)
    return makeRat(a.n * b.d, a.d * b.n);
  }
  const r = decimalToRat(s);
  return r ? makeRat(r.n, r.d) : null;
}

/**
 * 有理数得点に演算子と有理数値を適用する。
 * @param {string} scoreStr "n/d"
 * @param {'+'|'-'|'*'|'/'} operator
 * @param {string} valStr "n/d"
 * @returns {string} "n/d"
 */
function applyOp(scoreStr, operator, valStr) {
  const a = parseRat(scoreStr);
  const b = parseRat(valStr);
  let n, d;
  switch (operator) {
    case '+': n = a.n * b.d + b.n * a.d; d = a.d * b.d; break;
    case '-': n = a.n * b.d - b.n * a.d; d = a.d * b.d; break;
    case '*': n = a.n * b.n; d = a.d * b.d; break;
    case '/':
      if (b.n === 0n) throw new Error('0 で割ることはできません');
      n = a.n * b.d; d = a.d * b.n;
      break;
    default:
      throw new Error('不正な演算子です: ' + operator);
  }
  return makeRat(n, d);
}

/**
 * チーム得点 = メンバー各得点の積（有理数）。
 * メンバー 0 人なら "0/1"。
 * @param {string[]} memberScores
 * @returns {string} "n/d"
 */
function teamScore(memberScores) {
  if (!Array.isArray(memberScores) || memberScores.length === 0) return ZERO;
  let n = 1n, d = 1n;
  for (const s of memberScores) {
    const r = parseRat(s);
    n *= r.n; d *= r.d;
  }
  return makeRat(n, d);
}

/** 有理数 "n/d" を JS の数値へ（ソート用）。 */
function ratToNumber(str) {
  if (typeof str === 'number') return str;
  const { n, d } = parseRat(str);
  return Number(n) / Number(d);
}

/**
 * 表示用に整形する。整数ならそのまま（厳密に大きくても可）、
 * そうでなければ小数第2位まで（末尾 0 は除去）。
 * 有理数文字列・数値のどちらも受け付ける。
 * @returns {string}
 */
function formatScore(val) {
  if (typeof val === 'string' && val.includes('/')) {
    const { n, d } = parseRat(val);
    if (d === 1n) return n.toString();
    const num = Number(n) / Number(d);
    return formatNumber(num);
  }
  const num = typeof val === 'number' ? val : Number(val);
  return formatNumber(num);
}

function formatNumber(num) {
  if (!Number.isFinite(num)) return '0';
  const rounded = Math.round(num * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(parseFloat(rounded.toFixed(2)));
}

module.exports = {
  ZERO, OPERATORS,
  parseValue, applyOp, teamScore, ratToNumber, formatScore, makeRat, parseRat,
};
