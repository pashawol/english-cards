import { clearMascotAmbient, scheduleMascotAmbient } from './mascot.js';

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');

  const footer = document.querySelector('.app-footer');
  if (footer) footer.classList.toggle('visible', id === 'home-screen' || id === 'table-screen');

  if (id === 'study-screen') scheduleMascotAmbient();
  else clearMascotAmbient();
}
