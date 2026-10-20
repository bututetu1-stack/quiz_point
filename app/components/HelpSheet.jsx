// 使い方（ホーム右上と部屋のメニューから開く）

import { Sheet } from '../ui/primitives.jsx';

const Step = ({ n, title, children }) => (
  <li className="flex gap-3">
    <span className="w-7 h-7 shrink-0 rounded-full bg-brand text-on-brand font-black flex items-center justify-center">{n}</span>
    <div className="min-w-0">
      <div className="font-black text-ink">{title}</div>
      <p className="text-sm text-ink-2 leading-relaxed mt-0.5">{children}</p>
    </div>
  </li>
);

export const HelpSheet = ({ open, onClose }) => (
  <Sheet open={open} onClose={onClose} title="使い方" wide>
    <div className="px-1 flex flex-col gap-5 pb-1" data-help>
      <section>
        <h4 className="text-xs font-bold text-ink-3 mb-2">ホスト（司会）</h4>
        <ol className="flex flex-col gap-3">
          <Step n="1" title="部屋を作る">
            ホームの「ホストとして部屋を作る」。ホストも 1 人のプレイヤーとして得点を付けられます。
          </Step>
          <Step n="2" title="招待する">
            ヘッダーの部屋コードを押すと QR コードとリンク。プロジェクタには「管理 → 大画面」。
          </Step>
          <Step n="3" title="ルールを選ぶ">
            「管理 → ルール → 変更する」。N〇M✕・フリーズ・スウェーディッシュ・+M/−N・アップダウン・M by N・ディバイド・自由計算。
          </Step>
          <Step n="4" title="問題を進める">
            1 問ごとにヘッダーの Q 番号の横の ▶（PC ではキーボードの → でも）。休みの数え方とグラフに使います。
          </Step>
          <Step n="5" title="結果発表">
            「管理 → 結果発表」で全員の画面に表彰台。CSV で保存もできます。
          </Step>
        </ol>
      </section>
      <section>
        <h4 className="text-xs font-bold text-ink-3 mb-2">参加者</h4>
        <ol className="flex flex-col gap-3">
          <Step n="1" title="入室する">
            QR コードを読み取るか、部屋コード 4 桁と名前を入れます。
          </Step>
          <Step n="2" title="自分で得点を付ける">
            正解なら「正答」、不正解なら「誤答」。勝ち抜け・脱落・休みは自動で決まります（自分で「勝ち抜け」「脱落」を押すこともできます）。
          </Step>
          <Step n="3" title="間違えたら">
            「元に戻す」で自分の直前の操作だけ取り消せます。
          </Step>
          <Step n="4" title="ランキングの印">
            「リーチ」はあと 1 問正答で勝ち抜け。「休み あと n 問」は誤答のあと答えられない問題の数で、問題が進んだら「問題を進める」を押します（ホストが進めた分は自動で数えます）。
          </Step>
        </ol>
      </section>
      <p className="text-xs text-ink-3 leading-relaxed">
        ルールの中身はヘッダーのルール名を押すと見られます。見るだけにしたいときは「…」→「観戦にする」。
      </p>
    </div>
  </Sheet>
);
