/* kv-embers.js — KV 캐릭터 위 / 타이틀 아래에 떠다니는 불티 파티클
   (2d-canvas-image-particles 라이브러리, index.html에서 CDN 스크립트로 로드)

   velocityAngle: 0=오른쪽, 90=아래, 180=왼쪽, 270=위 (캔버스 좌표계, 시계방향)
   → 270 근처로 잡아서 아래에서 위로 솟아오르게 함.
   위로 못 올라오는 범위는 JS가 아니라 캔버스 자체 높이(#kvEmbers, style.scss)로 제한 */
(function () {
  'use strict';

  if (
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  if (typeof ParticleSystem === 'undefined' || typeof CursorMode === 'undefined') {
    return;
  }

  var canvas = document.getElementById('kvEmbers');
  if (!canvas) return;

  var SPRITE = 'assets/images/particle.webp';

  // 크고 느린 불티 (큰 요소)
  new ParticleSystem('kvEmbers', SPRITE, {
    maxParticles: 10,
    cursorMode: CursorMode.None,
    velocityAngle: [245, 295],
    speed: [60, 180],
    width: [4, 10],
    height: [4, 20],
    opacity: [.5]

  });

  // 크기가 뒤섞인 중간 불티
  new ParticleSystem('kvEmbers', SPRITE, {
    maxParticles: 18,
    cursorMode: CursorMode.Light,
    velocityAngle: [230, 310],
    speed: [60, 120],
    width: [1, 14],
    height: [1, 16]
  });

  // 빠르게 솟는 작은 잔불티(밀도 기반)
  new ParticleSystem('kvEmbers', SPRITE, {
    cursorMode: CursorMode.Light,
    velocityAngle: [255, 285],
    speed: [220, 280],
    width: [1, 6],
    height: [1, 7],
    density: 0.08
  });
})();
