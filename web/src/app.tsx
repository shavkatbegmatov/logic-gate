import { useEffect } from 'preact/hooks';
import { Toast } from './components/Toast';
import { route } from './router';
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
  return (
    <>
      {r.name === 'home' && <Home />}
      {r.name === 'levels' && <LevelsScreen />}
      {r.name === 'level' && <LevelScreen id={r.id} />}
      {r.name === 'sandbox' && <Sandbox />}
      {r.name === 'leaderboard' && <Leaderboard />}
      {r.name === 'settings' && <Settings />}
      <Toast />
    </>
  );
}
