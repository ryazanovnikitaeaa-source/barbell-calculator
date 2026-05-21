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
  els.visualization = $('barbell-viz');
  els.summaryLine = $('summary-line');
  els.plateList = $('plate-list');
  els.remainderInfo = $('remainder-info');
}

function assertElements() {
  const required = [
    ['bar-18', els.bar18],
    ['bar-20', els.bar20],
    ['target-weight', els.targetWeight],
    ['calculate-btn', els.calculateBtn],
    ['results', els.results],
    ['error-msg', els.errorMsg],
    ['barbell-viz', els.visualization],
    ['summary-line', els.summaryLine],
    ['plate-list', els.plateList],
    ['remainder-info', els.remainderInfo],
  ];

  const missing = required.filter(([, node]) => !node).map(([id]) => id);
  if (missing.length) {
    console.error('[Barbell Vibe] Не найдены элементы:', missing.join(', '));
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

  return {
    plates,
    remainderLbs: Math.max(0, remainderLbs),
  };
}

function clonePlates(plates) {
  return plates.map(({ weight, count }) => ({ weight, count }));
}

/** Следующий шаг вверх: +1 блин 2.5 lbs на каждую сторону */
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
  const perSideKg = lbsToKg(platesPerSideLbs(plates));
  return barKg + 2 * perSideKg;
}

/**
 * 1) Чистый вес блинов на сторону в кг: (целевой − гриф) / 2
 * 2) Конвертация в lbs
 * 3) Жадный подбор (недобор) + шаг перебора (+2.5 lbs/сторону)
 */
function calculatePlatesPerSide(totalKg) {
  const barKg = getSelectedBarKg();
  selectedBarKg = barKg;

  const perSideKg = (totalKg - barKg) / 2;
  const perSideLbs = kgToLbs(Math.max(0, perSideKg));

  const underResult = greedyPlates(perSideLbs);
  const underPlates = underResult.plates;
  const overPlates = addMinPlateStep(underPlates);

  const underTotalKg = totalBarKg(barKg, underPlates);
  const overTotalKg = totalBarKg(barKg, overPlates);

  const underDiffKg = Math.max(0, totalKg - underTotalKg);
  const overDiffKg = Math.max(0, overTotalKg - totalKg);

  return {
    plates: underPlates,
    totalKg,
    barKg,
    perSideKg,
    perSideLbs,
    remainderLbs: underResult.remainderLbs,
    under: {
      totalKg: underTotalKg,
      diffKg: underDiffKg,
      perSideShortKg: lbsToKg(underResult.remainderLbs),
    },
    over: {
      totalKg: overTotalKg,
      diffKg: overDiffKg,
      plates: overPlates,
    },
  };
}

function formatPlateName(lbs) {
  return lbs === 2.5 ? '2.5' : String(lbs);
}

function formatKg(value) {
  return value.toFixed(2);
}

