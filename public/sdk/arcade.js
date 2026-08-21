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
 *     - 입력 횟수와 첫 입력까지 걸린 시간 (조작 없이 점수가 나왔는지)
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

  var MAX_SAMPLES = 40; // 점수 곡선은 40개면 모양을 보기에 충분합니다.

  var trace = null;

  function newTrace() {
    return {
      inputs: 0,        // 판 중 입력(포인터·키·터치) 횟수
      firstInputMs: null, // 시작 후 첫 입력까지 (null 이면 입력이 아예 없었음)
      samples: [],      // [경과ms, 점수] 쌍
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

  ["pointerdown", "keydown", "touchstart"].forEach(function (type) {
    // capture 로 받아야 게임이 stopPropagation 을 걸어도 놓치지 않습니다.
    window.addEventListener(type, onInput, { capture: true, passive: true });
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

  function sealTrace(score) {
    if (!trace) trace = newTrace();
    if (trace.hiddenAt !== null) {
      trace.hiddenMs += Math.round(performance.now() - trace.hiddenAt);
      trace.hiddenAt = null;
    }
    var perfMs = elapsed();
    var wallMs = startedAt === null ? perfMs : Date.now() - startedAt;
    return {
      sdk: 1,
      inputs: trace.inputs,
      firstInputMs: trace.firstInputMs,
      samples: trace.samples,
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
      post("START", {});
      return this;
    },

    /** 진행 중 점수 (선택). 화면 상단 오버레이에 표시됩니다. */
    progress: function (score) {
      var value = Number(score) || 0;
      if (trace && trace.samples.length < MAX_SAMPLES) {
        trace.samples.push([elapsed(), value]);
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
