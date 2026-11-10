import { Fragment } from 'preact';
import { useEffect } from 'preact/hooks';
import { NewProfileCode } from './components/NewProfileCode';
import { showToast, Toast } from './components/Toast';
import { imported } from './migrate';
import { lang, t } from './i18n';
import { route } from './router';
import './achievements';
import { Achievements } from './screens/Achievements';
import { ArchiveScreen } from './screens/ArchiveScreen';
import { CustomScreen } from './screens/CustomScreen';
import { DailyScreen } from './screens/DailyScreen';
import { Home } from './screens/Home';
import { lazy } from './components/lazy';
import { ClassScreen } from './screens/ClassScreen';
import { Leaderboard } from './screens/Leaderboard';
import { LevelScreen } from './screens/LevelScreen';
import { LevelsScreen } from './screens/LevelsScreen';
import { Sandbox } from './screens/Sandbox';
import { Settings } from './screens/Settings';
import { syncProgress } from './sync';

// Kam ochiladigan ekranlar — alohida bo'lakda (components/lazy.tsx).
const LessonScreen = lazy(() => import('./screens/LessonScreen').then((m) => m.LessonScreen));
const CertificateScreen = lazy(() => import('./screens/CertificateScreen').then((m) => m.CertificateScreen));
const TeacherScreen = lazy(() => import('./screens/TeacherScreen').then((m) => m.TeacherScreen));
const TeacherReport = lazy(() => import('./screens/TeacherScreen').then((m) => m.TeacherReport));
// Yangiliklar ro'yxati (changelog.ts) har relizda uzayadi — bosh yuklamada emas.
const NewsScreen = lazy(() => import('./screens/NewsScreen').then((m) => m.NewsScreen));

export function App() {
  useEffect(() => {
    if (imported > 0) showToast(t.migrate.done, 'ok', 5000);
    // Ilova ochilganda yuborilmagan natijalar jo'natiladi; aloqa bo'lmasa — jim.
    syncProgress().catch(() => {});
    const onOnline = () => syncProgress().catch(() => {});
    addEventListener('online', onOnline);
    return () => removeEventListener('online', onOnline);
  }, []);

  const r = route.value;
  // Til almashganda butun daraxt qayta quriladi — keshlangan matnlar ham yangilanadi.
  return (
    <Fragment key={lang.value}>
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
      {r.name === 'achievements' && <Achievements />}
      {r.name === 'custom' && <CustomScreen key={r.code} code={r.code} />}
      {r.name === 'settings' && <Settings />}
      <NewProfileCode />
      <Toast />
    </Fragment>
  );
}
