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
    id: "raoult",
    title: "증기 압력 내림",
    cat: "용액",
    path: "raoult/",
    icon: "raoult",
    ready: true,
    desc: "밀폐한 그릇 속 물이 동적 평형에 이르면 기체가 증기 압력을 나타냅니다. 여기에 비휘발성 용질을 녹이면 압력이 내려가는데, 흔히 말하는 「용질이 표면을 덮어 막아서」가 정말 맞는지 세 가지 가정을 각각 돌려 확인합니다. 덮개를 씌우면 나가는 것도 들어오는 것도 함께 막혀 평형은 그대로입니다 — 달라지는 것은 도달까지 걸리는 시간뿐입니다.",
    tags: ["증기 압력","증기 압력 내림","라울 법칙","몰분율","동적 평형","비휘발성 용질","묽은 용액","총괄성"]
  },
  {
    id: "waterdensity",
    title: "물의 밀도와 분자 배열",
    cat: "용액",
    path: "waterdensity/",
    icon: "waterdensity",
    ready: true,
    desc: "비커에 담긴 −4 ℃ 얼음을 10 ℃까지 가열하면서 물 1 g의 부피와 밀도를 구간마다 읽습니다. 같은 실험을 분자 배열로 바꾸면 육각 고리 안쪽의 빈 공간이 다른 물 분자로 채워지는 것이 보입니다. 수소 결합의 「개수」는 온도가 오를수록 계속 줄어드는데 부피는 줄었다가 늘어납니다 — 개수는 원인이 아닙니다.",
    tags: ["물의 밀도","얼음","육각형 배열","개방 구조","수소 결합","4 ℃","열팽창","부피 변화","비열"]
  },
  {
    id: "colligative",
    title: "끓는점 오름과 어는점 내림",
    cat: "용액",
    path: "colligative/",
    icon: "colligative",
    ready: true,
    desc: "물과 소금물을 나란히 놓고 80 → 105 ℃로 가열하고, 5 → −5 ℃로 냉각합니다. 입자 모형으로 바꾸면 용질이 표면을 가로막는 그림이 보이지만, 온도와 증기 압력은 해리를 반영한 이상 용액 근사로 계산합니다 — 소금이 기계적인 벽이라는 뜻은 아닙니다. 순수한 물은 얼음이 자라는 동안 0 ℃에 머물고, 소금물은 남은 액체가 진해지며 계속 내려갑니다.",
    tags: ["끓는점 오름","어는점 내림","총괄성","몰랄 농도","포화 증기 압력","가열 곡선","냉각 곡선","용액"]
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
    id: "anolis",
    title: "자연선택과 획득 형질",
    cat: "통합과학",
    path: "anolis/",
    icon: "anolis",
    ready: true,
    desc: "같은 도마뱀 무리에 같은 폭풍을 두 가설로 각각 돌립니다. 폭풍을 견디면 두 탭 모두 발바닥이 넓어집니다 — 갈리는 것은 그 넓이가 자손에게 가느냐입니다. 「살면서 얻은 것이 자손에게 간 몫」과 「변이 없는 개체군」이 두 가설을 가릅니다.",
    tags: ["자연선택","변이","획득 형질","용불용설","개체군","진화","아놀도마뱀"]
  },
  {
    id: "popgame",
    title: "개체군 생존 게임",
    cat: "통합과학",
    path: "popgame/",
    icon: "popgame",
    ready: true,
    desc: "모둠마다 개체 20마리에 형질값을 나눠 담아 제출하면, 환경이 바뀔 때마다 살아남는 범위 밖의 개체가 사라집니다. 개체 하나하나의 값은 끝까지 바뀌지 않는데 무리의 분포만 달라집니다. 똑같이 맞춰 놓은 무리가 다음 환경에서 어떻게 되는지 봅니다.",
    tags: ["자연선택","변이","개체군","유전적 다양성","진화","환경 변화"]
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
  },
  {
    id: "redox",
    title: "산화와 환원",
    cat: "통합과학",
    path: "redox/",
    icon: "redox",
    ready: true,
    desc: "두 실험 탭. 「산화 구리(Ⅱ) 실험」에서는 검은 가루를 가열해 붉은색 구리가 생기고 석회수가 뿌옇게 흐려지는 과정을 3D 장치로 재현하며, 분자 크기로 확대하면 산소가 구리를 떠나 탄소에게 가는 것이 보입니다 — 산소를 잃는 환원과 산소를 얻는 산화는 항상 동시에 일어납니다. 「마그네슘의 연소」에서는 밝은 빛을 내며 타는 마그네슘을 확대해, 산소와 결합하는 이면에서 마그네슘이 전자를 잃어 Mg²⁺가 되고 산소가 전자를 얻어 O²⁻가 되는 것 — 전자의 이동을 확인합니다.",
    tags: ["산화","환원","산소의 이동","전자의 이동","동시성","산화 구리(Ⅱ)","마그네슘의 연소","석회수"]
  },
  {
    id: "neutralize",
    title: "중화 반응과 남은 이온",
    cat: "통합과학",
    path: "neutralize/",
    icon: "neutralize",
    ready: true,
    desc: "묽은 염산과 수산화 나트륨 수용액을 홈판 A~E의 비율 그대로 섞어, 남은 이온을 종류별로 셉니다. 중화 반응은 다섯 조합 «전부»에서 일어나는데 중성이 되는 것은 한 자리뿐입니다 — 갈리는 것은 반응이 일어났는가가 아니라 무엇이 남았는가입니다. 회색으로 그린 Na⁺·Cl⁻는 섞기 전과 뒤의 개수가 같아, 소금 알갱이가 생기지 않는다는 것도 함께 보입니다.",
    tags: ["중화 반응","액성","남은 이온","BTB","중화열","입자 모형","홈판"]
  },
  {
    id: "ionmove",
    title: "이온의 이동과 전기 전도성",
    cat: "통합과학",
    path: "ionmove/",
    icon: "ionmove",
    ready: true,
    desc: "물에 녹였을 때 이온이 생기는지를 전구로 확인하고, 전류를 흘려 어느 이온이 어느 극으로 가는지를 셉니다. 화학식에 OH가 들어 있는 에탄올은 전구를 켜지 못합니다. (−)극 쪽으로 가는 양이온 칸에는 H⁺만이 아니라 종이에 배어 있던 K⁺가 함께 들어 있습니다 — 색을 바꾸지 않을 뿐, 처음부터 계속 움직이고 있었습니다.",
    tags: ["아레니우스 정의","이온의 이동","전기 전도성","전해질","리트머스","에탄올","질산 칼륨"]
  },
  {
    id: "heatflow",
    title: "변화와 에너지의 출입",
    cat: "통합과학",
    path: "heatflow/",
    icon: "heatflow",
    ready: true,
    desc: "응고·기화·연소·전기 분해·광합성·세포호흡 여섯 가지를 스스로 분류합니다. 제출하기 전에는 답이 화면 어디에도 나오지 않고, 여섯 칸을 다 채우면 물리 변화 줄이 비어 있지 않다는 것이 표 자체로 드러납니다. 두 번째 탭에서는 불도 전기도 쓰지 않고 물을 70 ℃ 이상 15분 유지하는 장치를 설계하는데, 밀폐하면 압력계가 위험역에 들어가 실험이 중단됩니다.",
    tags: ["발열","흡열","물리 변화","화학 변화","에너지 출입","발열 팩","산화 칼슘","안전"]
  },
  {
    id: "bondheat",
    title: "결합과 에너지의 흡수·방출",
    cat: "통합과학",
    path: "bondheat/",
    icon: "bondheat",
    ready: true,
    desc: "반응을 두 단계로 나눠, 반응물의 결합을 먼저 끊고 그다음 생성물의 결합을 만듭니다. 다 끊기 전에는 「만들기」가 눌리지 않습니다 — 끊는 일에는 언제나 에너지가 든다는 뜻입니다. 저울에는 숫자가 한 자리도 없고 두 막대의 길이만 있으며, 그 차이가 주변으로 나가거나 주변에서 들어옵니다. 수소의 연소와 물의 전기 분해를 이어서 하면 같은 결합이 방향만 바뀝니다.",
    tags: ["결합","발열 반응","흡열 반응","에너지 출입","계와 주변","메테인의 연소","전기 분해"]
  },
  {
    id: "neutralgame",
    title: "중화점 대결 게임",
    cat: "통합과학",
    path: "neutralgame/",
    icon: "neutralgame",
    ready: true,
    desc: "눈금 없는 뷰렛 다이얼을 돌려 수산화 나트륨 수용액을 넣다가 멈추고, 그 자리의 액성을 맞히는 2~4인 대결입니다. 쓸 수 있는 정보는 천천히 따라오는 온도계와 페놀프탈레인의 색뿐이고, 넣은 양은 끝까지 숫자로 나오지 않습니다. 모두 끝나면 입자 모형으로 하나씩 열어 보는데, 분홍이 되자마자 멈춘 사람의 플라스크에도 OH⁻가 남아 있습니다.",
    tags: ["중화점","지시약 변색점","페놀프탈레인","액성 판정","대결 게임","온도계"]
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
  popgame:`<circle cx="12" cy="40" r="3.2" fill="currentColor"/>
<circle cx="22" cy="40" r="3.2" fill="currentColor"/><circle cx="22" cy="32" r="3.2" fill="currentColor"/>
<circle cx="32" cy="40" r="3.2" fill="currentColor"/><circle cx="32" cy="32" r="3.2" fill="currentColor"/><circle cx="32" cy="24" r="3.2" fill="currentColor"/>
<circle cx="42" cy="40" r="3.2" fill="currentColor"/><circle cx="42" cy="32" r="3.2" fill="currentColor"/>
<circle cx="52" cy="40" r="3.2" fill="currentColor"/>
<path d="M6 46 H58" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  anolis:`<ellipse cx="30" cy="27" rx="14" ry="9" fill="currentColor"/>
          <path d="M44 27c9-2 11-9 9-16" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
          <circle cx="16" cy="44" r="7" fill="currentColor"/>
          <circle cx="44" cy="44" r="7" fill="currentColor"/>`,
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
           stroke="currentColor" stroke-width="2.5" opacity=".45"/>`,
  raoult:`<path d="M16 8v13L8 44a5 5 0 0 0 4.6 7h30.8A5 5 0 0 0 48 44L40 21V8" fill="none"
           stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
           <path d="M12 8h32" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
           <path d="M11 34h34" stroke="currentColor" stroke-width="3" opacity=".55"/>
           <circle cx="20" cy="41" r="2.6"/><circle cx="30" cy="45" r="2.2"/>
           <circle cx="38" cy="40" r="2.6"/><circle cx="26" cy="38" r="3.6" opacity=".55"/>
           <circle cx="22" cy="16" r="2.2"/><circle cx="34" cy="13" r="1.9"/>
           <path d="M54 14v18M49 27l5 5 5-5" fill="none" stroke="currentColor" stroke-width="3"
           stroke-linecap="round" stroke-linejoin="round"/>`,
  waterdensity:`<path d="M12 9v12L6 42a5 5 0 0 0 4.6 7h23.8A5 5 0 0 0 39 42L33 21V9" fill="none"
           stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
           <path d="M8 9h29" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
           <path d="M8 33h29" stroke="currentColor" stroke-width="3" opacity=".55"/>
           <rect x="12" y="22" width="11" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="3"/>
           <rect x="24" y="24" width="8" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="3"/>
           <path d="M46 14v34h14" fill="none" stroke="currentColor" stroke-width="2.6" opacity=".5"
           stroke-linecap="round" stroke-linejoin="round"/>
           <path d="M46 20c5 0 6 16 9 16s5-8 5-8" fill="none" stroke="currentColor" stroke-width="3.4"
           stroke-linecap="round" stroke-linejoin="round"/>`,
  colligative:`<path d="M13 8v13L7 42a5 5 0 0 0 4.6 7h21.8A5 5 0 0 0 38 42L32 21V8" fill="none"
           stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
           <path d="M9 8h27" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
           <path d="M9 32h27" stroke="currentColor" stroke-width="3" opacity=".55"/>
           <circle cx="16" cy="39" r="2.6"/><circle cx="25" cy="43" r="2.2"/><circle cx="31" cy="38" r="2.6"/>
           <circle cx="21" cy="26" r="2.2" opacity=".55"/>
           <path d="M52 9v15M47 14l5-5 5 5" fill="none" stroke="currentColor" stroke-width="3.4"
           stroke-linecap="round" stroke-linejoin="round"/>
           <path d="M52 40v15M47 50l5 5 5-5" fill="none" stroke="currentColor" stroke-width="3.4"
           stroke-linecap="round" stroke-linejoin="round"/>`,
  redox:`<rect x="5" y="16" width="35" height="14" rx="7" fill="none" stroke="currentColor" stroke-width="4"/>
         <circle cx="14" cy="23" r="2.4"/><circle cx="21" cy="23" r="2.4"/><circle cx="28" cy="23" r="2.4"/>
         <path d="M22 36c-3.5 4.5-5.5 7.2-5.5 9.8a5.5 5.5 0 0 0 11 0c0-2.6-2-5.3-5.5-9.8z"
           fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/>
         <path d="M44 23h7l-3-3m3 3-3 3" fill="none" stroke="currentColor" stroke-width="3"
           stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M46 36v14h13V36" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/>
         <path d="M46 44h13" stroke="currentColor" stroke-width="2.5" opacity=".5"/>`,
  neutralize:`<path d="M18 8v14L10 46a5 5 0 0 0 4.6 7h34.8A5 5 0 0 0 54 46L46 22V8" fill="none"
           stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
           <path d="M14 8h36" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
           <path d="M12 33h40" stroke="currentColor" stroke-width="3" opacity=".5"/>
           <circle cx="23" cy="43" r="4.6"/><rect x="33" y="38.4" width="9.2" height="9.2" rx="2.6"/>
           <circle cx="30" cy="24" r="3"/><rect x="37" y="21" width="6" height="6" rx="1.8"/>`,
  ionmove:`<rect x="5" y="12" width="7" height="40" rx="2"/><rect x="52" y="12" width="7" height="40" rx="2"/>
         <rect x="17" y="17" width="30" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="3"/>
         <path d="M24 27h12m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="3"
         stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M40 38H28m4 4-4-4 4-4" fill="none" stroke="currentColor" stroke-width="3"
         stroke-linecap="round" stroke-linejoin="round"/>`,
  heatflow:`<rect x="4" y="16" width="20" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/>
          <rect x="40" y="16" width="20" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/>
          <rect x="9" y="27" width="10" height="15" rx="2"/>
          <path d="M50 22v17" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
          <circle cx="50" cy="42" r="4"/>
          <path d="M26 26h11m-3.5-3.5L37 26l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M38 38H27m3.5 3.5L27 38l3.5-3.5" fill="none" stroke="currentColor" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round"/>`,
  bondheat:`<path d="M10 24 54 16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
          <path d="M32 20v16" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M23 52h18l-9-16z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/>
          <rect x="5" y="28" width="12" height="14" rx="2"/>
          <rect x="47" y="21" width="12" height="25" rx="2"/>`,
  neutralgame:`<rect x="27" y="4" width="10" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="3.5"/>
             <path d="M32 28v4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
             <circle cx="32" cy="36" r="2.4"/>
             <path d="M28 41v4L16 59h32L36 45v-4" fill="none" stroke="currentColor" stroke-width="3.5"
             stroke-linejoin="round" stroke-linecap="round"/>
             <path d="M20 54h24" stroke="currentColor" stroke-width="3" opacity=".5"/>`
};
