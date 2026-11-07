import { useSignal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import type { DailyInfo, DailySolveResult } from '../api';
import { sfx } from '../audio';
import { Editor } from '../board/editor';
import { outputColumn } from '../board/geometry';
import { JoinForm } from '../components/JoinForm';
import { ShareButtons } from '../components/ShareButtons';
import { Modal, Stars, TopBar } from '../components/ui';
import {
  dailyHistory,
  dailyShareText,
  dayLabel,
  fetchDaily,
  puzzleLevel,
  recordDaily,
  streak,
  submitDaily,
} from '../daily';
import { t } from '../i18n';
import { go } from '../router';
import { emptyCircuit, type Level } from '../sim/types';
import { getDraft, profile, pruneDailyDrafts, setDraft } from '../state';
import { Workbench, type Solved } from './Workbench';

interface Result {
  stars: number;
  gates: number;
  improved: boolean;
  prevGates?: number;
  /** undefined — yuborilmoqda, null — yuborilmadi (profil yoki aloqa yo'q). */
  server?: DailySolveResult | null;
}

export function DailyScreen() {
  const info = useSignal<DailyInfo | null>(null);
  const failed = useSignal(false);

  const load = async () => {
    failed.value = false;
    try {
      info.value = await fetchDaily();
    } catch {
      failed.value = true;
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (info.value) return <DailyPlay key={info.value.day} info={info.value} />;
  return (
    <div class="screen">
      <TopBar title={t.daily.title} onBack={() => go('')} />
      <div class="scroll">
        <div class="narrow">
          {failed.value ? (
            <div class="card">
              <p>{t.daily.offline}</p>
              <button class="btn" onClick={load}>
                {t.retry}
              </button>
            </div>
          ) : (
            <p class="muted center">{t.loading}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DailyPlay({ info }: { info: DailyInfo }) {
  const level = useMemo(() => puzzleLevel(info), [info.day]);
  const editor = useMemo(() => new Editor(), []);
  const result = useSignal<Result | null>(null);

  useMemo(() => {
    pruneDailyDrafts(info.day);
    // Boshqa qurilmada yechilgan natijaning sxemasi bu yerda yo'q — u holda bo'sh maydon.
    const best = dailyHistory.value[info.day]?.circuit;
    editor.load(level, getDraft(level.id) ?? (best?.gates.length ? best : emptyCircuit()), outputColumn(level.goal));
    editor.onChange = (c) => setDraft(level.id, c);
  }, [level]);

  const onSolved = async ({ circuit, gates, stars }: Solved) => {
    const { improved, prev } = recordDaily(info.day, circuit, gates, stars);
    const base: Result = { stars, gates, improved, prevGates: prev?.gates };
    result.value = base;
    const server = await submitDaily(info.day, circuit);
    if (result.value) result.value = { ...base, server };
  };

  return (
    <Workbench
      level={level}
      editor={editor}
      title={t.daily.title}
      sub={t.daily.sub(info.number, dayLabel(info.day), t.daily.tiers[info.puzzle.tier] ?? '')}
      onBack={() => go('')}
      onSolved={onSolved}
    >
      {result.value && (
        <DailySuccess
          info={info}
          level={level}
          result={result.value}
          onAgain={() => (result.value = null)}
          onJoined={async () => {
            const server = await submitDaily(info.day, editor.circuit.value);
            if (result.value) result.value = { ...result.value, server };
          }}
        />
      )}
    </Workbench>
  );
}

function untilNext(nextAt: number): string {
  const min = Math.max(1, Math.ceil((nextAt * 1000 - Date.now()) / 60000));
  return t.daily.hours(Math.floor(min / 60), min % 60);
}

function DailySuccess({ info, level, result, onAgain, onJoined }: {
  info: DailyInfo;
  level: Level;
  result: Result;
  onAgain: () => void;
  onJoined: () => void;
}) {
  const server = result.server;
  // Natija oynasida eng yaxshi natija ulashiladi (yomonroq urinish rekordni yashirmasin).
  const best = dailyHistory.value[info.day] ?? result;

  useEffect(() => {
    for (let i = 0; i < result.stars; i++) setTimeout(() => sfx.star(i), 350 + i * 180);
  }, []);

  return (
    <Modal onClose={onAgain}>
      <h2 class="success-title">{t.daily.solved}</h2>
      <Stars n={result.stars} size="lg" />
      <p>{t.success.gates(result.gates, level.goal)}</p>
      {result.stars < 3 && <p class="muted">{t.success.tryFewer(level.goal)}</p>}
      {result.improved && result.prevGates !== undefined && <p class="good">{t.success.improved}</p>}
      {streak.value > 0 && <p class="streak">{t.daily.streak(streak.value)}</p>}

      <div class="server-info">
        {profile.value ? (
          server === undefined ? (
            <p class="muted">{t.loading}</p>
          ) : server === null ? (
            <p class="muted">{t.success.offline}</p>
          ) : (
            <>
              <p>{server.best.rank === 1 ? t.daily.first : t.daily.rank(server.best.rank, server.solvers)}</p>
              {server.best.gates > server.bestGates && <p class="muted">{t.daily.best(server.bestGates)}</p>}
            </>
          )
        ) : (
          <>
            <p class="muted">{t.daily.joinHint}</p>
            <JoinForm compact onJoined={onJoined} />
          </>
        )}
      </div>

      <ShareButtons text={dailyShareText(info, best.gates, best.stars, streak.value)} path="#/daily" />
      <p class="muted small">{t.daily.next(untilNext(info.nextAt))}</p>

      <div class="modal-actions">
        <button class="btn" onClick={onAgain}>
          {t.success.again}
        </button>
        <button class="btn primary" onClick={() => go('leaderboard/daily')} autoFocus>
          {t.daily.toBoard}
        </button>
      </div>
    </Modal>
  );
}
