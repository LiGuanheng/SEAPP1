import './style.css';
import { Shell } from './ui/shell';
import { showArtPreview } from './ui/artPreview';

const boot = document.getElementById('boot-veil');
const shell = new Shell();

if (new URLSearchParams(location.search).has('art')) {
  showArtPreview(document.getElementById('ui-root') as HTMLElement);
} else {
  shell.showMenu();
}

// 首帧渲染后再揭开黑幕，避免白闪。
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    if (boot) {
      boot.classList.add('hidden');
      setTimeout(() => boot.remove(), 700);
    }
  });
});
