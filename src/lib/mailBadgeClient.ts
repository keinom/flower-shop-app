/**
 * ナビバッジ（未対応メール件数）の定期取得の制御（DOM・React に依存しない純粋ロジック）。
 * 管理画面（staff）のみで使う。件数だけを取り直し、ページ全体の再描画・再取得はしない。
 *
 * - 画面が表示されている間だけ intervalMs ごとに取得（非表示の間はタイマー自体を止める）
 * - 非表示→表示に戻ったとき、前回取得から minGapMs 以上空いていれば即取得（連続切替での過剰呼び出しを防ぐ）
 * - 同時に 1 本まで。失敗（null・例外）は無視して直前の表示を維持（次回の取得で復旧）
 * - invalidate(): サーバー側の値が更新された（ステータス変更後の再描画など）ときに、
 *   その時点で取得中の古い応答を捨てる（古い数字への巻き戻り防止）
 */
export const MAIL_BADGE_INTERVAL_MS = 3 * 60 * 1000;
export const MAIL_BADGE_MIN_GAP_MS = 15 * 1000;

export interface MailBadgePollerOptions {
  /** 件数を取得。失敗は null を返すか例外を投げる */
  fetchCount: (signal: AbortSignal) => Promise<number | null>;
  onCount: (count: number) => void;
  isVisible: () => boolean;
  intervalMs?: number;
  minGapMs?: number;
  now?: () => number;
  setIntervalFn?: (fn: () => void, ms: number) => unknown;
  clearIntervalFn?: (id: unknown) => void;
}

export interface MailBadgePoller {
  start(): void;
  stop(): void;
  /** visibilitychange（および focus）で呼ぶ */
  onVisibilityChange(): void;
  invalidate(): void;
}

export function createMailBadgePoller(opts: MailBadgePollerOptions): MailBadgePoller {
  const intervalMs = opts.intervalMs ?? MAIL_BADGE_INTERVAL_MS;
  const minGapMs = opts.minGapMs ?? MAIL_BADGE_MIN_GAP_MS;
  const now = opts.now ?? Date.now;
  const setIntervalFn = opts.setIntervalFn ?? ((fn, ms) => setInterval(fn, ms));
  const clearIntervalFn = opts.clearIntervalFn ?? ((id) => clearInterval(id as ReturnType<typeof setInterval>));

  let timer: unknown = null;
  let running = false;
  let inFlight = false;
  let generation = 0;
  let lastFetchAt = -Infinity;
  let controller: AbortController | null = null;

  async function refresh() {
    if (inFlight) return;
    inFlight = true;
    lastFetchAt = now();
    const gen = generation;
    const ac = new AbortController();
    controller = ac;
    try {
      const n = await opts.fetchCount(ac.signal);
      if (gen === generation && n !== null && Number.isFinite(n)) opts.onCount(n);
    } catch {
      /* 通信断・セッション切れ等: 直前の表示を維持し、何も出さない */
    } finally {
      inFlight = false;
      if (controller === ac) controller = null;
    }
  }

  function startTimer() {
    if (timer !== null) return;
    timer = setIntervalFn(() => {
      if (opts.isVisible()) void refresh();
    }, intervalMs);
  }

  function stopTimer() {
    if (timer === null) return;
    clearIntervalFn(timer);
    timer = null;
  }

  return {
    start() {
      running = true;
      if (opts.isVisible()) startTimer();
    },
    stop() {
      running = false;
      stopTimer();
      generation++;
      controller?.abort();
    },
    onVisibilityChange() {
      if (!running) return;
      if (opts.isVisible()) {
        startTimer();
        if (now() - lastFetchAt >= minGapMs) void refresh();
      } else {
        stopTimer();
      }
    },
    invalidate() {
      generation++;
      controller?.abort();
    },
  };
}

/** ブラウザ用の取得処理: GET /api/mail/unhandled-count（件数のみ・キャッシュなし） */
export async function fetchUnhandledMailCount(signal: AbortSignal): Promise<number | null> {
  const res = await fetch("/api/mail/unhandled-count", {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  const c = (json as { count?: unknown } | null)?.count;
  return typeof c === "number" && Number.isInteger(c) && c >= 0 ? c : null;
}
