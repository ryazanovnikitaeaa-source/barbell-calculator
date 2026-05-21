const KG_TO_LBS = 2.20462;
const PLATES_LBS = [45, 35, 25, 10, 5, 2.5];
const MIN_PLATE_LBS = 2.5;
const OVER_UNFAVORABLE_KG = 5;
const OVER_HIDE_KG = 20;

const PLATE_CLASS = {
  45: 'plate-45',
  35: 'plate-35',
  25: 'plate-25',
  10: 'plate-10',
  5: 'plate-5',
  2.5: 'plate-2_5',
};

/** @type {Record<string, HTMLElement | null>} */
const els = {};

let selectedBarKg = 20;

function $(id) {
  return document.getElementById(id);
}

function cacheElements() {
  els.bar18 = $('bar-18');
  els.bar20 = $('bar-20');
  els.targetWeight = $('target-weight');
  els.calculateBtn = $('calculate-btn');
  els.results = $('results');
  els.errorMsg = $('error-msg');
  els.variantUnder = $('variant-under');
  els.variantOver = $('variant-over');
  els.underTitle = $('under-title');
  els.overTitle = $('over-title');
  els.vizUnder = $('barbell-viz-under');
  els.vizOver = $('barbell-viz-over');
  els.plateListUnder = $('plate-list-under');
  els.plateListOver = $('plate-list-over');
  els.overWarning = $('over-warning');
}

function assertElements() {
  const required = [
    ['bar-18', els.bar18],
    ['bar-20', els.bar20],
    ['target-weight', els.targetWeight],
    ['calculate-btn', els.calculateBtn],
    ['results', els.results],
    ['error-msg', els.errorMsg],
    ['variant-under', els.variantUnder],
    ['variant-over', els.variantOver],
    ['under-title', els.underTitle],
    ['over-title', els.overTitle],
    ['barbell-viz-under', els.vizUnder],
    ['barbell-viz-over', els.vizOver],
    ['plate-list-under', els.plateListUnder],
    ['plate-list-over', els.plateListOver],
    ['over-warning', els.overWarning],
  ];

  const missing = required.filter(([, node]) => !node).map(([id]) => id);
  if (missing.length) {
    console.error('[Barbell Calculator] Не найдены элементы:', missing.join(', '));
    return false;
  }
  return true;
}

function kgToLbs(kg) {
  return kg * KG_TO_LBS;
}

function lbsToKg(lbs) {
  return lbs / KG_TO_LBS;
}

function selectBar(kg) {
  selectedBarKg = kg;
  els.bar18.classList.toggle('active', kg === 18);
  els.bar20.classList.toggle('active', kg === 20);
}

function getSelectedBarKg() {
  if (els.bar18?.classList.contains('active')) return 18;
  if (els.bar20?.classList.contains('active')) return 20;
  return selectedBarKg;
}

function greedyPlates(perSideLbs) {
  const plates = [];
  let remainderLbs = perSideLbs;

  for (const plateLbs of PLATES_LBS) {
    const count = Math.floor(remainderLbs / plateLbs + 1e-9);
    if (count > 0) {
      plates.push({ weight: plateLbs, count });
      remainderLbs = Math.round((remainderLbs - count * plateLbs) * 10000) / 10000;
    }
  }

  return { plates, remainderLbs: Math.max(0, remainderLbs) };
}

function clonePlates(plates) {
  return plates.map(({ weight, count }) => ({ weight, count }));
}

function addMinPlateStep(plates) {
  const next = clonePlates(plates);
  const existing = next.find((p) => p.weight === MIN_PLATE_LBS);

  if (existing) {
    existing.count += 1;
  } else {
    next.push({ weight: MIN_PLATE_LBS, count: 1 });
  }

  return next;
}

function platesPerSideLbs(plates) {
  return plates.reduce((sum, { weight, count }) => sum + weight * count, 0);
}

function totalBarKg(barKg, plates) {
  return barKg + 2 * lbsToKg(platesPerSideLbs(plates));
}

