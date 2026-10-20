// 有理数（分数）演算：得点を "分子/分母" の文字列で厳密に保持する

const _gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
};
const _rMake = (n, d) => {
  if (d === 0n) return null;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) return '0/1';
  const g = _gcd(n, d) || 1n;
  return `${n / g}/${d / g}`;
};
const _rParse = (s) => {
  const [a, b] = String(s == null ? '0' : s).split('/');
  return {
    n: BigInt(a || '0'),
    d: b === undefined ? 1n : BigInt(b),
  };
};
const _decToRat = (s) => {
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;
  let sign = 1n;
  if (s[0] === '+') s = s.slice(1);
  else if (s[0] === '-') {
    sign = -1n;
    s = s.slice(1);
  }
  if (s.indexOf('.') >= 0) {
    const [i, f] = s.split('.');
    return {
      n: BigInt((i || '0') + f) * sign,
      d: 10n ** BigInt(f.length),
    };
  }
  return {
    n: BigInt(s) * sign,
    d: 1n,
  };
};
export const parseValue = (input) => {
  if (input == null) return null;
  let s = String(input).trim();
  if (s === '') return null;
  if (s.indexOf('/') >= 0) {
    const p = s.split('/');
    if (p.length !== 2) return null;
    const a = _decToRat(p[0].trim()),
      b = _decToRat(p[1].trim());
    if (!a || !b) return null;
    return _rMake(a.n * b.d, a.d * b.n);
  }
  const r = _decToRat(s);
  return r ? _rMake(r.n, r.d) : null;
};
export const applyOp = (scoreStr, op, valStr) => {
  const a = _rParse(scoreStr || '0/1'),
    b = _rParse(valStr);
  let n, d;
  switch (op) {
    case '+':
      n = a.n * b.d + b.n * a.d;
      d = a.d * b.d;
      break;
    case '-':
      n = a.n * b.d - b.n * a.d;
      d = a.d * b.d;
      break;
    case '*':
      n = a.n * b.n;
      d = a.d * b.d;
      break;
    case '/':
      if (b.n === 0n) return scoreStr;
      n = a.n * b.d;
      d = a.d * b.n;
      break;
    default:
      return scoreStr;
  }
  return _rMake(n, d);
};

// ---- ID/コード生成 ----
