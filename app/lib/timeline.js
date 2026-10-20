// 得点推移：保存するのは「変わった人の分だけ」のイベント。
// イベント: { t, p?, s?, m?, b? }  p があればその人だけ、無ければ全員に適用。
//   s = 得点（有理数文字列）, m = 〇数, b = ✕数（省略されたものは変化なし）
// グラフ用に「各時点の全員の値」のスナップショット列へ展開する。

const ZERO = () => ({ s: '0/1', m: 0, b: 0 });

export const eventsToSnapshots = (events, players, scoreMode) => {
  const st = {};
  (players || []).forEach((p) => {
    st[p.id] = ZERO();
  });
  const val = (x) => (scoreMode === 'simple' ? String((x.m || 0) - (x.b || 0)) : x.s);
  const snap = (t) => {
    const scores = {};
    Object.keys(st).forEach((id) => {
      scores[id] = val(st[id]);
    });
    return { t, scores };
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
    out.push(snap(e.t));
  }
  return out;
};
