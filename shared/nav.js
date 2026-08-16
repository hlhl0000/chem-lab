/* ============================================================
   모든 시뮬레이션 페이지 위에 공통 네비게이션 바를 붙입니다.
   이 파일 하나만 고치면 사이트의 모든 페이지 상단이 함께 바뀝니다.

   사용법 (시뮬레이션 페이지의 </body> 직전에):
     <script src="../sims.js"></script>
     <script src="../shared/nav.js" data-base=".." data-current="gas"></script>
   ============================================================ */
(function () {
  const me      = document.currentScript;
  const base    = me.dataset.base || ".";       // 대문까지의 상대 경로
  const current = me.dataset.current || "";     // 지금 페이지의 시뮬레이션 id

  // 준비된 시뮬레이션만 이동 메뉴에 넣는다
  const options = SIMS.filter(s => s.ready).map(s =>
    `<option value="${base}/${s.path}" ${s.id === current ? "selected" : ""}>${s.title}</option>`
  ).join("");

  const html = `
    <nav class="site-nav">
      <div class="inner">
        <a class="brand" href="${base}/index.html">
          <span class="mark">C</span><span>ChemLab</span>
        </a>
        <span class="spacer"></span>
        <select id="simJump" aria-label="다른 시뮬레이션으로 이동">
          <option value="">다른 시뮬레이션으로 이동…</option>
          ${options}
        </select>
        <a class="home" href="${base}/index.html">전체 목록</a>
      </div>
    </nav>`;

  document.body.insertAdjacentHTML("afterbegin", html);

  document.getElementById("simJump").onchange = function () {
    if (this.value) location.href = this.value;
  };
})();
