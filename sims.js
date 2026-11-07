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
    id: "osmosis",
    title: "삼투 현상",
    cat: "용액",
    path: "osmosis/",
    icon: "osmosis",
    ready: true,
    desc: "무 조각을 증류수와 설탕·포도당·요소 수용액에 20분 담가 질량 변화를 재고, 반투막 U자관에 농도가 다른 두 용액을 넣어 액면의 높이 차가 천천히 생기는 것을 봅니다. 용질의 종류를 바꿔도 결과는 같고, 액면이 멈춘 뒤에도 양쪽 농도는 같아지지 않습니다 — 높이차가 만드는 압력이 물의 순 이동을 0으로 만든 것입니다.",
    tags: ["삼투","삼투압","반투막","용액의 농도","판트호프 법칙","순 이동","비전해질"]
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
    title: "중화 반응과 이온",
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
  },
  {
    id: "enthalpy",
    title: "엔탈피와 열화학 반응식",
    cat: "화학 반응과 에너지",
    path: "enthalpy/",
    icon: "enthalpy",
    ready: true,
    desc: "손난로와 냉각 팩 안쪽에 온도계를 꽂고 온도 변화를 잰 뒤 손에 쥐어 봅니다. 확대하면 결합이 끊어지고 생기는 과정과 엔탈피 변화가 보이고, 열화학 반응식에서 물질의 양과 상태에 따라 반응 엔탈피가 어떻게 달라지는지 비교합니다.",
    tags: ["엔탈피","반응 엔탈피","발열 반응","흡열 반응","열화학 반응식","손난로","냉각 팩","열의 이동"]
  },
  {
    id: "entropy",
    title: "엔트로피",
    cat: "화학 반응과 에너지",
    path: "entropy/",
    icon: "entropy",
    ready: true,
    desc: "칸막이를 치우면 퍼지는 입자와, 입자 수가 하나 늘 때마다 두 배가 되는 배치의 경우의 수를 화면 분할로 봅니다. 얼음·물·수증기의 움직임과 입자가 갈 수 있는 자리, 기체 분자 수가 줄어드는 반응과 서로 다른 기체의 혼합에서 가짓수를 비교하고, 세 용기에서 물질과 에너지가 드나드는지 확인합니다.",
    tags: ["경우의 수","배치","확산","물질의 상태","기체 분자 수","혼합","에너지의 이동"]
  },
  {
    id: "spontaneity",
    title: "반응의 자발성",
    cat: "화학 반응과 에너지",
    path: "spontaneity/",
    icon: "spontaneity",
    ready: true,
    desc: "비커 둘레에 박스를 그려 열이 드나들 때 주위 입자의 움직임이 어떻게 달라지는지 봅니다. 차가운 주위와 뜨거운 주위에 같은 열을 넣어 달라지는 정도를 비교하고, 냉동실과 교실에서 물이 어는 변화를 계와 주위로 나누어 살펴봅니다.",
    tags: ["자발성","계와 주위","주위의 온도","열의 출입","입자 운동","발열 반응","흡열 반응","전체 엔트로피 변화"]
  },
  {
    id: "predprey",
    title: "개체군 변동과 생태계평형",
    cat: "통합과학",
    path: "predprey/",
    icon: "predprey",
    ready: true,
    desc: "풀·토끼·여우가 함께 사는 섬에서 탐정이 되어 미션 네 개를 풉니다. 예측을 먼저 고른 뒤 섬을 기르고, 여우를 잡아내거나 변인 하나를 바꾸거나 가뭄을 일으켜 무대에서 단서를 모읍니다. 개체수 기록 그래프로 개체군 변동과 생태계평형을 확인합니다.",
    tags: ["생태계평형","개체군","포식자","피식자","먹이 관계","생산자","소비자","환경 변화","탐정 게임"]
  },
  {
    id: "elnino",
    title: "엘니뇨 어부 버티기 게임",
    cat: "통합과학",
    path: "elnino/",
    icon: "elnino",
    ready: true,
    desc: "학급 전체가 태평양 서쪽·동쪽 마을의 어부가 되어 휴대폰으로 가까운 바다·먼바다·쉬기를 고르며 24턴을 버팁니다. 무역풍과 바닷물 온도가 달라지는 신호를 읽고, 엘니뇨가 닥치기 전에 마을 창고에 물고기를 맡겨 대비합니다. 끝나면 턴마다 바다의 물고기 수가 어떻게 바뀌었는지 그래프로 비교합니다. 교실 TV에서 방을 만들고 방 코드로 입장하며, 인터넷 연결이 필요합니다.",
    tags: ["엘니뇨","무역풍","용승","표층 수온","대기와 해양의 상호 작용","어획량","실시간 게임"]
  }
];

