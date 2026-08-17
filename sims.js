/* ============================================================
   시뮬레이션 목록 (사이트의 "카탈로그")

   ★ 새 시뮬레이션을 추가하는 방법 ★
   1) 폴더를 만든다.  예) titration/
   2) 그 안에 index.html 을 만든다.
   3) 아래 SIMS 배열에 한 줄 추가한다.
      → 대문 페이지의 카드와 모든 페이지의 이동 메뉴에 자동으로 나타납니다.

   ready:false 로 두면 "준비 중" 카드로만 보이고 클릭되지 않습니다.
   cat 에 새 이름을 쓰면 대문의 분류 칩이 자동으로 하나 늘어납니다.
   ============================================================ */

const SIMS = [
  {
    id: "geotime-ride",
    title: "지질 시대의 바다",
    cat: "통합과학",
    path: "geotime-ride/",
    icon: "geotime",
    ready: true,
    desc: "세 시대의 바닷속을 1인칭으로 지나가는 사실적 라이드입니다. 화면 위 버튼으로 선캄브리아·고생대·중생대를 바꿔 가며, 같은 세 가지를 봅니다 — 생물이 얼마나 많은가, 몸에 단단한 부분이 있는가(테두리 색), 바닥에 붙어 있는가 헤엄치는가. 선캄브리아시대 바다의 바닥은 비어 있지 않습니다.",
    tags: ["지질 시대","선캄브리아시대","고생대","중생대","스트로마톨라이트","삼엽충","암모나이트","1인칭 관찰"]
  },
  {
    id: "mineral",
    title: "고체와 입자 배열",
    cat: "물질의 상태",
    path: "mineral/",
    icon: "mineral",
    ready: true,
    desc: "석영·암염·황철석·구리·얼음·흑요석을 손에 든 크기에서 입자 크기까지 연속으로 확대합니다. 불투명한 황철석도 결정이고 유리질 흑요석은 비결정입니다 — 결정 여부는 겉모습이 아니라 배열이 정합니다. 입자를 누르면 결합 종류와 전기 전도성이 나옵니다.",
    tags: ["결정성","비결정성","이온 결정","금속 결정","분자 결정","공유 결정","전기 전도성","유리"]
  },
  {
    id: "liquid",
    title: "액체와 끓는점",
    cat: "물질의 상태",
    path: "liquid/",
    icon: "liquid",
    ready: true,
    desc: "다이에틸에터·에탄올·물·아세트산 네 액체를 실제로 끓여 봅니다. 비커의 굴절과 기포를 3D로 그리고, 분자 크기로 확대하면 떠나는 분자가 원자로 쪼개지지 않는 것이 보입니다. 가열 곡선의 평평한 구간과 증기 압력 곡선을 함께 다룹니다.",
    tags: ["끓는점","증기 압력","Antoine 식","가열 곡선","기화 엔탈피","분자 간 힘","외부 압력"]
  },
  {
    id: "press",
    title: "유압 프레스 도전 게임",
    cat: "물질의 상태",
    path: "press/",
    icon: "press",
    ready: true,
    desc: "압력계를 가린 채 입자 수·온도·부피로 압력을 만들어, 목표를 넘기지 않으면서 가장 가깝게 누르는 2~4인 대결 게임입니다. 그림 속 입자의 빽빽함과 움직임, 피스톤 높이만 보고 판단합니다.",
    tags: ["압력","기체","대결 게임","조작 변인"]
  },
  {
    id: "gaslaws",
    title: "이상기체방정식",
    cat: "물질의 상태",
    path: "gaslaws/",
    icon: "gaslaws",
    ready: true,
    desc: "세 법칙을 같은 상자·같은 입자로 다룹니다. 달라지는 것은 무엇을 잠그고 무엇을 여는가뿐입니다. 피스톤이 스스로 움직여 안팎 압력이 같아지는 자리에서 멈추고, 입자 지름과 입자 수는 어떤 조작에도 변하지 않습니다.",
    tags: ["보일 법칙","샤를 법칙","아보가드로 법칙","이상 기체 방정식","절대 온도","변인 통제"]
  },
  {
    id: "torricelli",
    title: "토리첼리 실험 — 대기압과 수은 기둥",
    cat: "물질의 상태",
    path: "torricelli/",
    icon: "torricelli",
    ready: true,
    desc: "토리첼리 기압계의 수은 기둥이 대기압에 따라 달라지는 모습과, J자관에 수은을 더할 때 갇힌 기체 기둥이 줄어드는 모습을 3D로 살펴봅니다.",
    tags: ["대기압","토리첼리","수은 기둥","진공","J자관","기체 압력"]
  },
  {
    id: "universe",
    title: "우주 초기 원소의 생성",
    cat: "통합과학",
    path: "universe/",
    icon: "universe",
    ready: true,
    desc: "빅뱅 직후 쿼크에서 시작해 핵자 → 헬륨 원자핵 → 중성 원자가 만들어지기까지를 단계별로 따라갑니다.",
    tags: ["빅뱅","쿼크","핵융합","원자의 형성","물질과 규칙성"]
  },
  {
    id: "spectrum",
    title: "별빛 스펙트럼 — 흡수선과 방출선으로 원소 찾기",
    cat: "통합과학",
    path: "spectrum/",
    icon: "spectrum",
    ready: true,
    desc: "별빛을 프리즘에 통과시켜 연속·흡수·방출 세 스펙트럼이 각각 어떤 조건에서 생기는지 직접 만들어 봅니다. 같은 기체를 저온으로 두면 어두운 선이, 고온으로 두면 같은 자리에 밝은 선이 나옵니다. 별의 온도를 아무리 바꿔도 선의 위치는 움직이지 않습니다. 미지의 별 두 개에서 원소를 찾아내는 데까지 갑니다.",
    tags: ["연속 스펙트럼","흡수 스펙트럼","방출 스펙트럼","흡수선","방출선","수소","헬륨","나트륨","원소의 생성"]
  },
  {
    id: "titration",
    title: "산-염기 적정",
    cat: "산과 염기",
    path: "titration/",
    icon: "flask",
    ready: false,
    desc: "적하량에 따른 pH 변화를 실시간 곡선으로. 지시약 색 변화와 당량점 판별.",
    tags: ["적정 곡선","당량점","지시약","pH"]
  },
  {
    id: "orbital",
    title: "원자 오비탈과 전자 배치",
    cat: "원자와 주기율",
    path: "orbital/",
    icon: "atom",
    ready: false,
    desc: "s·p·d 오비탈의 확률 밀도 단면과 쌓음 원리에 따른 전자 배치.",
    tags: ["오비탈","양자수","쌓음 원리","훈트 규칙"]
  },
  {
    id: "periodic",
    title: "주기율표 경향성",
    cat: "원자와 주기율",
    path: "periodic/",
    icon: "grid",
    ready: false,
    desc: "원자 반지름·이온화 에너지·전기음성도를 주기율표 위에 색으로 표시합니다.",
    tags: ["이온화 에너지","전기음성도","유효 핵전하"]
  },
  {
    id: "polarity",
    title: "결합의 극성과 쌍극자",
    cat: "화학 결합",
    path: "polarity/",
    icon: "dipole",
    ready: false,
    desc: "두 원자의 전기음성도 차이에 따라 전자구름이 치우치는 정도를 조절해 봅니다.",
    tags: ["전기음성도","쌍극자 모멘트","극성/무극성"]
  },
  {
    id: "solubility",
    title: "용해도 곡선과 재결정",
    cat: "물질의 상태",
    path: "solubility/",
    icon: "crystal",
    ready: false,
    desc: "온도를 낮출 때 석출되는 양을 용해도 곡선 위에서 계산하고 확인합니다.",
    tags: ["용해도","포화 용액","재결정"]
  }
];

