// Birinchi: eski manzildan ko'chirilgan natijalar ilova holati o'qilishidan oldin yoziladi.
import './migrate';
import { render } from 'preact';
import { App } from './app';
import './styles.css';

render(<App />, document.getElementById('app')!);
