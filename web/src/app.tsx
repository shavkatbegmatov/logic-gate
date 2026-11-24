import { Fragment } from 'preact';
import { useEffect, useErrorBoundary, useRef } from 'preact/hooks';
import { cancelConfirm, ConfirmHost } from './components/Dialogs';
import { LostProfile } from './components/LostProfile';
import { NewProfileCode } from './components/NewProfileCode';
import { showToast, Toast } from './components/Toast';
import { reportCaught } from './errors';
import { imported } from './migrate';
import { lang, t } from './i18n';
import { go, route } from './router';
import './achievements';
import { DailyScreen } from './screens/DailyScreen';
import { Home } from './screens/Home';
import { lazy } from './components/lazy';
import { ClassScreen } from './screens/ClassScreen';
import { LevelScreen } from './screens/LevelScreen';
import { LevelsScreen } from './screens/LevelsScreen';
import { syncProgress } from './sync';

// Kam ochiladigan ekranlar — alohida bo'lakda (components/lazy.tsx).
const LessonScreen = lazy(() => import('./screens/LessonScreen').then((m) => m.LessonScreen));
const CertificateScreen = lazy(() => import('./screens/CertificateScreen').then((m) => m.CertificateScreen));
const TeacherScreen = lazy(() => import('./screens/TeacherScreen').then((m) => m.TeacherScreen));
const TeacherReport = lazy(() => import('./screens/TeacherScreen').then((m) => m.TeacherReport));
// Yangiliklar ro'yxati (changelog.ts) har relizda uzayadi — bosh yuklamada emas.
const NewsScreen = lazy(() => import('./screens/NewsScreen').then((m) => m.NewsScreen));
// Qum quti (formula tahlilchisi va yig'uvchisi bilan), reyting, kunlik arxiv, yutuqlar ro'yxati va do'st
// masalasi — ochilishda kerak emas (2.14.0: simlar yo'naltirgichi bosh yuklamaga qo'shilgach).
const Sandbox = lazy(() => import('./screens/Sandbox').then((m) => m.Sandbox));
const Leaderboard = lazy(() => import('./screens/Leaderboard').then((m) => m.Leaderboard));
const ArchiveScreen = lazy(() => import('./screens/ArchiveScreen').then((m) => m.ArchiveScreen));
const Achievements = lazy(() => import('./screens/Achievements').then((m) => m.Achievements));
const CustomScreen = lazy(() => import('./screens/CustomScreen').then((m) => m.CustomScreen));
// Sozlamalar (mavzu tanlagichi, sinflar, qo'llanmalar) — 2.17.0: ikki yangi mavzu bosh yuklamani chegaraga yetkazgach.
const Settings = lazy(() => import('./screens/Settings').then((m) => m.Settings));
// Sinf musobaqasi — faqat dars paytida.
const ContestScreen = lazy(() => import('./screens/ContestScreen').then((m) => m.ContestScreen));
// O'qituvchi tarqatmasi (QR-kod) — kamdan-kam: chop etish oldidan.
const HandoutScreen = lazy(() => import('./screens/HandoutScreen').then((m) => m.HandoutScreen));

export function App() {
  useEffect(() => {
    if (imported > 0) showToast(t.migrate.done, 'ok', 5000);
    // Ilova ochilganda yuborilmagan natijalar jo'natiladi; aloqa bo'lmasa — jim.
    syncProgress().catch(() => {});
    const onOnline = () => syncProgress().catch(() => {});
    addEventListener('online', onOnline);
    // Boshqa ekranga o'tilsa (orqaga tugmasi, Telegram sarlavhasi), ochiq savol o'z ekrani bilan birga yopiladi.
    const offRoute = route.subscribe(cancelConfirm);
    return () => {
      removeEventListener('online', onOnline);
      offRoute();
    };
  }, []);

  // Til almashganda butun daraxt qayta quriladi — keshlangan matnlar ham yangilanadi.
  return (
    <Fragment key={lang.value}>
      <Guarded />
      <LostProfile />
      <NewProfileCode />
      <ConfirmHost />
      <Toast />
    </Fragment>
  );
}

/**
 * Ekran chizishda xato chiqsa — oq ekran o'rniga qaytish yo'li. Marshrut almashsa, xato holati
 * tozalanadi (boshqa ekran ishlashi mumkin).
 */
function Guarded() {
  const [error, resetError] = useErrorBoundary(reportCaught);
  const name = route.value.name;
  const failedOn = useRef<string | null>(null);
  if (error && failedOn.current === null) failedOn.current = name;
  useEffect(() => {
    if (error && failedOn.current !== name) {
      failedOn.current = null;
      resetError();
    }
  }, [name]);
  if (error) {
    return (
      <div class="screen crash" role="alert">
        <h1>{t.crash.title}</h1>
        <p class="muted">{t.crash.text}</p>
        <div class="crash-actions">
          <button class="btn primary" onClick={() => (route.value.name === 'home' ? location.reload() : go(''))}>
            {t.crash.home}
          </button>
          <button class="btn" onClick={() => location.reload()}>
            {t.crash.reload}
          </button>
        </div>
      </div>
    );
  }
  return <Routes />;
}

function Routes() {
  const r = route.value;
  return (
    <Fragment>
      {r.name === 'home' && <Home />}
      {r.name === 'levels' && <LevelsScreen />}
      {r.name === 'level' && <LevelScreen id={r.id} />}
      {r.name === 'sandbox' && <Sandbox formula={r.formula} />}
      {r.name === 'leaderboard' && <Leaderboard tab={r.tab} />}
      {r.name === 'daily' && <DailyScreen key={r.day ?? 'today'} day={r.day} />}
      {r.name === 'archive' && <ArchiveScreen />}
      {r.name === 'lesson' && <LessonScreen key={r.id} id={r.id} />}
      {r.name === 'class' && <ClassScreen key={r.code} code={r.code} />}
      {r.name === 'news' && <NewsScreen />}
      {r.name === 'certificate' && <CertificateScreen />}
      {r.name === 'teacher' && (r.code ? <TeacherReport key={r.code} code={r.code} /> : <TeacherScreen />)}
      {r.name === 'handout' && <HandoutScreen key={r.code} code={r.code} />}
      {r.name === 'achievements' && <Achievements />}
      {r.name === 'custom' && <CustomScreen key={r.code} code={r.code} />}
      {r.name === 'settings' && <Settings />}
      {r.name === 'contest' && <ContestScreen key={`${r.code}/${r.level ?? ''}`} code={r.code} level={r.level} />}
    </Fragment>
  );
}
