/**
 * Arcade SDK v1
 * 게임 안에서 이 스크립트를 불러오면 플랫폼과 점수/상태를 주고받을 수 있습니다.
 *
 *   <script src="/sdk/arcade.js"></script>
 *   <script>
 *     Arcade.ready(function (config) {
 *       // config.player.name, config.tournament, config.canSubmit
 *     });
 *     // 판이 끝났을 때
 *     Arcade.gameOver(1240);                       // 점수만
 *     Arcade.gameOver(1240, { level: 7 });         // 부가 정보 함께
 *   </script>
 *
 * 규칙은 두 줄입니다.
 *   1) 시작할 준비가 되면 Arcade.ready(콜백) 를 부르세요.
 *   2) 한 판이 끝나면 Arcade.gameOver(점수) 를 부르세요. 나머지는 플랫폼이 합니다.
 *
 * 검증 데이터
 *   대회 기록의 앞뒤가 맞는지 보기 위해, SDK 가 판마다 다음을 자동으로 모아 함께 보냅니다.
 *   게임 코드에서 따로 할 일은 없습니다.
 *     - 조작 횟수와 첫 조작까지 걸린 시간 (누름·움직임을 따로 셉니다)
 *     - Arcade.progress() 로 들어온 점수 곡선 (점수가 한 번에 튀었는지)
 *     - 시계 정합성: Date.now 와 performance.now 의 차이 (시간 조작 탐지)
 *     - 판 도중 탭이 백그라운드로 갔는지
 *   개인을 식별할 수 있는 값은 모으지 않습니다.
 */
