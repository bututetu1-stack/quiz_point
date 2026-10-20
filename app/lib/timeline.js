// 得点推移：保存するのは「変わった人の分だけ」のイベント。
// イベント: { t, p?, s?, m?, b? }  p があればその人だけ、無ければ全員に適用。
//   s = 得点（有理数文字列）, m = 〇数, b = ✕数（省略されたものは変化なし）
// グラフ用に「各時点の全員の値」のスナップショット列へ展開する。

// initial：記録がまだ無い人の得点（ルールの初期点。ディバイドなら 10。途中参加の人のグラフが 0 から始まらないように）
export const eventsToSnapshots = (events, players, scoreMode, initial = '0/1') => {
  const ZERO = () => ({ s: initial, m: 0, b: 0 });
  const st = {};
  (players || []).forEach((p) => {
    st[p.id] = ZERO();
  });
  const val = (x) => (scoreMode === 'simple' ? String((x.m || 0) - (x.b || 0)) : x.s);
  let q = 0;
  const snap = (t) => {
    const scores = {};
    Object.keys(st).forEach((id) => {
      scores[id] = val(st[id]);
    });
    return { t, q, scores };
  };
  const list = [...(events || [])].sort((a, b) => a.t - b.t);
  const out = [snap(list.length ? list[0].t - 1 : 0)];
  for (const e of list) {
    const apply = (id) => {
      const cur = st[id] || (st[id] = ZERO());
      if (e.s !== undefined) cur.s = e.s;
      if (e.m !== undefined) cur.m = e.m;
      if (e.b !== undefined) cur.b = e.b;
    };
    if (e.p) apply(e.p);
    else Object.keys(st).forEach(apply);
    if (e.q) q = e.q;
    out.push(snap(e.t));
  }
  return out;
};

// 問題番号ごとにまとめる（各問題の終わりの時点だけ残す）。問題番号が無い記録しか無ければ時系列のまま
export const groupByQuestion = (snaps) => {
  if (!snaps.some((s) => s.q > 1)) return snaps;
  const out = [{ ...snaps[0], label: '開始' }];
  snaps.slice(1).forEach((s) => {
    const last = out[out.length - 1];
    if (last.q === s.q && last.label !== '開始') out[out.length - 1] = { ...s, label: `Q${s.q}` };
    else out.push({ ...s, label: `Q${s.q}` });
  });
  return out;
};
