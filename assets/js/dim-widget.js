/* dim-widget.js — 배경 딤 조절 위젯 (개발용, 배포 시 이 파일과 #dimWidget 삭제)
   [data-dim="키"] 요소의 opacity를 0~1로 조절하고 localStorage에 저장한다. */
(function () {
  'use strict';

  var STORE = 'zeus-pica-dims-v1';
  var LABELS = {
    kv: 'KV 배경',
    hero: '미션 화면 배경',
    card: '미션 카드',
    section: '참여방법 섹션',
    mileage: '마일리지 섹션'
  };

  var widget = document.getElementById('dimWidget');
  var toggle = document.getElementById('dimToggle');
  var panel = document.getElementById('dimPanel');
  var rows = document.getElementById('dimRows');
  var reset = document.getElementById('dimReset');
  if (!widget || !rows) return;

  var dims = load();

  var DEFAULTS = { kv: 0.3, hero: 0.5, card: 0.5, section: 0.5, mileage: 0.5 };

  function load() {
    var base = {};
    Object.keys(LABELS).forEach(function (k) { base[k] = DEFAULTS[k]; });
    try {
      var raw = localStorage.getItem(STORE);
      return raw ? Object.assign(base, JSON.parse(raw)) : base;
    } catch (e) { return base; }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(dims)); } catch (e) {} }

  function apply(key) {
    document.querySelectorAll('[data-dim="' + key + '"]').forEach(function (el) {
      el.style.opacity = dims[key];
    });
  }

  Object.keys(LABELS).forEach(function (key) {
    var row = document.createElement('div');
    row.className = 'dimw__row';
    row.innerHTML =
      '<label>' + LABELS[key] + '<b>' + Math.round(dims[key] * 100) + '%</b></label>' +
      '<input type="range" min="0" max="100" step="1" value="' + Math.round(dims[key] * 100) + '">';
    var input = row.querySelector('input');
    var out = row.querySelector('b');
    input.addEventListener('input', function () {
      dims[key] = Number(input.value) / 100;
      out.textContent = input.value + '%';
      apply(key);
      save();
    });
    rows.appendChild(row);
    apply(key);
  });

  toggle.addEventListener('click', function () {
    var open = panel.hasAttribute('hidden');
    if (open) { panel.removeAttribute('hidden'); toggle.textContent = '배경 딤 닫기'; }
    else { panel.setAttribute('hidden', ''); toggle.textContent = '배경 딤 조절'; }
  });

  reset.addEventListener('click', function () {
    Object.keys(LABELS).forEach(function (k) {
      dims[k] = 0;
      apply(k);
      var row = rows.children[Object.keys(LABELS).indexOf(k)];
      row.querySelector('input').value = 0;
      row.querySelector('b').textContent = '0%';
    });
    save();
  });
})();