/* 카드에 쓰이는 작은 아이콘들 (SVG) */
const ICONS = {
  geotime:`<rect x="6" y="10" width="52" height="44" rx="4" fill="none" stroke="currentColor" stroke-width="4"/>
         <path d="M6 25h52M6 39h52" stroke="currentColor" stroke-width="2.5" opacity=".45"/>
         <path d="M27 17.5a5 5 0 1 0 5 5" fill="none" stroke="currentColor" stroke-width="3.4"
         stroke-linecap="round"/><circle cx="41" cy="19" r="2.6"/>
         <circle cx="16" cy="32" r="2.8"/><circle cx="26" cy="30" r="2.4"/>
         <circle cx="35" cy="33" r="2.8"/><circle cx="45" cy="30" r="2.4"/>
         <path d="M16 50v-6M24 50v-8M32 50v-5M40 50v-7M48 50v-6" stroke="currentColor"
         stroke-width="3" stroke-linecap="round"/>`,
  mineral:`<path d="M32 5l24 15v24L32 59 8 44V20z" fill="none" stroke="currentColor"
           stroke-width="4" stroke-linejoin="round"/>
           <path d="M32 5v54M8 20l48 24M56 20L8 44" stroke="currentColor" stroke-width="2" opacity=".38"/>
           <circle cx="32" cy="20" r="3.2"/><circle cx="20" cy="32" r="3.2"/>
           <circle cx="44" cy="32" r="3.2"/><circle cx="32" cy="44" r="3.2"/>`,
  liquid:`<path d="M18 8v14L10 46a5 5 0 0 0 4.6 7h34.8A5 5 0 0 0 54 46L46 22V8" fill="none"
          stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
          <path d="M14 8h36" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
          <path d="M13 38h38" stroke="currentColor" stroke-width="3" opacity=".55"/>
          <circle cx="24" cy="45" r="3"/><circle cx="34" cy="48" r="2.4"/><circle cx="42" cy="43" r="2.8"/>
          <circle cx="27" cy="15" r="2.4"/><circle cx="38" cy="12" r="2"/>`,
  press:`<rect x="8" y="10" width="18" height="26" rx="2" fill="none" stroke="currentColor" stroke-width="4"/>
         <circle cx="14" cy="24" r="2.6"/><circle cx="20" cy="30" r="2.6"/><circle cx="17" cy="18" r="2.6"/>
         <path d="M26 46h30" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
         <rect x="34" y="22" width="16" height="8" rx="2"/>
         <path d="M42 30v10" stroke="currentColor" stroke-width="4"/>
         <path d="M8 46h12" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  gaslaws:`<rect x="6" y="16" width="34" height="34" rx="3" fill="none" stroke="currentColor" stroke-width="4"/>
           <rect x="40" y="24" width="7" height="18" rx="2"/>
           <path d="M58 33H49M53 29l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="3.5"
           stroke-linecap="round" stroke-linejoin="round"/>
           <circle cx="16" cy="27" r="3.4"/><circle cx="28" cy="38" r="3.4"/><circle cx="18" cy="42" r="3.4"/>
           <circle cx="31" cy="24" r="3.4"/>`,
  torricelli:`<path d="M31 7v35" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
              <path d="M25 7h12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
              <path d="M31 23v19" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
              <path d="M10 45h42" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
              <path d="M16 51c4 5 28 5 32 0" fill="none" stroke="currentColor" stroke-width="3" opacity=".55"/>
              <path d="M48 10v15M43 20l5 5 5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  flask:`<path d="M26 8v18L12 50a4 4 0 0 0 3.5 6h33A4 4 0 0 0 52 50L38 26V8" fill="none"
         stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
         <path d="M22 8h20" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
         <path d="M18 42h28" stroke="currentColor" stroke-width="4"/>`,
  atom:`<circle cx="32" cy="32" r="5"/><ellipse cx="32" cy="32" rx="26" ry="11" fill="none"
        stroke="currentColor" stroke-width="3.5"/>
        <ellipse cx="32" cy="32" rx="26" ry="11" fill="none" stroke="currentColor"
        stroke-width="3.5" transform="rotate(60 32 32)"/>
        <ellipse cx="32" cy="32" rx="26" ry="11" fill="none" stroke="currentColor"
        stroke-width="3.5" transform="rotate(120 32 32)"/>`,
  grid:`<rect x="8" y="12" width="12" height="12" rx="2"/><rect x="26" y="12" width="12" height="12" rx="2"/>
        <rect x="44" y="12" width="12" height="12" rx="2"/><rect x="8" y="30" width="12" height="12" rx="2"/>
        <rect x="26" y="30" width="12" height="12" rx="2"/><rect x="8" y="48" width="12" height="10" rx="2"/>`,
  dipole:`<circle cx="20" cy="32" r="11"/><circle cx="46" cy="32" r="7"/>
          <path d="M20 52h26M40 47l6 5-6 5" fill="none" stroke="currentColor"
          stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  universe:`<circle cx="32" cy="32" r="6"/><circle cx="32" cy="32" r="13" fill="none"
            stroke="currentColor" stroke-width="2.5" opacity=".55"/>
            <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor"
            stroke-width="2.5" opacity=".3"/>
            <circle cx="32" cy="10" r="3"/><circle cx="54" cy="32" r="2.5"/>
            <circle cx="32" cy="54" r="3"/><circle cx="10" cy="32" r="2.5"/>
            <circle cx="47" cy="17" r="2"/><circle cx="17" cy="47" r="2"/>`,
  spectrum:`<path d="M24 10L44 44H4z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
          <path d="M2 24h10" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
          <rect x="46" y="14" width="14" height="36" rx="2" fill="none" stroke="currentColor" stroke-width="3"/>
          <path d="M46 22h14M46 31h14M46 41h14" stroke="currentColor" stroke-width="3"/>`,
  crystal:`<path d="M32 6l22 14v24L32 58 10 44V20z" fill="none" stroke="currentColor"
           stroke-width="4" stroke-linejoin="round"/><path d="M32 6v52M10 20l44 24M54 20L10 44"
           stroke="currentColor" stroke-width="2.5" opacity=".45"/>`
};