function buildVariant(barKg, plates, targetKg) {
  const totalKg = totalBarKg(barKg, plates);
  const diffUnder = Math.max(0, targetKg - totalKg);
  const diffOver = Math.max(0, totalKg - targetKg);

  return {
    plates,
    totalKg,
    diffUnderKg: diffUnder,
    diffOverKg: diffOver,
  };
}

/**
 * Недобор: жадный подбор <= цели.
 * Перебор: недобор + 1×2.5 lbs на сторону (минимальный шаг вверх).
 */
function calculateVariants(totalKg) {
  const barKg = getSelectedBarKg();
  selectedBarKg = barKg;

  const perSideKg = (totalKg - barKg) / 2;
  const perSideLbs = kgToLbs(Math.max(0, perSideKg));

  const underGreedy = greedyPlates(perSideLbs);
  const underPlates = underGreedy.plates;
  const overPlates = addMinPlateStep(underPlates);

  const under = buildVariant(barKg, underPlates, totalKg);
  const over = buildVariant(barKg, overPlates, totalKg);

  return {
    targetKg: totalKg,
    barKg,
    under,
    over,
  };
}

function formatPlateName(lbs) {
  return lbs === 2.5 ? '2.5' : String(lbs);
}

function formatKg(value) {
  return value.toFixed(2);
}

function formatUnderTitle(variant, targetKg) {
  if (variant.diffUnderKg <= 0.005) {
    return `Недобор: ${formatKg(variant.totalKg)} кг (совпадает с целью)`;
  }
  return `Недобор: ${formatKg(variant.totalKg)} кг (−${formatKg(variant.diffUnderKg)} кг)`;
}

function formatOverTitle(variant) {
  if (variant.diffOverKg > 0.005) {
    return `Перебор: ${formatKg(variant.totalKg)} кг (+${formatKg(variant.diffOverKg)} кг)`;
  }
  const short = variant.diffUnderKg;
  if (short > 0.005) {
    return `Перебор: ${formatKg(variant.totalKg)} кг (ещё −${formatKg(short)} кг до цели)`;
  }
  return `Перебор: ${formatKg(variant.totalKg)} кг (шаг +2.5 lbs на сторону)`;
}

function createPlateElement(weight) {
  const plate = document.createElement('div');
  plate.className = `plate ${PLATE_CLASS[weight]}`;
  plate.dataset.plateWeight = String(weight);
  plate.title = `${formatPlateName(weight)} lbs`;

  const label = document.createElement('span');
  label.className = 'plate-label';
  label.textContent = formatPlateName(weight);
  plate.appendChild(label);

  return plate;
}

function renderBarbell(container, plates) {
  container.innerHTML = '';

  const barbell = document.createElement('div');
  barbell.className = 'barbell';

  const leftSide = document.createElement('div');
  leftSide.className = 'barbell-side left';

  const rightSide = document.createElement('div');
  rightSide.className = 'barbell-side right';

  const leftCollar = document.createElement('div');
  leftCollar.className = 'collars';
  leftCollar.setAttribute('aria-hidden', 'true');

  const rightCollar = document.createElement('div');
  rightCollar.className = 'collars';
  rightCollar.setAttribute('aria-hidden', 'true');

  const leftSleeve = document.createElement('div');
  leftSleeve.className = 'bar-sleeve';
  const rightSleeve = document.createElement('div');
  rightSleeve.className = 'bar-sleeve';

  leftSide.appendChild(leftSleeve);
  rightSide.appendChild(rightSleeve);

  plates.forEach(({ weight, count }) => {
    for (let i = 0; i < count; i++) {
      leftSide.appendChild(createPlateElement(weight));
      rightSide.appendChild(createPlateElement(weight));
    }
  });

  leftSide.appendChild(leftCollar);
  rightSide.appendChild(rightCollar);

  const shaft = document.createElement('div');
  shaft.className = 'bar-shaft';
  const knurl = document.createElement('div');
  knurl.className = 'bar-knurl';
  shaft.appendChild(knurl);

  barbell.appendChild(leftSide);
  barbell.appendChild(shaft);
  barbell.appendChild(rightSide);

  container.appendChild(barbell);
}

