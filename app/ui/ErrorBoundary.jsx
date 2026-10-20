// 画面の描画中に思いがけないエラーが起きたとき、真っ白にせず「再読み込み」を出す（得点のデータはデータベースにあるので消えない）

import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('quiz_point: 画面の表示でエラー', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-6" role="alert" data-crash>
        <div className="w-full max-w-sm bg-card border border-line rounded-2xl shadow-soft p-6 text-center">
          <div className="text-lg font-black text-ink">表示に問題が起きました</div>
          <p className="text-sm text-ink-2 mt-2 leading-relaxed">得点などのデータは消えていません。再読み込みすると元の画面に戻ります。</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 w-full py-3 rounded-xl bg-brand text-on-brand font-bold shadow-btn hover:bg-brand-strong"
          >
            再読み込み
          </button>
          <details className="mt-3 text-left text-xs text-ink-3">
            <summary className="cursor-pointer">くわしく</summary>
            <pre className="mt-1 whitespace-pre-wrap break-all">{String((error && error.message) || error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}