(function () {
  "use strict";

  var HOST = "arcade-host";
  var GAME = "arcade-game";

  var startedAt = null;
  var startedPerf = null;
  var configCbs = [];
  var resultCbs = [];
  var config = null;
  var submitted = false;

  /* ---------------- 검증 데이터 수집 ---------------- */

  var MAX_SAMPLES = 40;      // 점수 곡선은 40개면 모양을 보기에 충분합니다.
  var SAMPLE_START_MS = 250; // 표본 간격 — 판이 길어지면 아래에서 두 배씩 늘립니다.
  var MOVE_INTERVAL = 120;   // 움직임은 프레임마다 오므로 이 간격에 한 번만 셉니다.

  var trace = null;
  var lastMoveAt = -Infinity;
  var lastSampleAt = -Infinity;
  var sampleInterval = SAMPLE_START_MS;

  function newTrace() {
    return {
      inputs: 0,        // 판 중 누른 횟수 (포인터·키·터치)
      moves: 0,         // 판 중 움직인 횟수 (마우스·터치 드래그)
      firstInputMs: null, // 시작 후 첫 조작까지 (null 이면 조작이 아예 없었음)
      samples: [],      // [경과ms, 점수] 쌍
      lastProgress: null, // 마지막으로 보고된 [경과ms, 점수]
      hiddenMs: 0,      // 탭이 백그라운드였던 시간
      hiddenAt: null,
    };
  }

  function elapsed() {
    // performance.now 는 단조 증가라 시스템 시계를 바꿔도 흔들리지 않습니다.
    return startedPerf === null ? 0 : Math.round(performance.now() - startedPerf);
  }

  function onInput() {
    if (!trace) return;
    trace.inputs += 1;
    if (trace.firstInputMs === null) trace.firstInputMs = elapsed();
  }

  /**
   * 움직임도 조작입니다.
   *
   * 마우스를 따라 움직이는 조종(운석 피하기가 그렇습니다)은 판이 끝날 때까지
   * pointerdown 이 한 번도 오지 않습니다. 누름만 세면 멀쩡한 플레이가 통째로
   * "조작 없음"으로 표시되므로, 움직임을 따로 셉니다.
   */
  function onMove() {
    if (!trace) return;
    var now = performance.now();
    if (now - lastMoveAt < MOVE_INTERVAL) return;
    lastMoveAt = now;
    trace.moves += 1;
    if (trace.firstInputMs === null) trace.firstInputMs = elapsed();
  }

  ["pointerdown", "keydown", "touchstart"].forEach(function (type) {
    // capture 로 받아야 게임이 stopPropagation 을 걸어도 놓치지 않습니다.
    window.addEventListener(type, onInput, { capture: true, passive: true });
  });

  ["pointermove", "touchmove"].forEach(function (type) {
    window.addEventListener(type, onMove, { capture: true, passive: true });
  });

  document.addEventListener("visibilitychange", function () {
    if (!trace) return;
    if (document.hidden) {
      trace.hiddenAt = performance.now();
    } else if (trace.hiddenAt !== null) {
      trace.hiddenMs += Math.round(performance.now() - trace.hiddenAt);
      trace.hiddenAt = null;
    }
  });

  /**
   * 표본이 40개를 넘으면 하나 걸러 하나만 남기고 간격을 두 배로 늘립니다.
   *
   * 예전에는 앞에서부터 40개를 채우고 그만 뒀는데, 그러면 60fps 게임에서
   * 곡선이 첫 0.6초에서 끊깁니다. 30초를 버틴 판이 "0.6초 시점 20점 → 최종 900점"
   * 으로 보여서, 멀쩡한 기록이 전부 "점수가 튀었다"로 표시됐습니다.
   */
  function thinSamples() {
    var kept = [];
    for (var i = 0; i < trace.samples.length; i += 2) kept.push(trace.samples[i]);
    trace.samples = kept;
    sampleInterval *= 2;
  }

  function sealTrace(score) {
    if (!trace) trace = newTrace();
    if (trace.hiddenAt !== null) {
      trace.hiddenMs += Math.round(performance.now() - trace.hiddenAt);
      trace.hiddenAt = null;
    }
    var perfMs = elapsed();
    var wallMs = startedAt === null ? perfMs : Date.now() - startedAt;

    // 마지막으로 보고된 점수는 반드시 곡선 끝에 남깁니다 —
    // 서버가 "곡선의 끝"과 "제출된 점수"를 비교하기 때문입니다.
    function finalSamples() {
      var out = trace.samples.slice();
      var last = trace.lastProgress;
      if (last && (out.length === 0 || out[out.length - 1][0] !== last[0])) out.push(last);
      return out;
    }

    return {
      sdk: 2, // 검증 데이터 형식 버전 (게임이 쓰는 Arcade.version 과는 별개입니다)
      inputs: trace.inputs,
      moves: trace.moves,
      firstInputMs: trace.firstInputMs,
      samples: finalSamples(),
      hiddenMs: trace.hiddenMs,
      perfMs: perfMs,   // 단조 시계 기준 플레이 시간
      wallMs: wallMs,   // 시스템 시계 기준 — 둘이 어긋나면 시계를 건드린 것
      finalScore: Number(score) || 0,
      startedGame: startedPerf !== null, // start() 없이 gameOver 만 불렀는지
    };
  }

  function post(type, payload) {
    try {
      window.parent.postMessage({ source: GAME, type: type, payload: payload || {} }, "*");
    } catch (e) {
      /* 부모가 없는 단독 실행 — 조용히 무시 */
    }
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== HOST) return;

    if (data.type === "CONFIG") {
      config = data.payload;
      Arcade.player = config.player;
      Arcade.tournament = config.tournament;
      Arcade.canSubmit = !!config.canSubmit;
      var cbs = configCbs.slice();
      configCbs.length = 0;
      cbs.forEach(function (cb) {
        try { cb(config); } catch (e) { console.error(e); }
      });
    }

    if (data.type === "SUBMIT_RESULT") {
      resultCbs.forEach(function (cb) {
        try { cb(data.payload); } catch (e) { console.error(e); }
      });
    }
  });

  var Arcade = {
    version: 1,
    player: { name: "게스트", isGuest: true },
    tournament: null,
    canSubmit: false,

    /** 게임 준비 완료. 콜백은 플랫폼 설정을 받습니다. */
    ready: function (cb) {
      if (typeof cb === "function") {
        if (config) cb(config);
        else configCbs.push(cb);
      }
      post("READY", { sdk: 1 });
      return this;
    },

    /** 새 판 시작 — 플레이 시간 측정을 시작합니다. */
    start: function () {
      startedAt = Date.now();
      startedPerf = performance.now();
      submitted = false;
      trace = newTrace();
      lastMoveAt = -Infinity;
      lastSampleAt = -Infinity;
      sampleInterval = SAMPLE_START_MS;
      post("START", {});
      return this;
    },

    /** 진행 중 점수 (선택). 화면 상단 오버레이에 표시됩니다. */
    progress: function (score) {
      var value = Number(score) || 0;
      if (trace) {
        var at = elapsed();
        trace.lastProgress = [at, value];
        if (at - lastSampleAt >= sampleInterval) {
          lastSampleAt = at;
          trace.samples.push([at, value]);
          if (trace.samples.length >= MAX_SAMPLES) thinSamples();
        }
      }
      post("PROGRESS", { score: value });
      return this;
    },

    /** 한 판 종료. 점수를 제출합니다. */
    gameOver: function (score, meta) {
      if (submitted) return this;
      submitted = true;
      if (startedAt === null) startedAt = Date.now() - 2000;
      post("GAME_OVER", {
        score: Number(score) || 0,
        durationMs: Date.now() - startedAt,
        meta: meta && typeof meta === "object" ? meta : {},
        trace: sealTrace(score),
      });
      return this;
    },

    /** 제출 결과(성공/실패, 순위) 수신. */
    onResult: function (cb) {
      if (typeof cb === "function") resultCbs.push(cb);
      return this;
    },

    /** 게임 안에서 "다시하기"를 눌렀을 때 호출하면 플랫폼도 상태를 초기화합니다. */
    restart: function () {
      post("RESTART", {});
      return this.start();
    },
  };

  window.Arcade = Arcade;
})();
