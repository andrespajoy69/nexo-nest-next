const slides = [...document.querySelectorAll('.slide')];
const contador = document.getElementById('contador');
const barra = document.getElementById('barra');
const anterior = document.getElementById('anterior');
const siguiente = document.getElementById('siguiente');

let actual = 0;

function mostrar(indice) {
  actual = Math.max(0, Math.min(slides.length - 1, indice));
  slides.forEach((slide, i) => slide.classList.toggle('activa', i === actual));
  contador.textContent = `${actual + 1} / ${slides.length}`;
  barra.style.width = `${((actual + 1) / slides.length) * 100}%`;
  history.replaceState(null, '', `#${actual + 1}`);
}

anterior.addEventListener('click', () => mostrar(actual - 1));
siguiente.addEventListener('click', () => mostrar(actual + 1));

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault();
    mostrar(actual + 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    mostrar(actual - 1);
  } else if (e.key === 'Home') {
    mostrar(0);
  } else if (e.key === 'End') {
    mostrar(slides.length - 1);
  }
});

const inicial = Number(location.hash.replace('#', '')) || 1;
mostrar(inicial - 1);
