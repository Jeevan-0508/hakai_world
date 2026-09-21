// Opening sequence — section 5. Black screen, ambient sound, slow fade, minimal text.
export function runIntro(audio, onDone) {
  const boot = document.getElementById('boot');
  const cine = document.getElementById('cinematic');
  const hud = document.getElementById('hud');
  const l1 = document.getElementById('cine-line1');
  const l2 = document.getElementById('cine-line2');
  const l3 = document.getElementById('cine-line3');

  boot.addEventListener('click', () => {
    audio.init();
    boot.classList.add('hidden');
    cine.classList.remove('hidden');
    [l1, l2, l3].forEach((l) => (l.style.transition = 'opacity 1.6s ease'));

    setTimeout(() => { l1.style.opacity = 1; }, 300);
    setTimeout(() => { l2.style.opacity = 1; }, 1800);
    setTimeout(() => { l3.style.opacity = 1; }, 3000);
    setTimeout(() => {
      [l1, l2, l3].forEach((l) => (l.style.opacity = 0));
    }, 5600);
    setTimeout(() => {
      cine.classList.add('hidden');
      hud.classList.remove('hidden');
      onDone();
    }, 7200);
  }, { once: true });
}
