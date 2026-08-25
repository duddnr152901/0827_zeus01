/* transition.js — KV → SECTION 1 연기 전환
   ① KV Ken Burns(+마우스 패럴랙스)  ② 커튼 그라디언트 마스크 리빌
   ③ SECTION1 배경 110% → 100%       ④ 경계선 흰 연기(WebGL fbm) */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 768px 이하에서는 흰 연기(WebGL) 없이 커튼 마스크 리빌만으로 KV→SECTION1이 바로 이어지게 함
  var isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  var HOLD_PX = 600;   // 미션 화면 도달 후 스크롤 락 구간 (CSS .zone 높이와 함께 수정)
  var BAND = 45;       // 리빌 경계 밴드 폭(%)

  var zone = document.getElementById('zone');
  var curtain = document.getElementById('curtain');
  var curtainBg = document.getElementById('curtainBg');
  var kvCue = document.getElementById('kvCue');
  if (!zone || !curtain) return;

  /* KV 안의 [data-kv-layer] 요소마다 개별 depth(마우스 패럴랙스 강도)/zoom(스크롤 확대량)로
     따로 움직임 — 새 레이어를 추가할 땐 마크업에 data-kv-layer + data-depth + data-zoom만 붙이면 됨 */
  var kvLayers = Array.prototype.slice.call(document.querySelectorAll('.kv [data-kv-layer]')).map(function (el) {
    return {
      el: el,
      depth: parseFloat(el.dataset.depth) || 0,
      zoom: parseFloat(el.dataset.zoom) || 0
    };
  });

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* 진행률 0~1 : 존 상단이 화면 상단에 붙은 순간부터, 홀드 구간을 뺀 길이 기준 */
  function progress() {
    var total = zone.offsetHeight - window.innerHeight - HOLD_PX;
    if (total <= 0) return 0;
    return clamp(-zone.getBoundingClientRect().top / total, 0, 1);
  }

  /* ---------- ① KV Ken Burns + 마우스 패럴랙스 (레이어별 개별 적용) ---------- */
  var kvPanY = 0, kvMx = 0, kvMy = 0, tx = 0, ty = 0;

  function applyKv(p) {
    kvLayers.forEach(function (layer) {
      var scale = 1 + layer.zoom * p;
      var panY = kvPanY * layer.depth;
      layer.el.style.transform =
        'translate3d(' + (kvMx * layer.depth).toFixed(2) + 'px,' + (kvMy * layer.depth).toFixed(2) + 'px,0) ' +
        'scale(' + scale.toFixed(4) + ') translateY(' + panY.toFixed(2) + '%)';
    });
  }

  // 모바일은 frame() 루프 자체를 안 돌리지만(아래), 마우스 패럴랙스 리스너도
  // 애초에 안 붙여서 이닛패럴랙싱을 확실히 비활성화
  if (!isMobile) {
    document.addEventListener('mousemove', function (e) {
      if (reduceMotion) return;
      var r = zone.getBoundingClientRect();
      if (r.top > window.innerHeight || r.bottom < 0) return;
      // 마우스가 오른쪽/아래로 가면 레이어는 왼쪽/위로 (반대 방향) 움직이도록 부호 반전
      tx = clamp(-(((e.clientX - r.left) / r.width - 0.5) * 2), -1, 1);
      ty = clamp(-(((e.clientY - window.innerHeight / 2) / window.innerHeight) * 2), -1, 1);
    });
    document.addEventListener('mouseleave', function () { tx = 0; ty = 0; });
  }

  /* ---------- ④ 흰 연기 (WebGL) ---------- */
  function initSmoke() {
    var canvas = document.getElementById('smoke');
    if (!canvas || reduceMotion || isMobile) { if (canvas) canvas.style.display = 'none'; return function () {}; }

    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
    if (!gl) { canvas.style.display = 'none'; return function () {}; }

    var vs = 'attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos,0.0,1.0); }';
    var fs = [
      'precision mediump float;',
      'uniform vec2 u_resolution; uniform float u_time; uniform float u_boundary; uniform float u_intensity;',
      'float random(vec2 st){ return fract(sin(dot(st, vec2(12.9898,78.233)))*43758.5453123); }',
      'float noise(vec2 st){ vec2 i=floor(st); vec2 f=fract(st);',
      '  float a=random(i), b=random(i+vec2(1.0,0.0)), c=random(i+vec2(0.0,1.0)), d=random(i+vec2(1.0,1.0));',
      '  vec2 u=f*f*(3.0-2.0*f);',
      '  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y; }',
      'float fbm(vec2 st){ float v=0.0, amp=0.5; for(int i=0;i<5;i++){ v+=amp*noise(st); st*=2.0; amp*=0.5; } return v; }',
      'void main(){',
      '  vec2 st = gl_FragCoord.xy / u_resolution.xy;',
      '  vec2 p = st * vec2(u_resolution.x/u_resolution.y, 1.0) * 3.2;',
      '  vec2 q = vec2(fbm(p + u_time*0.15), fbm(p + vec2(4.3,1.7) + u_time*0.12));',
      '  float f = fbm(p + q*1.6 + u_time*0.08);',
      '  float dist = abs((1.0 - st.y) - u_boundary);',
      '  float band = 1.0 - smoothstep(0.0, 0.75, dist);',
      '  float density = clamp(f*1.5, 0.0, 1.0) * band;',
      '  float alpha = density * u_intensity * 0.95;',
      '  gl_FragColor = vec4(alpha, alpha, alpha, alpha);',
      '}'
    ].join('\n');

    function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = 'none'; return function () {}; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var uRes = gl.getUniformLocation(prog, 'u_resolution');
    var uTime = gl.getUniformLocation(prog, 'u_time');
    var uBoundary = gl.getUniformLocation(prog, 'u_boundary');
    var uIntensity = gl.getUniformLocation(prog, 'u_intensity');

    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    function resize() {
      var r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    var smooth = 1, inited = false;
    return function render(p, t) {
      var target = 1 - p;
      if (!inited) { smooth = target; inited = true; }
      else { smooth += (target - smooth) * 0.12; }
      var settle = 4 * smooth * (1 - smooth);   // 전환 중간에서 최대

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (settle < 0.01) return;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uBoundary, smooth);
      gl.uniform1f(uIntensity, settle);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }
  var renderSmoke = initSmoke();

  /* ---------- 프레임 루프 ---------- */
  function frame(now) {
    var t = now / 1000;
    var p = progress();

    // ② 커튼 리빌 (아래 → 위)
    var centerY = -BAND + (1 - p) * (100 + 2 * BAND);
    var grad = 'linear-gradient(to bottom, transparent ' + (centerY - BAND).toFixed(2) + '%, white ' + (centerY + BAND).toFixed(2) + '%)';
    curtain.style.maskImage = grad;
    curtain.style.webkitMaskImage = grad;
    curtain.style.pointerEvents = p > 0.9 ? 'auto' : 'none';

    // ③ SECTION1 배경 110% → 100%
    if (curtainBg) {
      var e = 1 - Math.pow(1 - p, 3);
      curtainBg.style.transform = 'scale(' + (1.1 - 0.1 * e).toFixed(4) + ')';
    }

    // ① KV
    if (!reduceMotion) {
      kvMx += (tx * 2.5 - kvMx) * 0.08;
      kvMy += (ty * 2.5 - kvMy) * 0.08;
      kvPanY = p > 0.6 ? -((p - 0.6) / 0.4) * 2 : 0;
      applyKv(p);
    }
    if (kvCue) kvCue.style.opacity = Math.max(0, 1 - p / 0.12).toFixed(3);

    renderSmoke(p, t);
    requestAnimationFrame(frame);
  }

  // 768px 이하에서는 스크롤-연동 전환(Ken Burns/패럴랙스/커튼 마스크 리빌/연기)을 전부 끄고
  // KV/커튼이 그냥 위→아래로 이어지는 일반 섹션처럼 보이게 둔다 (CSS 쪽 오버라이드는 style.scss 모바일 블록 참고)
  if (!isMobile) {
    requestAnimationFrame(frame);
  }
})();
