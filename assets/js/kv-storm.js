/* =========================================================
   kv-storm.js
   Lightweight Cloud + Lightning Effect
   ========================================================= */

(function () {
  'use strict';

  var host = document.getElementById('kvStorm');

  if (!host || typeof THREE === 'undefined') return;

  /* reduced-motion 사용자는 효과 비활성화 */
  if (
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }


  /* =========================================================
     VARIABLES
  ========================================================= */

  var scene;
  var camera;
  var renderer;

  var cloudGeo;
  var cloudMaterial;

  var cloudParticles = [];

  var lightningEl = null;

  var running = true;
  var isVisible = true;

  var lastFrame = 0;
  var nextLightning = 0;

  var resizeTimer = null;


  /* =========================================================
     PERFORMANCE SETTINGS
  ========================================================= */

  // 렌더링 프레임
  // 30 정도면 구름 효과에서는 충분함
  var FPS = 30;
  var FRAME_INTERVAL = 1000 / FPS;

  // 구름 개수
  // 기존 25 → 10
  var CLOUD_COUNT = 10;

  // smoke 텍스처
  // 기존 postimg.cc 외부 호스팅 → 로컬 파일로 변경
  // (별도 도메인 DNS/TLS 핸드셰이크 제거해서 초기 로딩 지연 단축)
  var CLOUD_TEXTURE_URL =
    'assets/images/smoke-1.webp';

  // 텍스처 로드 완료 후 구름이 갑자기 나타나지 않도록 페이드인 시간(ms)
  var CLOUD_FADE_MS = 1300;

  /* ///////////////////////////////////////////////////////
     ▼▼▼ 구름 투명도(opacity) 조정 영역 ▼▼▼

     0 ~ 1 사이 값. 숫자가 클수록 구름이 진하게(불투명하게) 보임
     예) 더 흐리게: 0.3 / 더 진하게: 0.6
  /////////////////////////////////////////////////////// */

  var CLOUD_OPACITY = 0;

  /* ▲▲▲ 구름 투명도(opacity) 조정 영역 끝 ▲▲▲ */


  /* =========================================================
     SIZE
  ========================================================= */

  function getSize() {
    var rect = host.getBoundingClientRect();

    return {
      w: Math.max(1, rect.width),
      h: Math.max(1, rect.height)
    };
  }


  /* =========================================================
     INIT
  ========================================================= */

  function init() {
    var s = getSize();


    /* ---------------------------------------------------------
       SCENE
    --------------------------------------------------------- */

    scene = new THREE.Scene();


    /* ---------------------------------------------------------
       CAMERA
    --------------------------------------------------------- */

    camera = new THREE.PerspectiveCamera(
      60,
      s.w / s.h,
      1,
      1000
    );

    camera.position.z = 1;

    camera.rotation.x = 1.16;
    camera.rotation.y = -0.12;
    camera.rotation.z = 0.27;


    /* ---------------------------------------------------------
       RENDERER
    --------------------------------------------------------- */

    renderer = new THREE.WebGLRenderer({
      alpha: true,

      /*
        구름에는 안티앨리어싱 차이가 거의 없어서
        성능을 위해 OFF
      */
      antialias: false,

      /*
        성능 우선
      */
      powerPreference: 'low-power'
    });


    /*
      기존 KV 배경이 그대로 보이도록 투명
    */
    renderer.setClearColor(
      0x000000,
      0
    );


    /*
      고해상도 모니터에서도 GPU 부하 제한
    */
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        1.25
      )
    );


    renderer.setSize(
      s.w,
      s.h,
      false
    );


    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    renderer.domElement.style.pointerEvents = 'none';


    host.appendChild(
      renderer.domElement
    );


    /* ---------------------------------------------------------
       번개 Overlay
    --------------------------------------------------------- */

    createLightningOverlay();


    /* ---------------------------------------------------------
       구름
    --------------------------------------------------------- */

    loadCloudTexture();


    /* ---------------------------------------------------------
       Visibility 최적화
    --------------------------------------------------------- */

    setupVisibility();


    /* ---------------------------------------------------------
       Resize
    --------------------------------------------------------- */

    window.addEventListener(
      'resize',
      handleResize,
      {
        passive: true
      }
    );


    /* ---------------------------------------------------------
       Animation Start
    --------------------------------------------------------- */

    requestAnimationFrame(
      animate
    );
  }


  /* =========================================================
     CLOUD TEXTURE
  ========================================================= */

  function loadCloudTexture() {
    var loader = new THREE.TextureLoader();


    if (loader.setCrossOrigin) {
      loader.setCrossOrigin(
        'anonymous'
      );
    }


    loader.load(

      CLOUD_TEXTURE_URL,


      /* -------------------------------------------------------
         LOAD SUCCESS
      ------------------------------------------------------- */

      function (texture) {

        texture.minFilter =
          THREE.LinearFilter;

        texture.magFilter =
          THREE.LinearFilter;


        /*
          mipmap 계산 제거
        */
        texture.generateMipmaps =
          false;


        /*
          Three.js 최신 버전
        */
        if (
          typeof THREE.SRGBColorSpace !==
          'undefined'
        ) {

          texture.colorSpace =
            THREE.SRGBColorSpace;
        }


        /*
          구버전 Three.js
        */
        else if (
          typeof THREE.sRGBEncoding !==
          'undefined'
        ) {

          texture.encoding =
            THREE.sRGBEncoding;
        }


        createClouds(
          texture
        );
      },


      undefined,


      /* -------------------------------------------------------
         LOAD FAIL
      ------------------------------------------------------- */

      function () {

        /*
          외부 이미지 / CORS 실패 시
          Canvas로 자체 구름 생성
        */

        var texture =
          new THREE.CanvasTexture(
            makeCloudCanvas()
          );


        texture.minFilter =
          THREE.LinearFilter;

        texture.magFilter =
          THREE.LinearFilter;

        texture.generateMipmaps =
          false;


        createClouds(
          texture
        );
      }
    );
  }


  /* =========================================================
     CREATE CLOUDS
  ========================================================= */

  function createClouds(texture) {

    /*
      Geometry 하나 공유
    */

    cloudGeo =
      new THREE.PlaneGeometry(
        500,
        500
      );


    /*
      Material 하나 공유

      MeshLambertMaterial 대신
      MeshBasicMaterial을 사용해서
      실시간 조명 계산 제거
    */

    /* ///////////////////////////////////////////////////////
       ▼▼▼ 검은 구름 색상 / 투명도 수정 영역 ▼▼▼

       - color: 구름 색조. 지정 안 하면 텍스처 원본 색(흰색 계열).
         더 검게/어둡게 하려면 예) color: 0x000000 또는 0x333333 추가
       - opacity: 최종 투명도. 지금은 아래 CLOUD_OPACITY 상수를
         fadeInClouds()에서 서서히 적용하므로, 진하기를 바꾸려면
         이 파일 상단의 CLOUD_OPACITY 값을 수정할 것 (여기 opacity: 0은
         페이드인 시작값이라 건드리지 않아도 됨)
    /////////////////////////////////////////////////////// */

    cloudMaterial =
      new THREE.MeshBasicMaterial({

        map: texture,

        transparent: true,

        /*
          텍스처 로드 완료 시 바로 0.46로 튀지 않고
          0에서 페이드인 (아래 fadeInClouds 참고)
        */
        opacity: 0,

        depthWrite: false,

        side:
          THREE.DoubleSide,

        /*
          약한 smoke 텍스처 가장자리 제거
        */
        alphaTest: 0.005
      });

    /* ▲▲▲ 검은 구름 색상 / 투명도 수정 영역 끝 ▲▲▲ */


    for (
      var i = 0;
      i < CLOUD_COUNT;
      i++
    ) {

      var cloud =
        new THREE.Mesh(
          cloudGeo,
          cloudMaterial
        );


      /* -------------------------------------------------------
         POSITION
      ------------------------------------------------------- */

      cloud.position.set(

        Math.random() * 750 - 375,

        430 +
        Math.random() * 120,

        Math.random() * 450 - 400
      );


      /* -------------------------------------------------------
         ROTATION
      ------------------------------------------------------- */

      cloud.rotation.x =
        1.16;

      cloud.rotation.y =
        -0.12;

      cloud.rotation.z =
        Math.random() *
        Math.PI *
        2;


      /* -------------------------------------------------------
         SCALE
      ------------------------------------------------------- */

      var scale =
        0.9 +
        Math.random() *
        0.55;


      cloud.scale.set(
        scale,
        scale,
        scale
      );


      /* -------------------------------------------------------
         구름 움직임 데이터
      ------------------------------------------------------- */

      /*
        천천히 회전
      */
      cloud.userData.rotationSpeed =
        0.0003 +
        Math.random() *
        0.00035;


      /*
        현재 위치 기억
      */
      cloud.userData.baseX =
        cloud.position.x;

      cloud.userData.baseY =
        cloud.position.y;


      /*
        기본 크기 기억
      */
      cloud.userData.baseScale =
        scale;


      /*
        구름마다 타이밍을 다르게
      */
      cloud.userData.phase =
        Math.random() *
        Math.PI *
        2;


      /*
        일렁임 속도
        숫자가 작을수록 매우 천천히 움직임
      */
      cloud.userData.waveSpeed =
        0.00025 +
        Math.random() *
        0.0002;


      cloudParticles.push(
        cloud
      );


      scene.add(
        cloud
      );
    }


    fadeInClouds();
  }


  /* =========================================================
     CLOUD FADE-IN

     텍스처 로드가 끝나는 시점(네트워크 상황에 따라 편차가 큼)에
     구름이 즉시 최종 opacity로 "띡" 튀어 보이지 않도록
     서서히 opacity를 올려준다.
  ========================================================= */

  function fadeInClouds() {

    var start =
      performance.now();


    function step(now) {

      var t =
        Math.min(
          1,
          (now - start) / CLOUD_FADE_MS
        );


      cloudMaterial.opacity =
        CLOUD_OPACITY * t;


      if (t < 1) {
        requestAnimationFrame(step);
      }
    }


    requestAnimationFrame(step);
  }


  /* =========================================================
     FALLBACK CLOUD TEXTURE
  ========================================================= */

  function makeCloudCanvas() {

    /*
      기존 512px 대신 256
    */

    var canvasSize =
      256;


    var canvas =
      document.createElement(
        'canvas'
      );


    canvas.width =
      canvasSize;

    canvas.height =
      canvasSize;


    var ctx =
      canvas.getContext(
        '2d'
      );


    /*
      구름 퍼프
      기존보다 적게 생성
    */

    for (
      var i = 0;
      i < 22;
      i++
    ) {

      var x =
        Math.random() *
        canvasSize;

      var y =
        Math.random() *
        canvasSize;


      var radius =
        canvasSize *
        (
          0.12 +
          Math.random() *
          0.2
        );


      var gradient =
        ctx.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          radius
        );


      gradient.addColorStop(
        0,
        'rgba(225,230,240,0.42)'
      );


      gradient.addColorStop(
        1,
        'rgba(225,230,240,0)'
      );


      ctx.fillStyle =
        gradient;


      ctx.beginPath();


      ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
      );


      ctx.fill();
    }


    return canvas;
  }


  /* =========================================================
     LIGHTNING OVERLAY
  ========================================================= */

  function createLightningOverlay() {

    lightningEl =
      document.createElement(
        'div'
      );


    lightningEl.className =
      'kv-storm-lightning';


    lightningEl.style.position =
      'absolute';

    lightningEl.style.inset =
      '0';

    lightningEl.style.pointerEvents =
      'none';

    lightningEl.style.opacity =
      '0';

    lightningEl.style.zIndex =
      '2';


    /*
      화면 전체를 흰색으로 만드는 것보다
      위쪽에서 번개가 터지는 느낌
    */

    lightningEl.style.background =
      [
        'radial-gradient(',
        'ellipse at 52% 8%,',
        'rgba(225,238,255,0.95) 0%,',
        'rgba(160,195,255,0.60) 12%,',
        'rgba(80,125,220,0.25) 32%,',
        'rgba(30,55,100,0.08) 52%,',
        'transparent 72%',
        ')'
      ].join(' ');


    lightningEl.style.willChange =
      'opacity';


    host.appendChild(
      lightningEl
    );


    scheduleNextLightning();
  }


  /* =========================================================
     LIGHTNING TIMER
  ========================================================= */

  // 번개 치는 빈도 조절 — 아래 두 숫자만 바꾸면 됨
  // 다음 번개까지 대기 시간(ms) = LIGHTNING_MIN_DELAY ~ (LIGHTNING_MIN_DELAY + LIGHTNING_RANDOM_RANGE) 사이 랜덤
  // 값을 줄이면 더 자주, 늘리면 더 뜸하게 침
  var LIGHTNING_MIN_DELAY = 1200;    // 최소 대기 시간(ms). 기존 2500
  var LIGHTNING_RANDOM_RANGE = 2700; // 여기에 더해지는 랜덤 범위(ms). 기존 3500 → 약 1.8~4.5초 간격

  function scheduleNextLightning() {
    nextLightning =
      performance.now() +
      LIGHTNING_MIN_DELAY +
      Math.random() *
      LIGHTNING_RANDOM_RANGE;
  }


  /* =========================================================
     LIGHTNING EFFECT
  ========================================================= */

  function triggerLightning() {

    if (!lightningEl) return;


    /*
      번개 위치가 항상 같아 보이지 않도록 변경
    */

    var lightningX =
      30 +
      Math.random() *
      45;


    lightningEl.style.background =
      'radial-gradient(' +
      'ellipse at ' +
      lightningX +
      '% 8%, ' +
      'rgba(235,245,255,0.95) 0%, ' +
      'rgba(160,195,255,0.58) 13%, ' +
      'rgba(85,130,225,0.25) 32%, ' +
      'rgba(30,55,100,0.07) 53%, ' +
      'transparent 72%' +
      ')';


    /*
      번개는 한 번만 번쩍이는 것보다
      짧게 두 번 치는 게 더 자연스러움
    */

    lightningEl.animate(

      [
        {
          opacity: 0
        },

        {
          opacity: 0.95,
          offset: 0.08
        },

        {
          opacity: 0.12,
          offset: 0.17
        },

        {
          opacity: 0.72,
          offset: 0.27
        },

        {
          opacity: 0.18,
          offset: 0.42
        },

        {
          opacity: 0,
          offset: 1
        }
      ],

      {
        duration: 420,
        easing: 'ease-out'
      }
    );


    scheduleNextLightning();
  }


  /* =========================================================
     UPDATE LIGHTNING
  ========================================================= */

  function updateLightning(now) {

    if (
      now <
      nextLightning
    ) {
      return;
    }


    triggerLightning();
  }


  /* =========================================================
     CLOUD ANIMATION
  ========================================================= */

  function updateClouds(now) {

    for (
      var i = 0;
      i < cloudParticles.length;
      i++
    ) {

      var cloud =
        cloudParticles[i];


      /* -------------------------------------------------------
         아주 느린 회전
      ------------------------------------------------------- */

      cloud.rotation.z -=
        cloud.userData.rotationSpeed;


      /* -------------------------------------------------------
         일렁임

         X/Y 움직임을 서로 다른 주기로 줘서
         단순 왕복처럼 보이지 않게 함
      ------------------------------------------------------- */

      var waveX =
        Math.sin(

          now *
          cloud.userData.waveSpeed +

          cloud.userData.phase

        );


      var waveY =
        Math.sin(

          now *
          cloud.userData.waveSpeed *
          0.73 +

          cloud.userData.phase

        );


      /*
        좌우 움직임
        ±4 정도
      */

      cloud.position.x =

        cloud.userData.baseX +

        waveX * 18;


      /*
        위아래 움직임
        ±2 정도
      */

      cloud.position.y =

        cloud.userData.baseY +

        waveY * 4;


      /*
        크기가 아주 조금씩 변하면서
        구름이 숨 쉬는 느낌
      */

      var scale =

        cloud.userData.baseScale *

        (
          1 +
          waveY *
          0.03
        );


      cloud.scale.set(
        scale,
        scale,
        scale
      );
    }
  }


  /* =========================================================
     ANIMATE
  ========================================================= */

  function animate(now) {

    requestAnimationFrame(
      animate
    );


    /*
      화면 밖 / 다른 탭에서는
      렌더링 하지 않음
    */

    if (
      !running ||
      !isVisible
    ) {
      return;
    }


    /*
      30 FPS 제한
    */

    if (
      now - lastFrame <
      FRAME_INTERVAL
    ) {
      return;
    }


    lastFrame =
      now;


    /* 구름 */

    updateClouds(
      now
    );


    /* 번개 */

    updateLightning(
      now
    );


    /* Render */

    renderer.render(
      scene,
      camera
    );
  }


  /* =========================================================
     VISIBILITY OPTIMIZATION
  ========================================================= */

  function setupVisibility() {

    /* ---------------------------------------------------------
       브라우저 탭 전환
    --------------------------------------------------------- */

    document.addEventListener(

      'visibilitychange',

      function () {

        running =
          !document.hidden;

      }

    );


    /* ---------------------------------------------------------
       KV가 화면 밖으로 나가면 중지
    --------------------------------------------------------- */

    if (
      'IntersectionObserver' in window
    ) {

      var observer =
        new IntersectionObserver(

          function (entries) {

            isVisible =
              entries[0].isIntersecting;

          },

          {
            threshold: 0
          }

        );


      observer.observe(
        host
      );
    }
  }


  /* =========================================================
     RESIZE
  ========================================================= */

  function handleResize() {

    /*
      resize 이벤트 연속 실행 방지
    */

    clearTimeout(
      resizeTimer
    );


    resizeTimer =
      setTimeout(
        onResize,
        120
      );
  }


  function onResize() {

    if (
      !camera ||
      !renderer
    ) {
      return;
    }


    var s =
      getSize();


    camera.aspect =
      s.w / s.h;


    camera.updateProjectionMatrix();


    renderer.setSize(
      s.w,
      s.h,
      false
    );
  }


  /* =========================================================
     WEBGL CHECK
  ========================================================= */

  try {

    var testCanvas =
      document.createElement(
        'canvas'
      );


    var gl =

      testCanvas.getContext(
        'webgl'
      ) ||

      testCanvas.getContext(
        'experimental-webgl'
      );


    if (!gl) return;

  } catch (e) {

    return;
  }


  /* =========================================================
     START
  ========================================================= */

  init();

})();