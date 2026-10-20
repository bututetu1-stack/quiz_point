// ホスト向け：データベース（Firebase）の設定が足りず使えない機能があれば知らせ、設定に貼るルールをコピーできるようにする

import { useContext, useEffect, useState } from 'react';
import { RoomContext } from '../context.js';
import { Copy } from '../ui/icons.jsx';
import { Button, Card } from '../ui/primitives.jsx';

const FEATURES = {
  timeline: 'グラフ',
  log: '操作ログ',
  presence: 'オンライン表示（緑の点）',
  roomIndex: '古い部屋の自動の掃除',
};

export const RULES_JSON = `{
  "rules": {
    "rooms": { ".read": true, ".write": true },
    "history": { ".read": true, ".write": true },
    "timeline": { ".read": true, ".write": true },
    "roomIndex": { ".read": true, ".write": true },
    "log": { ".read": true, ".write": true },
    "presence": { ".read": true, ".write": true }
  }
}`;

export const AccessCheck = () => {
  const { store, roomId } = useContext(RoomContext);
  const [missing, setMissing] = useState([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!store || !roomId || !store.checkAccess) return undefined;
    let alive = true;
    store.checkAccess(roomId).then((ok) => {
      if (alive) setMissing(Object.keys(FEATURES).filter((k) => ok[k] === false));
    });
    return () => {
      alive = false;
    };
  }, [store, roomId]);
  if (!missing.length) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(RULES_JSON);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('このルールをコピーしてください', RULES_JSON);
    }
  };
  return (
    <Card className="p-4 border-2 border-ng/40 bg-ng-soft" data-access-warning>
      <div className="font-black text-ng-ink">データベースの設定が足りません</div>
      <p className="text-sm text-ink mt-1 leading-relaxed">
        次の機能が使えません：<b>{missing.map((k) => FEATURES[k]).join('・')}</b>。得点の操作はそのまま使えます。
      </p>
      <p className="text-xs text-ink-2 mt-2 leading-relaxed">
        Firebase コンソール →（このプロジェクト）→ Realtime Database →「ルール」に、下のルールを貼り付けて「公開」してください。
      </p>
      <Button variant="secondary" className="mt-3 w-full py-2.5 text-sm" onClick={copy}>
        <Copy size={16} /> {copied ? 'コピーしました' : 'ルールをコピー'}
      </Button>
    </Card>
  );
};
