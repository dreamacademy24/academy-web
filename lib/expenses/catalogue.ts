import type {CategoryGroup,CategoryItem} from './model';
// Classification examples, not proof that a transaction occurred or was paid.
export const CATEGORY_GROUPS:CategoryGroup[] = [
  {
    "id": "payroll",
    "labelKo": "급여·수당",
    "labelEn": "Payroll & allowances",
    "items": [
      {
        "id": "payroll.regular_salary",
        "groupId": "payroll",
        "labelKo": "정규 급여",
        "labelEn": "Regular salary",
        "aliases": [
          "salary",
          "payroll",
          "wage",
          "teacher",
          "정규 급여"
        ],
        "guideKo": "해당 급여기간의 근로 보수입니다. 가불·반환과 구분하세요.",
        "guideEn": "Salary for a defined pay period. Keep C.A. separate.",
        "exampleKo": "강사·직원의 해당 급여기간 급여",
        "exampleEn": "Salary for a defined pay period. Keep C.A. separate."
      },
      {
        "id": "payroll.tutor_pay",
        "groupId": "payroll",
        "labelKo": "튜터 강사료",
        "labelEn": "Tutor teaching pay",
        "aliases": [
          "tutor",
          "teaching fee",
          "튜터 강사료"
        ],
        "guideKo": "해당 급여기간의 근로 보수입니다. 가불·반환과 구분하세요.",
        "guideEn": "Tutor teaching pay, not tuition collected from the family.",
        "exampleKo": "튜터 수업에 대한 강사료",
        "exampleEn": "Tutor teaching pay, not tuition collected from the family."
      },
      {
        "id": "payroll.extra_work",
        "groupId": "payroll",
        "labelKo": "주말·추가근무 보수",
        "labelEn": "Extra work / trip allowance",
        "aliases": [
          "overtime",
          "weekend",
          "holiday",
          "driver",
          "allowance",
          "주말·추가근무 보수"
        ],
        "guideKo": "해당 급여기간의 근로 보수입니다. 가불·반환과 구분하세요.",
        "guideEn": "Approved extra work or employee trip allowance, not regular salary again.",
        "exampleKo": "주말 수업·활동 보조 근무비. 정규급여·가불과 중복 금지",
        "exampleEn": "Approved extra work or employee trip allowance, not regular salary again."
      }
    ]
  },
  {
    "id": "education",
    "labelKo": "교육·활동비",
    "labelEn": "Education & activities",
    "items": [
      {
        "id": "education.books",
        "groupId": "education",
        "labelKo": "교재·도서",
        "labelEn": "Books & learning materials",
        "aliases": [
          "book",
          "textbook",
          "reading",
          "교재·도서"
        ],
        "guideKo": "수업·프로그램에 실제 사용한 재료·운영비입니다. 사용 반·행사를 메모하세요.",
        "guideEn": "Books purchased for classes; confirm the purpose when a notebook just says Books.",
        "exampleKo": "수업용 책·교재. 원장의 Books는 사용 목적 확인",
        "exampleEn": "Books purchased for classes; confirm the purpose when a notebook just says Books."
      },
      {
        "id": "education.craft_materials",
        "groupId": "education",
        "labelKo": "교구·만들기 재료",
        "labelEn": "Craft & learning supplies",
        "aliases": [
          "craft",
          "clay",
          "velcro",
          "balloon",
          "glue",
          "tape",
          "교구·만들기 재료"
        ],
        "guideKo": "수업·프로그램에 실제 사용한 재료·운영비입니다. 사용 반·행사를 메모하세요.",
        "guideEn": "Clay, Velcro, balloons or glue sticks used for learning activities.",
        "exampleKo": "점토·벨크로·풍선·글루스틱·테이프",
        "exampleEn": "Clay, Velcro, balloons or glue sticks used for learning activities."
      },
      {
        "id": "education.cooking_club",
        "groupId": "education",
        "labelKo": "쿠킹·클럽활동 재료",
        "labelEn": "Cooking / club supplies",
        "aliases": [
          "cooking",
          "science",
          "club",
          "ingredients",
          "쿠킹·클럽활동 재료"
        ],
        "guideKo": "수업·프로그램에 실제 사용한 재료·운영비입니다. 사용 반·행사를 메모하세요.",
        "guideEn": "Ingredients or materials for a class or club, not automatically staff meals.",
        "exampleKo": "요리 재료·Science Club 활동 재료",
        "exampleEn": "Ingredients or materials for a class or club, not automatically staff meals."
      },
      {
        "id": "education.afterschool",
        "groupId": "education",
        "labelKo": "방과후 프로그램 운영",
        "labelEn": "After-school operations",
        "aliases": [
          "afterschool",
          "after school",
          "watergun",
          "activity",
          "방과후 프로그램 운영"
        ],
        "guideKo": "수업·프로그램에 실제 사용한 재료·운영비입니다. 사용 반·행사를 메모하세요.",
        "guideEn": "Materials actually used for an after-school activity.",
        "exampleKo": "물총놀이 등 활동 운영에 쓴 물품·소모비",
        "exampleEn": "Materials actually used for an after-school activity."
      },
      {
        "id": "education.fieldtrip",
        "groupId": "education",
        "labelKo": "필드트립 운영",
        "labelEn": "Field-trip operations",
        "aliases": [
          "fieldtrip",
          "field trip",
          "entrance",
          "event",
          "필드트립 운영"
        ],
        "guideKo": "수업·프로그램에 실제 사용한 재료·운영비입니다. 사용 반·행사를 메모하세요.",
        "guideEn": "Actual trip or entrance costs; money handed to a staff member first is an advance.",
        "exampleKo": "체험·입장·행사 운영비. 선급금 지급만으로 비용 확정하지 않음",
        "exampleEn": "Actual trip or entrance costs; money handed to a staff member first is an advance."
      }
    ]
  },
  {
    "id": "student_food",
    "labelKo": "학생 식음료비",
    "labelEn": "Student food & water",
    "items": [
      {
        "id": "student_food.student_snacks",
        "groupId": "student_food",
        "labelKo": "학생 간식",
        "labelEn": "Student snacks",
        "aliases": [
          "student snack",
          "donut",
          "doughnut",
          "학생 간식"
        ],
        "guideKo": "학생에게 제공한 식음료입니다. 직원용은 복리후생으로 구분하세요.",
        "guideEn": "Snacks provided to students. Staff snacks belong to Staff welfare.",
        "exampleKo": "학생에게 제공한 도넛 등 간식",
        "exampleEn": "Snacks provided to students. Staff snacks belong to Staff welfare."
      },
      {
        "id": "student_food.drinking_water",
        "groupId": "student_food",
        "labelKo": "음용수",
        "labelEn": "Drinking water",
        "aliases": [
          "water",
          "nature spring",
          "natures spring",
          "gallon",
          "음용수"
        ],
        "guideKo": "학생에게 제공한 식음료입니다. 직원용은 복리후생으로 구분하세요.",
        "guideEn": "Drinking water; select the unit/house that benefited.",
        "exampleKo": "Nature’s Spring 대용량 생수 등",
        "exampleEn": "Drinking water; select the unit/house that benefited."
      }
    ]
  },
  {
    "id": "welfare",
    "labelKo": "복리후생비",
    "labelEn": "Staff welfare",
    "items": [
      {
        "id": "welfare.staff_food",
        "groupId": "welfare",
        "labelKo": "직원 식사·간식",
        "labelEn": "Staff meals & snacks",
        "aliases": [
          "staff snack",
          "atte",
          "ate",
          "meal",
          "food",
          "직원 식사·간식"
        ],
        "guideKo": "직원 대상 회사 승인 복리후생입니다. 개인 지원·가불과 구분하세요.",
        "guideEn": "Meals or snacks for staff, separate from student snacks.",
        "exampleKo": "강사·아떼 등 직원용 식사·간식. 학생용과 분리",
        "exampleEn": "Meals or snacks for staff, separate from student snacks."
      },
      {
        "id": "welfare.staff_support",
        "groupId": "welfare",
        "labelKo": "회사 승인 직원지원",
        "labelEn": "Approved staff support",
        "aliases": [
          "rice",
          "support",
          "welfare",
          "benefit",
          "회사 승인 직원지원"
        ],
        "guideKo": "직원 대상 회사 승인 복리후생입니다. 개인 지원·가불과 구분하세요.",
        "guideEn": "Rice or other company-approved staff support, not personal help or a cash advance.",
        "exampleKo": "회사 복리후생으로 승인된 지원. 개인적 도움·가불은 별도 확인",
        "exampleEn": "Rice or other company-approved staff support, not personal help or a cash advance."
      }
    ]
  },
  {
    "id": "occupancy",
    "labelKo": "임차료·관리비",
    "labelEn": "Rent, dues & utilities",
    "items": [
      {
        "id": "occupancy.academy_rent",
        "groupId": "occupancy",
        "labelKo": "학원 임차료",
        "labelEn": "Academy rent",
        "aliases": [
          "rent",
          "msy",
          "lease",
          "학원 임차료"
        ],
        "guideKo": "실제 임대·관리·공과금 청구에 따른 비용입니다. 지급일과 해당 월을 따로 기록하세요.",
        "guideEn": "Academy rent. Record payment date and the rental period separately.",
        "exampleKo": "MSY 학원 월세. 지급일과 해당 임대월을 따로 기록",
        "exampleEn": "Academy rent. Record payment date and the rental period separately."
      },
      {
        "id": "occupancy.management_dues",
        "groupId": "occupancy",
        "labelKo": "시설 관리비",
        "labelEn": "Management / subdivision dues",
        "aliases": [
          "dues",
          "management",
          "association",
          "subdivision",
          "시설 관리비"
        ],
        "guideKo": "실제 임대·관리·공과금 청구에 따른 비용입니다. 지급일과 해당 월을 따로 기록하세요.",
        "guideEn": "The actual bill for dues; payment month may differ from the billed month.",
        "exampleKo": "실제 청구서상 학원 관리비. 이번 표본의 납부 확정 아님",
        "exampleEn": "The actual bill for dues; payment month may differ from the billed month."
      },
      {
        "id": "occupancy.house_rent",
        "groupId": "occupancy",
        "labelKo": "하우스 임차료",
        "labelEn": "House rent",
        "aliases": [
          "house rent",
          "rent",
          "lease",
          "월세",
          "임대"
        ],
        "guideKo": "드림하우스 임차료입니다. 하우스와 해당 임대월을 지정하세요.",
        "guideEn": "Choose the house and rental period.",
        "exampleKo": "해당 하우스 월세. 지급일과 임대월은 따로 기록",
        "exampleEn": "Rent for the selected house, with payment date and rental period kept separate."
      },
      {
        "id": "occupancy.utilities",
        "groupId": "occupancy",
        "labelKo": "전기·수도요금",
        "labelEn": "Electricity / water utility",
        "aliases": [
          "electricity",
          "electric",
          "veco",
          "water utility",
          "수도",
          "전기"
        ],
        "guideKo": "사업장·하우스 사용요금입니다. 공통 계량기 비용을 근거 없이 균등 배분하지 마세요.",
        "guideEn": "Use the actual utility bill. Do not invent an equal split for shared meters.",
        "exampleKo": "해당 사업장·하우스 전기·수도 청구서가 확인된 경우",
        "exampleEn": "A verified electricity/water bill for the benefiting unit or house."
      }
    ]
  },
  {
    "id": "communications",
    "labelKo": "통신비",
    "labelEn": "Internet & mobile",
    "items": [
      {
        "id": "communications.internet",
        "groupId": "communications",
        "labelKo": "인터넷",
        "labelEn": "Internet",
        "aliases": [
          "converge",
          "pldt",
          "internet",
          "wifi",
          "wi-fi",
          "인터넷"
        ],
        "guideKo": "업무용 통신비입니다. 이용 사업장·하우스와 청구서를 확인하세요.",
        "guideEn": "Internet bill for the benefiting unit/house. Flag conflicts between the notebook and receipt.",
        "exampleKo": "Converge 등 학원 인터넷",
        "exampleEn": "Internet bill for the benefiting unit/house. Flag conflicts between the notebook and receipt."
      },
      {
        "id": "communications.business_mobile",
        "groupId": "communications",
        "labelKo": "업무용 통신",
        "labelEn": "Business mobile / load",
        "aliases": [
          "load",
          "recharge",
          "mobile",
          "phone",
          "업무용 통신"
        ],
        "guideKo": "업무용 통신비입니다. 이용 사업장·하우스와 청구서를 확인하세요.",
        "guideEn": "Business-use phone or load only, not personal usage.",
        "exampleKo": "업무용 휴대전화 충전 등. 개인 사용분 제외·증빙 확인",
        "exampleEn": "Business-use phone or load only, not personal usage."
      }
    ]
  },
  {
    "id": "office_print",
    "labelKo": "사무·인쇄비",
    "labelEn": "Office & printing",
    "items": [
      {
        "id": "office_print.printer_ink",
        "groupId": "office_print",
        "labelKo": "프린터 소모품",
        "labelEn": "Printer ink / toner",
        "aliases": [
          "003",
          "ink",
          "toner",
          "cartridge",
          "프린터 소모품"
        ],
        "guideKo": "사무·인쇄 소모품입니다. 새 장비 구입이나 수리와 구분하세요.",
        "guideEn": "003 ink or toner is a printer consumable, not printer repair.",
        "exampleKo": "003 잉크 등 프린터 잉크",
        "exampleEn": "003 ink or toner is a printer consumable, not printer repair."
      },
      {
        "id": "office_print.paper_lamination",
        "groupId": "office_print",
        "labelKo": "인쇄·코팅용품",
        "labelEn": "Paper & lamination supplies",
        "aliases": [
          "paper",
          "photo",
          "laminate",
          "lamination",
          "film",
          "인쇄·코팅용품"
        ],
        "guideKo": "사무·인쇄 소모품입니다. 새 장비 구입이나 수리와 구분하세요.",
        "guideEn": "Copy/photo paper or laminating film.",
        "exampleKo": "포토용지·코팅필름·복사용지",
        "exampleEn": "Copy/photo paper or laminating film."
      },
      {
        "id": "office_print.stationery",
        "groupId": "office_print",
        "labelKo": "문구·보드용품",
        "labelEn": "Stationery & board supplies",
        "aliases": [
          "marker",
          "stapler",
          "whiteboard",
          "stationery",
          "문구·보드용품"
        ],
        "guideKo": "사무·인쇄 소모품입니다. 새 장비 구입이나 수리와 구분하세요.",
        "guideEn": "Board markers, staplers or whiteboard supplies, not installation labor.",
        "exampleKo": "보드마커·스테이플러·화이트보드 스티커",
        "exampleEn": "Board markers, staplers or whiteboard supplies, not installation labor."
      },
      {
        "id": "office_print.filing",
        "groupId": "office_print",
        "labelKo": "서류 보관용품",
        "labelEn": "Filing & storage supplies",
        "aliases": [
          "clearbook",
          "clear book",
          "envelope",
          "file",
          "folder",
          "서류 보관용품"
        ],
        "guideKo": "사무·인쇄 소모품입니다. 새 장비 구입이나 수리와 구분하세요.",
        "guideEn": "Clear books, envelopes or document files.",
        "exampleKo": "클리어북·서류봉투·파일",
        "exampleEn": "Clear books, envelopes or document files."
      }
    ]
  },
  {
    "id": "cleaning",
    "labelKo": "청소·생활소모품",
    "labelEn": "Cleaning & consumables",
    "items": [
      {
        "id": "cleaning.detergent",
        "groupId": "cleaning",
        "labelKo": "세척·소독용품",
        "labelEn": "Detergent & disinfectant",
        "aliases": [
          "zonrox",
          "bleach",
          "soap",
          "detergent",
          "disinfectant",
          "세척·소독용품"
        ],
        "guideKo": "청소·생활에 사용하는 소모품과 도구입니다. 사용 사업장·하우스를 지정하세요.",
        "guideEn": "Dishwashing liquid, Zonrox or disinfectant used for cleaning.",
        "exampleKo": "주방세제·Zonrox 등 세척/소독제",
        "exampleEn": "Dishwashing liquid, Zonrox or disinfectant used for cleaning."
      },
      {
        "id": "cleaning.hygiene",
        "groupId": "cleaning",
        "labelKo": "위생 소모품",
        "labelEn": "Hygiene consumables",
        "aliases": [
          "trash",
          "garbage",
          "bag",
          "wipes",
          "tissue",
          "위생 소모품"
        ],
        "guideKo": "청소·생활에 사용하는 소모품과 도구입니다. 사용 사업장·하우스를 지정하세요.",
        "guideEn": "Trash bags or cleaning wipes; class-use materials follow their actual purpose.",
        "exampleKo": "쓰레기봉투·청소용 물티슈. 수업용 물티슈는 용도 확인",
        "exampleEn": "Trash bags or cleaning wipes; class-use materials follow their actual purpose."
      },
      {
        "id": "cleaning.cleaning_tools",
        "groupId": "cleaning",
        "labelKo": "청소도구",
        "labelEn": "Cleaning tools",
        "aliases": [
          "broom",
          "dustpan",
          "mop",
          "brush",
          "청소도구"
        ],
        "guideKo": "청소·생활에 사용하는 소모품과 도구입니다. 사용 사업장·하우스를 지정하세요.",
        "guideEn": "Brooms, dustpans or other cleaning tools.",
        "exampleKo": "빗자루·쓰레받기 등. 저해상도 품목은 확인 후 확정",
        "exampleEn": "Brooms, dustpans or other cleaning tools."
      },
      {
        "id": "cleaning.batteries",
        "groupId": "cleaning",
        "labelKo": "생활설비 소모품·배터리",
        "labelEn": "Household consumables / batteries",
        "aliases": [
          "battery",
          "batteries",
          "smartlock",
          "smart lock",
          "배터리",
          "도어락"
        ],
        "guideKo": "스마트락 배터리 같은 반복 사용 소모품입니다. 새 스마트락 구입·수리와 구분하세요.",
        "guideEn": "Routine consumables, not a new lock or repair.",
        "exampleKo": "스마트락 교체용 배터리",
        "exampleEn": "Replacement smart-lock batteries."
      }
    ]
  },
  {
    "id": "equipment",
    "labelKo": "비품·집기 구입비",
    "labelEn": "Equipment & furniture",
    "items": [
      {
        "id": "equipment.furniture",
        "groupId": "equipment",
        "labelKo": "가구·수납",
        "labelEn": "Furniture & storage",
        "aliases": [
          "shelf",
          "desk",
          "chair",
          "organizer",
          "cabinet",
          "가구·수납"
        ],
        "guideKo": "신규로 구입한 비품·장비입니다. 기존 물품 이동은 지출이 아닙니다. 고가 장비의 비용·자산 처리는 대표 확인이 필요합니다.",
        "guideEn": "A new desk or shelf; moving an existing item between rooms is not a new purchase.",
        "exampleKo": "책장·책상·오거나이저 등 신규 구입",
        "exampleEn": "A new desk or shelf; moving an existing item between rooms is not a new purchase."
      },
      {
        "id": "equipment.work_equipment",
        "groupId": "equipment",
        "labelKo": "업무장비",
        "labelEn": "Business equipment purchase",
        "aliases": [
          "laptop",
          "computer",
          "printer",
          "equipment",
          "업무장비"
        ],
        "guideKo": "신규로 구입한 비품·장비입니다. 기존 물품 이동은 지출이 아닙니다. 고가 장비의 비용·자산 처리는 대표 확인이 필요합니다.",
        "guideEn": "New laptop or printer. The owner must confirm expense versus asset treatment.",
        "exampleKo": "노트북·프린터 등 신규 업무장비 구입. 이번 표본에서 모두 구매 확정한 뜻 아님",
        "exampleEn": "New laptop or printer. The owner must confirm expense versus asset treatment."
      }
    ]
  },
  {
    "id": "maintenance",
    "labelKo": "수리·유지보수비",
    "labelEn": "Repairs & maintenance",
    "items": [
      {
        "id": "maintenance.printer_repair",
        "groupId": "maintenance",
        "labelKo": "프린터 수리",
        "labelEn": "Printer repair",
        "aliases": [
          "printer repair",
          "printer service",
          "프린터 수리"
        ],
        "guideKo": "기존 시설·설비의 수리·관리입니다. 새 물품 구입·소모품과 구분하세요.",
        "guideEn": "Repair or inspection of an existing printer, not ink or a new printer.",
        "exampleKo": "프린터 점검·수리. 잉크 구입과 구분",
        "exampleEn": "Repair or inspection of an existing printer, not ink or a new printer."
      },
      {
        "id": "maintenance.installation",
        "groupId": "maintenance",
        "labelKo": "설치·시설 수리",
        "labelEn": "Installation / facility work",
        "aliases": [
          "install",
          "board",
          "facility",
          "labor",
          "설치·시설 수리"
        ],
        "guideKo": "기존 시설·설비의 수리·관리입니다. 새 물품 구입·소모품과 구분하세요.",
        "guideEn": "Installation labor or facility work; distinguish it from buying materials.",
        "exampleKo": "보드 설치 등 작업비. 작업 성격 확인",
        "exampleEn": "Installation labor or facility work; distinguish it from buying materials."
      },
      {
        "id": "maintenance.other_facility",
        "groupId": "maintenance",
        "labelKo": "설비 유지보수",
        "labelEn": "Other facility maintenance",
        "aliases": [
          "maintenance",
          "repair",
          "facility",
          "설비 유지보수"
        ],
        "guideKo": "기존 시설·설비의 수리·관리입니다. 새 물품 구입·소모품과 구분하세요.",
        "guideEn": "Other actual facility repair. Identify the site and purpose.",
        "exampleKo": "에어컨·전기·배관 등 실제 수리 내역 확인 후 사용",
        "exampleEn": "Other actual facility repair. Identify the site and purpose."
      },
      {
        "id": "maintenance.aircon",
        "groupId": "maintenance",
        "labelKo": "에어컨 청소·수리",
        "labelEn": "Aircon cleaning / repair",
        "aliases": [
          "ac",
          "a/c",
          "aircon",
          "air conditioner",
          "에어컨",
          "에어콘",
          "냉방"
        ],
        "guideKo": "기존 에어컨 청소·수리비입니다. 신규 에어컨 구입은 비품으로 구분하세요.",
        "guideEn": "Servicing an existing air conditioner, not buying a new one.",
        "exampleKo": "해당 하우스 에어컨 청소·수리 작업. 여러 하우스면 실제 배분 근거 확인",
        "exampleEn": "A repair/cleaning job for a stated house; do not guess multi-house splits."
      },
      {
        "id": "maintenance.washing_machine",
        "groupId": "maintenance",
        "labelKo": "세탁기 수리",
        "labelEn": "Washing machine repair",
        "aliases": [
          "washing",
          "washer",
          "laundry",
          "세탁기"
        ],
        "guideKo": "기존 세탁기 수리비입니다. 세제나 새 기계 구입과 구분하세요.",
        "guideEn": "Repair of an existing washer, not detergent or a new machine.",
        "exampleKo": "고장 난 세탁기의 실제 수리 내역",
        "exampleEn": "An actual repair to an existing washing machine."
      },
      {
        "id": "maintenance.electrical_plumbing",
        "groupId": "maintenance",
        "labelKo": "전기·배관 수리",
        "labelEn": "Electrical / plumbing repair",
        "aliases": [
          "electric",
          "plumbing",
          "pipe",
          "wiring",
          "leak",
          "전기",
          "배관",
          "누수"
        ],
        "guideKo": "시설 수리 작업입니다. 공과금 납부와 구분하고 수리 장소를 지정하세요.",
        "guideEn": "Facility repair, not a utility bill; identify the site.",
        "exampleKo": "전기 배선·배관 누수 수리. 공용 시설이면 공통으로 기록",
        "exampleEn": "Wiring or pipe-leak repairs; use Common for genuinely shared facilities."
      }
    ]
  },
  {
    "id": "transport",
    "labelKo": "교통·운행비",
    "labelEn": "Transport & hire",
    "items": [
      {
        "id": "transport.business_travel",
        "groupId": "transport",
        "labelKo": "업무 이동",
        "labelEn": "Business errands / travel",
        "aliases": [
          "fare",
          "taxi",
          "grab",
          "bank",
          "errand",
          "업무 이동"
        ],
        "guideKo": "업무나 활동을 위한 이동비입니다. 목적·행사·이용 사업장을 기록하세요.",
        "guideEn": "Transport for bank visits or purchasing company supplies.",
        "exampleKo": "학원↔은행·물품/간식 구매 이동",
        "exampleEn": "Transport for bank visits or purchasing company supplies."
      },
      {
        "id": "transport.activity_travel",
        "groupId": "transport",
        "labelKo": "활동 관련 이동",
        "labelEn": "Activity-related transport",
        "aliases": [
          "clubhouse",
          "activity transpo",
          "transport",
          "활동 관련 이동"
        ],
        "guideKo": "업무나 활동을 위한 이동비입니다. 목적·행사·이용 사업장을 기록하세요.",
        "guideEn": "Transport for activities; a clubhouse reservation is not automatically a rental fee.",
        "exampleKo": "교사 Clubhouse 방문·활동 왕복 이동",
        "exampleEn": "Transport for activities; a clubhouse reservation is not automatically a rental fee."
      },
      {
        "id": "transport.vehicle_hire",
        "groupId": "transport",
        "labelKo": "차량 임차",
        "labelEn": "Vehicle hire",
        "aliases": [
          "van",
          "hire",
          "rental",
          "pickup",
          "pick up",
          "차량 임차"
        ],
        "guideKo": "업무나 활동을 위한 이동비입니다. 목적·행사·이용 사업장을 기록하세요.",
        "guideEn": "A hired van for a specific business unit, event or pickup.",
        "exampleKo": "픽업·행사용 밴 임차. 이용 사업장·행사 지정",
        "exampleEn": "A hired van for a specific business unit, event or pickup."
      },
      {
        "id": "transport.tutor_travel",
        "groupId": "transport",
        "labelKo": "튜터 이동비",
        "labelEn": "Tutor travel allowance",
        "aliases": [
          "tutor transpo",
          "tutor fare",
          "튜터 이동비"
        ],
        "guideKo": "업무나 활동을 위한 이동비입니다. 목적·행사·이용 사업장을 기록하세요.",
        "guideEn": "Tutor travel. Do not guess a split when pay and transport are combined.",
        "exampleKo": "튜터 교통비. 급여와 묶인 행은 금액 분리 확인",
        "exampleEn": "Tutor travel. Do not guess a split when pay and transport are combined."
      }
    ]
  },
  {
    "id": "other",
    "labelKo": "기타 운영비",
    "labelEn": "Other operating costs",
    "items": [
      {
        "id": "other.other",
        "groupId": "other",
        "labelKo": "기타 지출",
        "labelEn": "Other operating expense",
        "aliases": [
          "other",
          "misc",
          "miscellaneous",
          "기타 지출"
        ],
        "guideKo": "기존 항목에 해당하지 않을 때만 사용하세요. 목적·근거를 대표가 확인해야 합니다.",
        "guideEn": "Use only when no defined category fits; give a clear purpose and evidence.",
        "exampleKo": "위 항목에 해당하지 않는 지출. 목적·영수증·검토자 필수",
        "exampleEn": "Use only when no defined category fits; give a clear purpose and evidence."
      }
    ]
  },
  {
    "id": "vehicle",
    "labelKo": "차량유지비",
    "labelEn": "Vehicle running costs",
    "items": [
      {
        "id": "vehicle.fuel",
        "groupId": "vehicle",
        "labelKo": "주유",
        "labelEn": "Vehicle fuel",
        "aliases": [
          "fuel",
          "gas",
          "gasoline",
          "diesel",
          "petrol",
          "주유",
          "유류"
        ],
        "guideKo": "업무 차량에 실제 주유한 비용입니다. 차량·이용 사업장을 기록하세요.",
        "guideEn": "Actual fuel for a business vehicle; identify the vehicle/unit.",
        "exampleKo": "업무 차량 주유 영수증. 판독 불가 품목은 유류비로 추정하지 않음",
        "exampleEn": "A business-vehicle fuel receipt; illegible text is not proof of fuel."
      },
      {
        "id": "vehicle.repair",
        "groupId": "vehicle",
        "labelKo": "차량 정비·수리",
        "labelEn": "Vehicle service / repair",
        "aliases": [
          "vehicle repair",
          "car service",
          "tire",
          "tyre",
          "oil change",
          "정비",
          "타이어"
        ],
        "guideKo": "업무 차량 정비·수리비입니다. 차량 대출원금과 구분하세요.",
        "guideEn": "Vehicle service/repair, separate from loan principal.",
        "exampleKo": "업무 차량 타이어·정비·수리 청구서가 확인된 경우",
        "exampleEn": "A verified business-vehicle tire/service/repair bill."
      },
      {
        "id": "vehicle.parking",
        "groupId": "vehicle",
        "labelKo": "업무 주차·통행료",
        "labelEn": "Business parking / toll",
        "aliases": [
          "parking",
          "toll",
          "주차",
          "통행료"
        ],
        "guideKo": "업무 운행에 따른 실제 주차·통행료입니다.",
        "guideEn": "Actual parking or toll for a business trip.",
        "exampleKo": "공항 등 업무 운행의 주차·통행 영수증이 확인된 경우",
        "exampleEn": "A verified parking/toll receipt for a business trip."
      }
    ]
  },
  {
    "id": "permits_finance",
    "labelKo": "인허가·금융비용",
    "labelEn": "Permits & finance charges",
    "items": [
      {
        "id": "permits_finance.permits",
        "groupId": "permits_finance",
        "labelKo": "회사 인허가·갱신",
        "labelEn": "Company permits / renewals",
        "aliases": [
          "permit",
          "license",
          "licence",
          "visa",
          "renewal",
          "인허가",
          "비자"
        ],
        "guideKo": "회사 부담으로 승인된 사업·직원 인허가만 해당합니다. 학생 SSP·비자 대행금은 별도 거래입니다.",
        "guideEn": "Company-approved business/staff permits only; student SSP/visa funds are separate.",
        "exampleKo": "회사 인허가 청구·승인·영수증 확인 후 분류하는 예시",
        "exampleEn": "Classify only after verifying the company obligation, approval and receipt."
      },
      {
        "id": "permits_finance.interest_fees",
        "groupId": "permits_finance",
        "labelKo": "대출이자·금융수수료",
        "labelEn": "Loan interest / bank fees",
        "aliases": [
          "interest",
          "bank fee",
          "charge",
          "finance",
          "이자",
          "수수료"
        ],
        "guideKo": "이자·수수료가 분명히 확인된 부분만 기록합니다. 대출원금이나 혼합 납부액을 추정 분할하지 마세요.",
        "guideEn": "Only clearly supported interest/fees; never guess the principal/interest split.",
        "exampleKo": "상환 내역에서 원금과 별도로 확인되는 업무 이자·수수료",
        "exampleEn": "Business interest/fees explicitly separated on the repayment statement."
      }
    ]
  }
];
export const CLASSIFICATION_RULES:{ko:string;en:string}[] = [
  {
    "ko": "예시는 분류 안내용이며 실제 거래 등록·발생·지급 확정이 아닙니다.",
    "en": "Examples explain classification; they are not registered transactions or confirmation of payment."
  },
  {
    "ko": "돈을 보낸 곳이 아니라 실제 혜택을 받은 사업장을 고릅니다. 공통 비용은 근거 없이 배분하지 않습니다.",
    "en": "Choose the benefiting unit, not merely the sender of the money. Keep shared costs unallocated without evidence."
  },
  {
    "ko": "003 잉크는 사무·인쇄, 프린터 수리는 유지보수, 새 프린터는 비품 구입으로 구분합니다.",
    "en": "003 ink is office/printing; printer repair is maintenance; a new printer is equipment."
  },
  {
    "ko": "요리 수업 재료는 교육·활동비, 학생 간식은 학생 식음료, 아떼 간식·회사 승인 쌀 지원은 복리후생입니다. Teacher 같은 수취인 이름만으로 급여라 판단하지 않습니다.",
    "en": "Cooking-class ingredients are education, student snacks are student food, and approved staff snacks/rice are welfare. A receiver label such as Teacher does not make a purchase salary."
  },
  {
    "ko": "9월에 낸 6월분 관리비처럼 지급일과 해당 월이 다를 수 있습니다. 두 필드를 따로 기록합니다.",
    "en": "A June dues bill may be paid in September. Keep payment date and applicable period separate."
  },
  {
    "ko": "Converge 원장과 영수증의 금액이 달랐던 사례처럼 증빙이 충돌하면 금액 확인 필요로 제출합니다. 어느 쪽도 자동 선택하지 않습니다.",
    "en": "If a notebook and Converge receipt disagree, flag an amount conflict; never choose one automatically."
  },
  {
    "ko": "한 영수증에 여러 하우스가 섞이면 원금은 한 번만 기록합니다. 확인된 하우스별 금액만 입력하고, 미확정이면 복수 하우스·미배분으로 남깁니다.",
    "en": "Record a multi-house receipt once. Use supported allocations only, otherwise keep multiple houses/unallocated."
  },
  {
    "ko": "아카데미→드림하우스 예산 전달, C.A., 업무 선급금은 그 자체로 운영비가 아닙니다. 실제 사용 정산과 중복하지 않습니다.",
    "en": "Budget transfers, C.A. and business advances are not operating expenses themselves; do not count them again when settled."
  },
  {
    "ko": "튜터 급여+교통비, 여러 품목 혼합 거래는 항목별 금액 확인 전 임의 분할하지 않습니다.",
    "en": "Do not guess splits for tutor pay plus transport, or other mixed purchases."
  },
  {
    "ko": "모리 식대는 발생 비용과 지급·정산을 구분합니다. 이미 발생 처리한 식대를 지급할 때 다시 비용으로 더하지 않습니다.",
    "en": "Keep Mori meal accrual and settlement separate; paying an accrued meal cost is not a second expense."
  },
  {
    "ko": "학생 SSP·비자 대행금은 회사 인허가 비용과 구분하고, 대출원금은 이자·수수료와 구분합니다.",
    "en": "Student SSP/visa funds are not company permits; loan principal is not interest or fees."
  },
  {
    "ko": "원장과 영수증·수정 전후 사진은 같은 거래일 수 있습니다. VAT 포함 금액의 세금을 다시 더하지 않습니다.",
    "en": "Notebook entries, receipts and revised photos may refer to one transaction. Do not add VAT again to a VAT-inclusive total."
  },
  {
    "ko": "전일 이월·잔액·권종 메모와 기존 물품의 방 이동은 새 지출이 아닙니다.",
    "en": "Opening balances, cash denominations and moving existing equipment are not new expenses."
  },
  {
    "ko": "고가 비품·장비의 비용/자산 처리는 대표 확인이 필요합니다. 판단 전에는 손익에 반영하지 않습니다.",
    "en": "The owner must confirm expense versus asset treatment for major equipment before P&L posting."
  },
  {
    "ko": "입력은 아비·벨라만 가능합니다. 자기 제출 건만 조회하며 전체 원장·서로의 내역·잔액·손익은 대표만 조회합니다.",
    "en": "Only Abby and Bella may submit. They see their own submissions, not each other’s records or the owner ledger, balances or P&L."
  }
];

const normalize = (value:string) => value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const initials = (value:string) => [...value].map(c=>{const n=c.charCodeAt(0)-0xac00;return n>=0&&n<11172?INITIALS[Math.floor(n/588)]:c;}).join('');
export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap(g=>g.items);
export function getCategory(id:string|null|undefined) { return ALL_CATEGORIES.find(c=>c.id===id); }
export function searchExpenseCategories(query:string):CategoryItem[] {
 const q=normalize(query);if(!q)return ALL_CATEGORIES;
 return ALL_CATEGORIES.map(c=>{const group=CATEGORY_GROUPS.find(g=>g.id===c.groupId)!;const values=[c.labelEn,c.labelKo,...c.aliases,group.labelEn,group.labelKo].map(normalize);const score=values.some(v=>v===q)?3:values.some(v=>v.startsWith(q))?2:values.some(v=>v.includes(q))||normalize(initials(c.labelKo)).includes(q)?1:0;return{c,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.c);
}
