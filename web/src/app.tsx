import { Fragment } from 'preact';
import { useEffect } from 'preact/hooks';
import { Toast } from './components/Toast';
import { lang } from './i18n';
import { route } from './router';
import './achievements';
import { Achievements } from './screens/Achievements';
import { CustomScreen } from './screens/CustomScreen';
import { DailyScreen } from './screens/DailyScreen';
import { Home } from './screens/Home';
import { Leaderboard } from './screens/Leaderboard';
import { LevelScreen } from './screens/LevelScreen';
import { LevelsScreen } from './screens/LevelsScreen';
import { Sandbox } from './screens/Sandbox';
import { Settings } from './screens/Settings';
import { syncProgress } from './sync';

export function App() {
  useEffect(() => {
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
      {r.name === 'sandbox' && <Sandbox />}
      {r.name === 'leaderboard' && <Leaderboard tab={r.tab} />}
      {r.name === 'daily' && <DailyScreen />}
      {r.name === 'achievements' && <Achievements />}
      {r.name === 'custom' && <CustomScreen key={r.code} code={r.code} />}
      {r.name === 'settings' && <Settings />}
      <Toast />
    </Fragment>
  );
}
