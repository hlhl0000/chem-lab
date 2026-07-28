/* ============================================================
   시뮬레이션 목록 (사이트의 "카탈로그")

   ★ 새 시뮬레이션을 추가하는 방법 ★
   1) 폴더를 만든다.          예) titration/
   2) 그 안에 index.html 을 만든다.
   3) 아래 SIMS 배열에 한 줄 추가한다.
   → 대문 페이지의 카드와 모든 페이지의 이동 메뉴에 자동으로 나타납니다.

   ready:false 로 두면 "준비 중" 카드로만 보이고 클릭되지 않습니다.
   ============================================================ */

const SIMS = [
  {
    id:    "gas",
    title: "기체 분자 운동",
    cat:   "물질의 상태",
    path:  "gas/",
    icon:  "gas",
    ready: true,
    desc:  "온도·부피·입자 수를 바꾸며 압력과 속력 분포의 변화를 관찰합니다. 피스톤 압축과 맥스웰–볼츠만 분포까지.",
    tags:  ["보일 법칙","샤를 법칙","그레이엄 법칙","맥스웰–볼츠만"]
  },
  {
    id:    "universe",
    title: "우주 초기 원소의 생성",
    cat:   "통합과학",
    path:  "universe/",
    icon:  "universe",
    ready: true,
    desc:  "빅뱅 직후 쿼크에서 시작해 핵자 → 헬륨 원자핵 → 중성 원자가 만들어지기까지를 단계별로 따라갑니다.",
    tags:  ["빅뱅","쿼크","핵융합","원자의 형성","물질과 규칙성"]
  },
  {
    id:    "titration",
    title: "산-염기 적정",
    cat:   "산과 염기",
    path:  "titration/",
    icon:  "flask",
    ready: false,
    desc:  "적하량에 따른 pH 변화를 실시간 곡선으로. 지시약 색 변화와 당량점 판별.",
    tags:  ["적정 곡선","당량점","지시약","pH"]
  },
  {
    id:    "equilibrium",
    title: "화학 평형과 르샤틀리에",
    cat:   "화학 평형",
    path:  "equilibrium/",
    icon:  "balance",
    ready: false,
    desc:  "농도·온도·압력을 바꿨을 때 평형이 어느 쪽으로 이동하는지 막대그래프로 확인합니다.",
    tags:  ["평형 상수","르샤틀리에","정반응/역반응"]
  },
  {
    id:    "rate",
    title: "반응 속도와 활성화 에너지",
    cat:   "화학 반응",
    path:  "rate/",
    icon:  "rate",
    ready: false,
    desc:  "활성화 에너지 문턱을 넘는 분자의 비율이 온도에 따라 어떻게 급증하는지 봅니다.",
    tags:  ["활성화 에너지","촉매","아레니우스"]
  },
  {
    id:    "orbital",
    title: "원자 오비탈과 전자 배치",
    cat:   "원자와 주기율",
    path:  "orbital/",
    icon:  "atom",
    ready: false,
    desc:  "s·p·d 오비탈의 확률 밀도 단면과 쌓음 원리에 따른 전자 배치.",
    tags:  ["오비탈","양자수","쌓음 원리","훈트 규칙"]
  },
  {
    id:    "periodic",
    title: "주기율표 경향성",
    cat:   "원자와 주기율",
    path:  "periodic/",
    icon:  "grid",
    ready: false,
    desc:  "원자 반지름·이온화 에너지·전기음성도를 주기율표 위에 색으로 표시합니다.",
    tags:  ["이온화 에너지","전기음성도","유효 핵전하"]
  },
  {
    id:    "polarity",
    title: "결합의 극성과 쌍극자",
    cat:   "화학 결합",
    path:  "polarity/",
    icon:  "dipole",
    ready: false,
    desc:  "두 원자의 전기음성도 차이에 따라 전자구름이 치우치는 정도를 조절해 봅니다.",
    tags:  ["전기음성도","쌍극자 모멘트","극성/무극성"]
  },
  {
    id:    "solubility",
    title: "용해도 곡선과 재결정",
    cat:   "물질의 상태",
    path:  "solubility/",
    icon:  "crystal",
    ready: false,
    desc:  "온도를 낮출 때 석출되는 양을 용해도 곡선 위에서 계산하고 확인합니다.",
    tags:  ["용해도","포화 용액","재결정"]
  }
];

/* 카드에 쓰이는 작은 아이콘들 (SVG) */
const ICONS = {
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
           stroke="currentColor" stroke-width="2.5" opacity=".45"/>`
};
