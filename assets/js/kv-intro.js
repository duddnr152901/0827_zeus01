/* kv-intro.js — KV 캐릭터(좌/우/중앙)와 좌우 깃발이 각자 방향에서 슬라이드로 등장
   실제 이동/페이드는 style.css의 .kv__flag-tilt, .kv__character(2/3) img 트랜지션이 담당하고,
   이 스크립트는 jQuery로 .kv에 kv-intro-in 클래스만 붙여서 트리거한다.

   transition.js의 마우스 패럴랙스(kv-storm 등)는 [data-kv-layer] 요소(.kv__flag--left/right,
   .kv__character/2/3 자체)의 transform을 매 프레임 덮어쓰므로, 절대 같은 요소를 건드리지 않고
   그 안쪽 자식(.kv__flag-tilt, <img>)에만 transform을 줘서 서로 부딪히지 않게 분리했다. */
(function ($) {
  'use strict';

  var $kv = $('.kv').first();
  if (!$kv.length) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // CSS의 reduced-motion 블록이 이미 최종 상태로 고정해줌

  // 초기 오프셋 상태가 먼저 한 번 페인트된 뒤에 클래스를 붙여야 트랜지션이 확실히 재생됨
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      $kv.addClass('kv-intro-in');
    });
  });
})(jQuery);
