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
    id: "mineral",
    title: "고체 — 겉모습에서 입자 배열까지",
    cat: "물질의 상태",
    path: "mineral/",
    icon: "mineral",
    ready: true,
    desc: "석영·암염·황철석·구리·얼음·흑요석을 손에 든 크기에서 입자 크기까지 연속으로 확대합니다. 불투명한 황철석도 결정이고 유리질 흑요석은 비결정입니다 — 결정 여부는 겉모습이 아니라 배열이 정합니다. 입자를 누르면 결합 종류와 전기 전도성이 나옵니다.",
    tags: ["결정성","비결정성","이온 결정","금속 결정","분자 결정","공유 결정","전기 전도성","유리"]
  },
  {
    id: "liquid",
    title: "액체 — 끓음 실험",
    cat: "물질의 상태",
    path: "liquid/",
    icon: "liquid",
    ready: true,
    desc: "다이에틸에터·에탄올·물·아세트산 네 액체를 실제로 끓여 봅니다. 비커의 굴절과 기포를 3D로 그리고, 분자 크기로 확대하면 떠나는 분자가 원자로 쪼개지지 않는 것이 보입니다. 가열 곡선의 평평한 구간과 증기 압력 곡선을 함께 다룹니다.",
    tags: ["끓는점","증기 압력","Antoine 식","가열 곡선","기화 엔탈피","분자 간 힘","외부 압력"]
  },
  {
    id: "press",
    title: "유압 프레스 도전 — 물체를 부수지 않고 가장 세게 누르기",
    cat: "물질의 상태",
    path: "press/",
    icon: "press",
    ready: true,
    desc: "압력계를 가린 채 입자 수·온도·부피로 압력을 만들어, 목표를 넘기지 않으면서 가장 가깝게 누르는 2~4인 대결 게임입니다. 그림 속 입자의 빽빽함과 움직임, 피스톤 높이만 보고 판단합니다.",
    tags: ["압력","기체","대결 게임","조작 변인"]
  },
  {
    id: "gaslaws",
    title: "기체 법칙 — 보일·샤를·아보가드로·이상 기체 방정식",
    cat: "물질의 상태",
    path: "gaslaws/",
    icon: "gaslaws",
    ready: true,
    desc: "세 법칙을 같은 상자·같은 입자로 다룹니다. 달라지는 것은 무엇을 잠그고 무엇을 여는가뿐입니다. 피스톤이 스스로 움직여 안팎 압력이 같아지는 자리에서 멈추고, 입자 지름과 입자 수는 어떤 조작에도 변하지 않습니다.",
    tags: ["보일 법칙","샤를 법칙","아보가드로 법칙","이상 기체 방정식","절대 온도","변인 통제"]
  },
  {
    id: "gas",
    title: "기체 분자 운동",
    cat: "물질의 상태",
    path: "gas/",
    icon: "gas",
    ready: true,
    desc: "온도·부피·입자 수를 바꾸며 압력과 속력 분포의 변화를 관찰합니다. 피스톤 압축과 맥스웰–볼츠만 분포까지.",
    tags: ["보일 법칙","샤를 법칙","그레이엄 법칙","맥스웰–볼츠만"]
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
    id: "vapor",
    title: "증기 압력 내림과 총괄성",
    cat: "용액의 성질",
    path: "vapor/",
    icon: "vapor",
    ready: true,
    desc: "밀폐 용기의 동적 평형에서 라울 법칙이 저절로 나옵니다. 수면을 덮어 보면 '차단은 속도를 바꾸고 평형을 바꾸지 않는다'가 화면에서 확인됩니다. 증기 압력 곡선의 교점 이동으로 끓는점 오름·어는점 내림까지.",
    tags: ["라울 법칙","동적 평형","몰분율","끓는점 오름","어는점 내림","총괄성"]
  },
  {
    id: "osmosis",
    title: "삼투와 삼투압",
    cat: "용액의 성질",
    path: "osmosis/",
    icon: "osmosis",
    ready: true,
    desc: "반투막을 건너는 물 분자를 양방향으로 세어 '순 이동'을 눈으로 봅니다. 압력을 걸어 삼투를 멈추게 하면 그 값이 곧 삼투압입니다. 역삼투와 해수 담수화까지.",
    tags: ["삼투","순 이동","삼투압","판트호프 법칙","역삼투","반투막"]
  },
  {
    id: "entropy",
    title: "엔트로피 — 경우의 수 세기",
    cat: "에너지와 자발성",
    path: "entropy/",
    icon: "entropy",
    ready: true,
    desc: "엔트로피를 '무질서'가 아니라 셀 수 있는 가짓수로 다룹니다. 위치의 경우의 수(입자가 어디에 있는가)와 에너지의 경우의 수(에너지를 어떻게 나눠 갖는가)를 모두 세고, 온도가 높을수록 ΔS주위가 작아지는 이유까지 확인합니다.",
    tags: ["엔트로피","경우의 수","ΔS주위","자발성","제2법칙"]
  },
  {
    id: "rate",
    title: "온도와 반응 속도 — 활성화 에너지",
    cat: "화학 반응",
    path: "rate/",
    icon: "rate",
    ready: true,
    desc: "온도를 10 ℃ 올리면 충돌 수는 2 %만 느는데 속도는 2배가 됩니다. 나머지가 어디서 오는지 맥스웰–볼츠만 분포의 꼬리 면적으로 직접 계산합니다. 촉매와 Ea·ΔH 2색 도표까지.",
    tags: ["활성화 에너지","맥스웰–볼츠만","유효 충돌","촉매","반응 엔탈피"]
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
    id: "equilibrium",
    title: "화학 평형과 르샤틀리에",
    cat: "화학 평형",
    path: "equilibrium/",
    icon: "balance",
    ready: false,
    desc: "농도·온도·압력을 바꿨을 때 평형이 어느 쪽으로 이동하는지 막대그래프로 확인합니다.",
    tags: ["평형 상수","르샤틀리에","정반응/역반응"]
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
  gas:`<circle cx="18" cy="20" r="5"/><circle cx="40" cy="14" r="4"/><circle cx="46" cy="38" r="6"/>
       <circle cx="24" cy="44" r="4"/><circle cx="34" cy="29" r="3"/>`,
  flask:`<path d="M26 8v18L12 50a4 4 0 0 0 3.5 6h33A4 4 0 0 0 52 50L38 26V8" fill="none"
         stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
         <path d="M22 8h20" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
         <path d="M18 42h28" stroke="currentColor" stroke-width="4"/>`,
  balance:`<path d="M32 10v42M14 52h36M8 24h48M8 24l-6 14a8 8 0 0 0 12 0zM56 24l6 14a8 8 0 0 1-12 0z"
           fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>`,
  rate:`<path d="M8 50c8 0 10-32 20-32s12 32 24 32" fill="none" stroke="currentColor"
        stroke-width="4" stroke-linecap="round"/><path d="M8 56h48" stroke="currentColor" stroke-width="4"/>`,
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
  crystal:`<path d="M32 6l22 14v24L32 58 10 44V20z" fill="none" stroke="currentColor"
           stroke-width="4" stroke-linejoin="round"/><path d="M32 6v52M10 20l44 24M54 20L10 44"
           stroke="currentColor" stroke-width="2.5" opacity=".45"/>`,

  /* ↓ 물질과 에너지 교과용으로 추가 (2026-07-30) */
  vapor:`<path d="M20 28h24v20a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z" fill="none"
         stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
         <path d="M17 28h30" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
         <path d="M22 44h20" stroke="currentColor" stroke-width="3" opacity=".5"/>
         <circle cx="26" cy="17" r="3"/><circle cx="37" cy="11" r="2.6"/>
         <circle cx="33" cy="21" r="2.2"/><circle cx="44" cy="18" r="2.4"/>`,
  osmosis:`<rect x="6" y="14" width="52" height="38" rx="4" fill="none"
           stroke="currentColor" stroke-width="4"/>
           <path d="M32 14v38" stroke="currentColor" stroke-width="3" stroke-dasharray="3 3"/>
           <path d="M18 33h20M34 28l6 5-6 5" fill="none" stroke="currentColor"
           stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
           <circle cx="47" cy="23" r="3.6"/><circle cx="50" cy="43" r="3.6"/>`,
  entropy:`<rect x="6" y="16" width="52" height="34" rx="4" fill="none"
           stroke="currentColor" stroke-width="4"/>
           <path d="M32 16v34" stroke="currentColor" stroke-width="3" stroke-dasharray="4 4"/>
           <circle cx="16" cy="28" r="3.4"/><circle cx="24" cy="40" r="3.4"/>
           <circle cx="42" cy="26" r="3.4"/><circle cx="50" cy="38" r="3.4"/>
           <circle cx="45" cy="43" r="3.4"/>`
};
