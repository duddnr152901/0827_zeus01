/* reveal.js — 카드/타이틀 요소가 스크롤로 화면에 들어오면 살짝 떠오르며 나타나는 효과
   (jQuery로 클래스 토글, 실제 등장 감지는 IntersectionObserver) */
(function ($) {
  'use strict';

  var $targets = $('.card, .use, .head');
  if (!$targets.length) return;

  // 모바일에서는 이 슬라이드-업 애니메이션을 쓰지 않고 그냥 바로 보이게 함
  var isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

  if (
    isMobile ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    !('IntersectionObserver' in window)
  ) {
    $targets.addClass('is-visible');
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        $(entry.target).addClass('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  $targets.each(function () {
    observer.observe(this);
  });
})(jQuery);
