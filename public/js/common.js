/* 共有ユーティリティ（host / participant 両方で使用）
 * 得点はサーバから有理数文字列 "n/d" で届く。表示・ソート・チーム積をここで扱う。
 * （計算ロジックは src/scoreEngine.js と同じ挙動。閲覧側は読み取りのみ。）
 */

function gcdBig(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function makeRat(n, d) {
  if (d === 0n) return '0/1';
  if (d < 0n) { n = -n; d = -d; }
  if (n === 0n) return '0/1';
  const g = gcdBig(n, d) || 1n;
  return `${n / g}/${d / g}`;
}

function parseRat(str) {
  const [n, d] = String(str).split('/');
  return { n: BigInt(n), d: BigInt(d) };
}

function ratToNumber(str) {
  if (typeof str === 'number') return str;
  const { n, d } = parseRat(str);
  return Number(n) / Number(d);
}

// チーム得点 = メンバー得点（有理数文字列）の積
function teamScore(memberScores) {
  if (!Array.isArray(memberScores) || memberScores.length === 0) return '0/1';
  let n = 1n, d = 1n;
  for (const s of memberScores) {
    const r = parseRat(s);
    n *= r.n; d *= r.d;
  }
  return makeRat(n, d);
}

// 表示用整形（整数はそのまま、小数は第2位まで）
function formatScore(val) {
  if (typeof val === 'string' && val.includes('/')) {
    const { n, d } = parseRat(val);
    if (d === 1n) return n.toString();
    return formatNumber(Number(n) / Number(d));
  }
  return formatNumber(typeof val === 'number' ? val : Number(val));
}

function formatNumber(num) {
  if (!Number.isFinite(num)) return '0';
  const rounded = Math.round(num * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(parseFloat(rounded.toFixed(2)));
}

// 得点降順ソート（同点は名前順）
function sortByScoreDesc(players) {
  return [...players].sort((a, b) => {
    const na = ratToNumber(a.score), nb = ratToNumber(b.score);
    if (nb !== na) return nb - na;
    return a.name.localeCompare(b.name, 'ja');
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}