/* 카드에 쓰이는 작은 아이콘들 (SVG) */
const ICONS = {
  spontaneity:`<g fill="none"><rect x="8" y="8" width="48" height="48" rx="5" stroke="currentColor" stroke-width="2.4" stroke-dasharray="4 4" opacity=".55"/><rect x="22" y="19" width="20" height="27" rx="2" stroke="currentColor" stroke-width="2.6"/><rect x="21" y="17" width="22" height="5" rx="1.5" fill="currentColor"/><path d="M24 36h16v8H24z" fill="currentColor" opacity=".28"/><path d="M5 22h6M3 25h7M53 38h6M55 41h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/><circle cx="14" cy="19" r="2.5" fill="currentColor"/><circle cx="50" cy="35" r="2.5" fill="currentColor"/></g>`,
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
  osmosis:`<path d="M14 8v34a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6V8" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
           <path d="M38 8v34a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6V8" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" transform="translate(-6 0)"/>
           <path d="M20 44h18" stroke="currentColor" stroke-width="4"/>
           <path d="M29 38v10" stroke="currentColor" stroke-width="3" stroke-dasharray="2 2"/>
           <path d="M14 30h12M38 20h12" stroke="currentColor" stroke-width="3" opacity=".55"/>
           <circle cx="42" cy="26" r="2.2"/><circle cx="46" cy="33" r="2.2"/><circle cx="41" cy="38" r="2.2"/>`,
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
             <path d="M20 54h24" stroke="currentColor" stroke-width="3" opacity=".5"/>`,
  enthalpy:`<rect x="8" y="16" width="18" height="30" rx="5" fill="none" stroke="currentColor" stroke-width="3.5"/>
            <rect x="38" y="16" width="18" height="30" rx="5" fill="none" stroke="currentColor" stroke-width="3.5"/>
            <path d="M28 26h7M33 22l4 4-4 4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M36 38h-7M31 34l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M17 10v12M47 10v12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`,
  entropy:`<rect x="5" y="9" width="54" height="46" rx="7" stroke="currentColor" stroke-width="3"/><path d="M32 11v42" stroke="currentColor" stroke-width="2" stroke-dasharray="3 4" opacity=".45"/><circle cx="14" cy="20" r="3.4" fill="currentColor"/><circle cx="24" cy="18" r="3.4" fill="currentColor"/><circle cx="18" cy="30" r="3.4" fill="currentColor"/><circle cx="27" cy="35" r="3.4" fill="currentColor"/><circle cx="14" cy="43" r="3.4" fill="currentColor"/><circle cx="39" cy="23" r="3.4" fill="currentColor"/><circle cx="49" cy="39" r="3.4" fill="currentColor"/><path d="M27 25c6 0 8 5 13 7M37 29l4 3-5 2" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  predprey:`<path d="M6 44c6-24 12-24 18 0s12 24 18 0 12-24 16-6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            <path d="M6 50c8-10 14-10 20 0s12 10 20 0 10-10 12-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-dasharray="5 4" stroke-linecap="round" opacity=".6"/>
            <ellipse cx="44" cy="14" rx="7" ry="5"/><path d="M41 10l-1-7M46 10l2-7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`,
  elnino:`<image href="data:image/png;base64,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" x="0" y="0" width="64" height="64"/>`
};
