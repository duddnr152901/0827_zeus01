/* =========================================================
   kv-mist.js
   KV 배경 위에서 계속 일렁이는 흰색 안개 (raw WebGL, fbm 노이즈)
   출처: https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83 의
   simplex noise를 뼈대로, 색상만 흰색으로 바꿔서 사용
   ========================================================= */

(function () {
  'use strict';

  var host = document.getElementById('kvMist');
  if (!host) return;

  /* reduced-motion 사용자는 효과 비활성화 */
  if (
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  /* =========================================================
     ▼▼▼ 안개 조정 영역 ▼▼▼
     MIST_OPACITY : 0~1. 숫자가 클수록 안개가 진하게 보임
     MIST_SPEED   : 안개가 움직이는 속도 배율. 1이 기본, 낮추면 더 느긋하게 흐름
     MIST_SCALE   : 안개 무늬의 크기. 숫자가 클수록 무늬가 더 잘게(자주) 나타남
  ========================================================= */
  var MIST_OPACITY = 0.2;
  var MIST_SPEED = 0.6;
  var MIST_SCALE = 1;
  /* ▲▲▲ 안개 조정 영역 끝 ▲▲▲ */

  var canvas = document.createElement('canvas');
  host.appendChild(canvas);

  var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
  if (!gl) { host.style.display = 'none'; return; }

  var vs = 'attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos,0.0,1.0); }';

  var fs = [
    'precision mediump float;',
    'uniform vec2 u_resolution;',
    'uniform float u_time;',
    'uniform float u_opacity;',
    'uniform float u_scale;',

    'vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }',

    'float snoise(vec2 v) {',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);',
    '  vec2 i  = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz;',
    '  x12.xy -= i1;',
    '  i = mod(i, 289.0);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);',
    '  m = m*m; m = m*m;',
    '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h = abs(x) - 0.5;',
    '  vec3 ox = floor(x + 0.5);',
    '  vec3 a0 = x - ox;',
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);',
    '  vec3 g;',
    '  g.x  = a0.x  * x0.x  + h.x  * x0.y;',
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}',

    'void main() {',
    '  vec2 uv = gl_FragCoord.xy * u_scale;',
    '  vec2 distortion = vec2(',
    '    snoise(uv / 150.0 + vec2(u_time * 0.3, u_time * 0.4)),',
    '    snoise(uv / 150.0 + vec2(3.0 + u_time * 0.4, 4.0 + u_time * 0.3))',
    '  );',
    '  vec2 distorted = uv / 600.0 + distortion * 0.2;',

    '  vec2 distortion2 = vec2(',
    '    snoise(distorted + vec2(u_time * -0.01, u_time * -0.02)),',
    '    snoise(distorted + vec2(3.0 + u_time * -0.02, 4.0 + u_time * -0.3))',
    '  );',
    '  vec2 distorted2 = uv / 600.0 + distortion2 * 0.2;',

    '  float noiseValue = (snoise(distorted2 + vec2(u_time * -0.05, u_time * 0.05)) + 1.0) / 2.0;',

    /* 화면 중앙에서 가장자리로 갈수록 옅어지는 비네트 */
    '  float d = 1.0 - length((gl_FragCoord.xy - u_resolution * 0.5) / u_resolution);',
    '  d = clamp(d, 0.0, 1.0);',

    '  float cloud = smoothstep(0.3, 0.9, noiseValue) * d;',
    '  float alpha = cloud * u_opacity;',

    '  gl_FragColor = vec4(alpha, alpha, alpha, alpha);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.style.display = 'none'; return; }
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
  var uOpacity = gl.getUniformLocation(prog, 'u_opacity');
  var uScale = gl.getUniformLocation(prog, 'u_scale');

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function resize() {
    var r = host.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  var running = true;
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) requestAnimationFrame(render);
  });

  function render(now) {
    if (!running) return;

    var t = (now / 1000) * MIST_SPEED;

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform1f(uOpacity, MIST_OPACITY);
    gl.uniform1f(uScale, MIST_SCALE);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
