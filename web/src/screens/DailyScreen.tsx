import { useSignal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import type { DailyInfo, DailySolveResult } from '../api';
import { sfx } from '../audio';
import { Editor } from '../board/editor';
import { outputColumn } from '../board/geometry';
import { GateIntro } from '../components/GateIntro';
import { SpreadChart } from '../components/SpreadChart';
import { JoinForm } from '../components/JoinForm';
import { RemindToggle } from '../components/RemindToggle';
import { ShareButtons } from '../components/ShareButtons';
import { Icon, Modal, Stars, TopBar } from '../components/ui';
import {
  dailyHistory,
  dailyShareText,
  dayLabel,
  fetchDaily,
  fetchDailyDay,
  practiceHistory,
  puzzleLevel,
  recordDaily,
  recordPractice,
  streak,
  submitDaily,
  today,
} from '../daily';
import { t } from '../i18n';
import { go } from '../router';
import { emptyCircuit, type Level } from '../sim/types';
import { getDraft, markIntroSeen, profile, pruneDailyDrafts, seenIntro, setDraft } from '../state';
import { Workbench, type Solved } from './Workbench';

interface Result {
  stars: number;
  gates: number;
  improved: boolean;
  prevGates?: number;
  /** undefined — yuborilmoqda, null — yuborilmadi (profil yoki aloqa yo'q). */
  server?: DailySolveResult | null;
}

/** day — arxivdagi kun (yo'q bo'lsa — bugungi masala). */
export function DailyScreen({ day }: { day?: number }) {
  const info = useSignal<DailyInfo | null>(null);
  const failed = useSignal(false);
  const past = day !== undefined && day < today();
  const back = () => go(past ? 'archive' : '');

  const load = async () => {
    failed.value = false;
    try {
      info.value = past ? await fetchDailyDay(day) : await fetchDaily();
    } catch {
      failed.value = true;
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (info.value) return <DailyPlay key={info.value.day} info={info.value} onBack={back} />;
  return (
    <div class="screen">
      <TopBar title={t.daily.title} onBack={back} />
      <div class="scroll">
        <div class="narrow">
          {failed.value ? (
            <div class="card">
              <p>{past ? t.daily.archiveOffline : t.daily.offline}</p>
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

function DailyPlay({ info, onBack }: { info: DailyInfo; onBack: () => void }) {
  const level = useMemo(() => puzzleLevel(info), [info.day]);
  const editor = useMemo(() => new Editor(), []);
  const result = useSignal<Result | null>(null);
  // Xotira kunida D-trigger hali tanish bo'lmasa — darajalardagidek tanishtiruv kartasi.
  const intro = useSignal(level.gates.filter((g) => !seenIntro.value.includes(g)));
  // Arxivdagi yopiq kun: natija faqat shu qurilmada, seriya va reytingga kirmaydi.
  const practice = info.open === false;

  useMemo(() => {
    pruneDailyDrafts(today(), level.id);
    // Boshqa qurilmada yechilgan natijaning sxemasi bu yerda yo'q — u holda bo'sh maydon.
    const best = dailyHistory.value[info.day]?.circuit;
    editor.load(level, getDraft(level.id) ?? (best?.gates.length ? best : emptyCircuit()), outputColumn(level.goal));
    editor.onChange = (c) => setDraft(level.id, c);
  }, [level]);

  const onSolved = async ({ circuit, gates, stars }: Solved) => {
    if (practice) {
      const { improved, prev } = recordPractice(info.day, gates, stars);
      result.value = { stars, gates, improved, prevGates: prev?.gates, server: null };
      return;
    }
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
      sub={
        t.daily.sub(info.number, dayLabel(info.day), t.daily.tiers[info.puzzle.tier] ?? '') +
        (practice ? ` · ${t.daily.practiceTag}` : '')
      }
      onBack={onBack}
      onSolved={onSolved}
    >
      {intro.value.length > 0 && (
        <GateIntro
          gates={intro.value}
          onClose={() => {
            markIntroSeen(intro.value);
            intro.value = [];
          }}
        />
      )}
      {result.value && practice && (
        <PracticeSuccess info={info} level={level} result={result.value} onAgain={() => (result.value = null)} />
      )}
      {result.value && !practice && (
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
  // Arxivdan ochilgan kechagi masala: hali qabul qilinadi, lekin matnlar «bugungi» emas.
  const past = info.day < today();

  useEffect(() => {
    for (let i = 0; i < result.stars; i++) setTimeout(() => sfx.star(i), 350 + i * 180);
  }, []);

  return (
    <Modal onClose={onAgain}>
      <h2 class="success-title">{past ? t.daily.solvedPast : t.daily.solved}</h2>
      <Stars n={result.stars} size="lg" />
      <p>{t.success.gates(result.gates, level.goal)}</p>
      {result.stars < 3 && <p class="muted">{t.success.tryFewer(level.goal)}</p>}
      {result.improved && result.prevGates !== undefined && <p class="good">{t.success.improved}</p>}
      {streak.value > 0 && (
        <p class="streak">
          <Icon name="flame" /> {t.daily.streak(streak.value)}
        </p>
      )}

      <div class="server-info">
        {profile.value ? (
          server === undefined ? (
            <p class="muted">{t.loading}</p>
          ) : server === null ? (
            <p class="muted">{t.success.offline}</p>
          ) : (
            <>
              <p>
                {server.best.rank === 1
                  ? past
                    ? t.daily.firstPast
                    : t.daily.first
                  : (past ? t.daily.rankPast : t.daily.rank)(server.best.rank, server.solvers)}
              </p>
              {server.best.gates > server.bestGates && (
                <p class="muted">{(past ? t.daily.bestPast : t.daily.best)(server.bestGates)}</p>
              )}
              <SpreadChart spread={server.spread} mine={server.best.gates} />
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
      {!past && <p class="muted small">{t.daily.next(untilNext(info.nextAt))}</p>}
      <RemindToggle compact />

      <div class="modal-actions">
        <button class="btn" onClick={onAgain}>
          {t.success.again}
        </button>
        {past ? (
          <button class="btn primary" onClick={() => go('archive')} autoFocus>
            {t.daily.toArchive}
          </button>
        ) : (
          <button class="btn primary" onClick={() => go('leaderboard/daily')} autoFocus>
            {t.daily.toBoard}
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Arxivdagi yopiq kun yechilganda: natija va o'sha kungi statistika, ulashish va reytingsiz. */
function PracticeSuccess({ info, level, result, onAgain }: { info: DailyInfo; level: Level; result: Result; onAgain: () => void }) {
  const best = practiceHistory.value[info.day];

  useEffect(() => {
    for (let i = 0; i < result.stars; i++) setTimeout(() => sfx.star(i), 350 + i * 180);
  }, []);

  return (
    <Modal onClose={onAgain}>
      <h2 class="success-title">{t.daily.solvedPast}</h2>
      <Stars n={result.stars} size="lg" />
      <p>{t.success.gates(result.gates, level.goal)}</p>
      {result.stars < 3 && <p class="muted">{t.success.tryFewer(level.goal)}</p>}
      {result.improved && result.prevGates !== undefined && <p class="good">{t.success.improved}</p>}
      {!result.improved && best && <p class="muted">{t.daily.practiceBest(best.gates)}</p>}
      {info.solvers > 0 && <p class="muted">{t.daily.thatDay(info.solvers, info.bestGates)}</p>}
      <p class="muted small">{t.daily.practice}</p>

      <div class="modal-actions">
        <button class="btn" onClick={onAgain}>
          {t.success.again}
        </button>
        <button class="btn primary" onClick={() => go('archive')} autoFocus>
          {t.daily.toArchive}
        </button>
      </div>
    </Modal>
  );
}