function buildSummaryText(plates) {
  if (!plates.length) {
    return 'На каждую сторону: только гриф (без блинов).';
  }

  const parts = plates.map(
    ({ weight, count }) => `${count} по ${formatPlateName(weight)} lbs`
  );

  return `На каждую сторону: ${parts.join(', ')}.`;
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

function clearPlateHighlights() {
  els.visualization.querySelectorAll('.plate.highlight').forEach((plate) => {
    plate.classList.remove('highlight');
  });
  els.plateList.querySelectorAll('.plate-list-item.is-hovered').forEach((item) => {
    item.classList.remove('is-hovered');
  });
}

function highlightPlates(weight) {
  const weightKey = String(weight);
  clearPlateHighlights();

  els.visualization.querySelectorAll('.plate').forEach((plate) => {
    if (plate.dataset.plateWeight === weightKey) {
      plate.classList.add('highlight');
    }
  });

  els.plateList.querySelectorAll('.plate-list-item').forEach((item) => {
    if (item.dataset.plateWeight === weightKey) {
      item.classList.add('is-hovered');
    }
  });
}

function showVisualContainer() {
  const viz = els.visualization;
  viz.classList.remove('visible');
  void viz.offsetWidth;
  requestAnimationFrame(() => {
    viz.classList.add('visible');
  });
}

function renderBarbell(plates) {
  const container = els.visualization;
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

function renderPlateList(plates) {
  els.plateList.innerHTML = '';

  if (!plates.length) {
    const li = document.createElement('li');
    li.textContent = 'Блины не требуются.';
    els.plateList.appendChild(li);
    return;
  }

  plates.forEach(({ weight, count }) => {
    const li = document.createElement('li');
    li.className = 'plate-list-item';
    li.dataset.plateWeight = String(weight);
    li.textContent = `${formatPlateName(weight)} lbs × ${count} (на сторону)`;

    li.addEventListener('mouseenter', () => highlightPlates(weight));
    li.addEventListener('mouseleave', clearPlateHighlights);

    els.plateList.appendChild(li);
  });
}

function getUnderColorClass(diffKg) {
  if (diffKg < 0.2) return 'remainder-low';
  if (diffKg > 0.5) return 'remainder-high';
  return 'remainder-mid';
}

function renderRemainderInfo(result) {
  const wrap = els.remainderInfo;
  const { under, over, totalKg } = result;

  wrap.innerHTML = '';
  wrap.className = 'remainder-wrap';

  const hasUnderGap = under.diffKg > 0.005;
  const hideOver = over.diffKg > OVER_HIDE_KG;

  const underEl = document.createElement('p');
  underEl.className = 'remainder-block remainder-under';

  if (hasUnderGap) {
    underEl.textContent = `Недобор: ${formatKg(under.totalKg)} кг (−${formatKg(under.diffKg)} кг)`;
    underEl.classList.add(getUnderColorClass(under.diffKg));
  } else {
    underEl.textContent = `Недобор: ${formatKg(under.totalKg)} кг (совпадает с целью ${formatKg(totalKg)} кг)`;
    underEl.classList.add('remainder-low');
  }

  wrap.appendChild(underEl);

  if (hideOver) {
    wrap.classList.remove('hidden');
    return;
  }

  const overEl = document.createElement('p');
  overEl.className = 'remainder-block remainder-over';

  if (over.diffKg > 0.005) {
    overEl.textContent = `Перебор: ${formatKg(over.totalKg)} кг (+${formatKg(over.diffKg)} кг)`;
    if (over.diffKg > OVER_UNFAVORABLE_KG) {
      overEl.classList.add('remainder-unfavorable');
      overEl.textContent += ' · невыгодно';
    }
  } else {
    const stillUnder = totalKg - over.totalKg;
    if (stillUnder > 0.005) {
      overEl.textContent = `Перебор: ${formatKg(over.totalKg)} кг (следующий шаг +2.5 lbs/сторону, ещё −${formatKg(stillUnder)} кг)`;
    } else {
      overEl.textContent = `Перебор: ${formatKg(over.totalKg)} кг (следующий шаг +2.5 lbs/сторону)`;
    }
  }

  wrap.appendChild(overEl);
  wrap.classList.remove('hidden');
}

function showError(message) {
  els.results.classList.add('hidden');
  els.visualization.classList.remove('visible');
  clearPlateHighlights();
  els.remainderInfo.innerHTML = '';
  els.remainderInfo.classList.add('hidden');
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

  const result = calculatePlatesPerSide(totalKg);

  els.results.classList.remove('hidden');
  els.visualization.classList.remove('visible');
  renderBarbell(result.plates);
  els.summaryLine.textContent = buildSummaryText(result.plates);
  renderPlateList(result.plates);
  renderRemainderInfo(result);
  showVisualContainer();
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

  els.targetWeight.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleCalculate();
  });
}

function init() {
  cacheElements();

  if (!assertElements()) {
    return;
  }

  selectBar(20);
  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
