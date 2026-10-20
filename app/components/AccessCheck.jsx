// ホスト向け：データベース（Firebase）の設定が足りず使えない機能があれば知らせ、設定に貼るルールをコピーできるようにする

import { useContext, useEffect, useState } from 'react';
import { RoomContext } from '../context.js';
import { firebaseConfig } from '../data/config.js';
import { useAsk } from '../ui/dialogs.jsx';
import { Copy, ExternalLink } from '../ui/icons.jsx';
import { Button, Card } from '../ui/primitives.jsx';

const FEATURES = {
  timeline: 'グラフ',
  log: '操作ログ',
  presence: 'オンライン表示（緑の点）',
  roomIndex: '古い部屋の自動の掃除',
};

// Firebase コンソールの「ルール」の画面（このアプリのデータベース）
const RULES_URL = (() => {
  try {
    const db = new URL(firebaseConfig.databaseURL).hostname.split('.')[0];
    return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/database/${db}/rules`;
  } catch {
    return 'https://console.firebase.google.com/';
  }
})();

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
  const { showCopy } = useAsk();
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
      await showCopy('自動でコピーできませんでした。下のルールを全部選んでコピーしてください', RULES_JSON);
    }
  };
  return (
    <Card className="p-4 border-2 border-ng/40 bg-ng-soft" data-access-warning>
      <div className="font-black text-ng-ink">データベースの設定が足りません</div>
      <p className="text-sm text-ink mt-1 leading-relaxed">
        次の機能が使えません：<b>{missing.map((k) => FEATURES[k]).join('・')}</b>。得点の操作はそのまま使えます。
      </p>
      <p className="text-xs text-ink-2 mt-2 leading-relaxed">
        Firebase コンソール →（このプロジェクト）→ Realtime Database
        →「ルール」に、下のルールを貼り付けて「公開」してください（アプリの持ち主だけができます）。
      </p>
      <div className="mt-3 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
        <Button variant="secondary" className="py-2.5 text-sm" onClick={copy}>
          <Copy size={16} /> {copied ? 'コピーしました' : '1. ルールをコピー'}
        </Button>
        <a
          href={RULES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold bg-card text-ink border border-line hover:border-brand/60 transition-colors"
          data-rules-link
        >
          <ExternalLink size={16} /> 2. ルールの画面を開く
        </a>
      </div>
    </Card>
  );
};