function clearHighlights(vizEl, listEl) {
  vizEl.querySelectorAll('.plate.highlight').forEach((p) => p.classList.remove('highlight'));
  listEl.querySelectorAll('.plate-list-item.is-hovered').forEach((i) => i.classList.remove('is-hovered'));
}

function bindHighlight(vizEl, listEl, weight) {
  const key = String(weight);
  clearHighlights(vizEl, listEl);

  vizEl.querySelectorAll('.plate').forEach((plate) => {
    if (plate.dataset.plateWeight === key) plate.classList.add('highlight');
  });

  listEl.querySelectorAll('.plate-list-item').forEach((item) => {
    if (item.dataset.plateWeight === key) item.classList.add('is-hovered');
  });
}

function renderPlateList(listEl, vizEl, plates) {
  listEl.innerHTML = '';

  if (!plates.length) {
    const li = document.createElement('li');
    li.textContent = 'Блины не требуются (только гриф).';
    listEl.appendChild(li);
    return;
  }

  plates.forEach(({ weight, count }) => {
    const li = document.createElement('li');
    li.className = 'plate-list-item';
    li.dataset.plateWeight = String(weight);
    li.textContent = `${formatPlateName(weight)} lbs × ${count} (на сторону)`;

    li.addEventListener('mouseenter', () => bindHighlight(vizEl, listEl, weight));
    li.addEventListener('mouseleave', () => clearHighlights(vizEl, listEl));

    listEl.appendChild(li);
  });
}

function animateVisual(vizEl) {
  vizEl.classList.remove('visible');
  void vizEl.offsetWidth;
  requestAnimationFrame(() => vizEl.classList.add('visible'));
}

function renderResults(data) {
  const { under, over, targetKg } = data;

  els.underTitle.textContent = formatUnderTitle(under, targetKg);

  renderBarbell(els.vizUnder, under.plates);
  renderPlateList(els.plateListUnder, els.vizUnder, under.plates);
  animateVisual(els.vizUnder);

  els.variantUnder.classList.remove('hidden');

  const overDiff = over.diffOverKg;
  const hideOver = overDiff > OVER_HIDE_KG;

  if (hideOver) {
    els.variantOver.classList.add('hidden');
    return;
  }

  els.variantOver.classList.remove('hidden');
  els.overTitle.textContent = formatOverTitle(over);

  const unfavorable = overDiff > OVER_UNFAVORABLE_KG;
  els.variantOver.classList.toggle('variant-card--unfavorable', unfavorable);

  if (unfavorable) {
    els.overWarning.textContent = 'Невыгодный вариант: перебор больше 5 кг';
    els.overWarning.classList.remove('hidden');
  } else {
    els.overWarning.textContent = '';
    els.overWarning.classList.add('hidden');
  }

  renderBarbell(els.vizOver, over.plates);
  renderPlateList(els.plateListOver, els.vizOver, over.plates);
  animateVisual(els.vizOver);
}

function showError(message) {
  els.results.classList.add('hidden');
  els.errorMsg.textContent = message;
  els.errorMsg.classList.remove('hidden');
}

function hideError() {
  els.errorMsg.classList.add('hidden');
}

function handleCalculate() {
  hideError();

  const raw = els.targetWeight.value.trim();
  if (!raw) {
    showError('Введите целевой вес в кг.');
    return;
  }

  const totalKg = parseFloat(raw.replace(',', '.'));
  if (Number.isNaN(totalKg) || totalKg <= 0) {
    showError('Введите корректное положительное число.');
    return;
  }

  if (totalKg <= getSelectedBarKg()) {
    showError('Целевой вес должен быть больше веса грифа.');
    return;
  }

  const data = calculateVariants(totalKg);

  els.results.classList.remove('hidden');
  renderResults(data);
}

function bindEvents() {
  els.bar18.addEventListener('click', () => {
    selectBar(18);
    if (els.targetWeight.value.trim()) handleCalculate();
  });

  els.bar20.addEventListener('click', () => {
    selectBar(20);
    if (els.targetWeight.value.trim()) handleCalculate();
  });

  els.calculateBtn.addEventListener('click', handleCalculate);

  els.targetWeight.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCalculate();
  });
}

function init() {
  cacheElements();
  if (!assertElements()) return;
  selectBar(20);
  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
