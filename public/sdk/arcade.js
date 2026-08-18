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
 */
(function () {
  "use strict";

  var HOST = "arcade-host";
  var GAME = "arcade-game";

  var startedAt = null;
  var configCbs = [];
  var resultCbs = [];
  var config = null;
  var submitted = false;

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
      submitted = false;
      post("START", {});
      return this;
    },

    /** 진행 중 점수 (선택). 화면 상단 오버레이에 표시됩니다. */
    progress: function (score) {
      post("PROGRESS", { score: Number(score) || 0 });
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
