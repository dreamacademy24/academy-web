/* 드림 키즈 — 목업 데이터 (코스 > 유닛 > 레슨) */

export type Word = { en: string; ko: string; emoji: string };
export type Lesson = { id: string; title: string; ko: string; words: Word[]; video: { title: string; caption: string } };
export type Unit = { id: string; title: string; ko: string; lessons: Lesson[] };
export type Course = { id: CourseId; name: string; ko: string; icon: string; color: string; soft: string; units: Unit[] };
export type CourseId = "phonics" | "ground" | "mountain" | "sky";

const W = (en: string, ko: string, emoji: string): Word => ({ en, ko, emoji });

function unit(course: string, n: number, title: string, ko: string, lessons: Array<{ t: string; k: string; w: Word[]; v: string }>): Unit {
  return {
    id: `${course}-u${n}`, title, ko,
    lessons: lessons.map((l, i) => ({
      id: `${course}-u${n}-l${i + 1}`, title: l.t, ko: l.k, words: l.w,
      video: { title: `${title} · ${l.t}`, caption: l.v },
    })),
  };
}

export const COURSES: Course[] = [
  {
    id: "phonics", name: "Phonics", ko: "파닉스 섬", icon: "🔤", color: "#F0B429", soft: "#FFF4D6",
    units: [
      unit("phonics", 1, "Letters A-D", "글자 A~D", [
        { t: "A a", k: "에이", v: "A says /a/ — apple, ant, alligator!", w: [W("apple", "사과", "🍎"), W("ant", "개미", "🐜"), W("arrow", "화살", "🏹"), W("axe", "도끼", "🪓")] },
        { t: "B b", k: "비", v: "B says /b/ — ball, bear, banana!", w: [W("ball", "공", "⚽"), W("bear", "곰", "🐻"), W("banana", "바나나", "🍌"), W("bus", "버스", "🚌")] },
        { t: "C & D", k: "씨·디", v: "C says /k/, D says /d/ — cat, dog!", w: [W("cat", "고양이", "🐱"), W("cake", "케이크", "🍰"), W("dog", "강아지", "🐶"), W("duck", "오리", "🦆")] },
      ]),
      unit("phonics", 2, "Letters E-H", "글자 E~H", [
        { t: "E & F", k: "이·에프", v: "E says /e/, F says /f/ — egg, fish!", w: [W("egg", "달걀", "🥚"), W("elephant", "코끼리", "🐘"), W("fish", "물고기", "🐟"), W("frog", "개구리", "🐸")] },
        { t: "G & H", k: "지·에이치", v: "G says /g/, H says /h/ — goat, hat!", w: [W("goat", "염소", "🐐"), W("grapes", "포도", "🍇"), W("hat", "모자", "🎩"), W("horse", "말", "🐴")] },
        { t: "Review 1", k: "복습 1", v: "Let's mix them up! A to H.", w: [W("apple", "사과", "🍎"), W("dog", "강아지", "🐶"), W("fish", "물고기", "🐟"), W("hat", "모자", "🎩")] },
      ]),
      unit("phonics", 3, "Short Vowels", "짧은 모음", [
        { t: "a & e", k: "a·e 소리", v: "cat, bed — short vowel sounds!", w: [W("cat", "고양이", "🐱"), W("bag", "가방", "🎒"), W("bed", "침대", "🛏️"), W("pen", "펜", "🖊️")] },
        { t: "i & o", k: "i·o 소리", v: "pig, dog — listen carefully!", w: [W("pig", "돼지", "🐷"), W("milk", "우유", "🥛"), W("dog", "강아지", "🐶"), W("box", "상자", "📦")] },
        { t: "u", k: "u 소리", v: "sun, bug — the /u/ sound!", w: [W("sun", "해", "☀️"), W("bug", "벌레", "🐛"), W("cup", "컵", "☕"), W("bus", "버스", "🚌")] },
      ]),
    ],
  },
  {
    id: "ground", name: "Ground", ko: "초록 마을", icon: "🌱", color: "#3CB371", soft: "#E3F6EA",
    units: [
      unit("ground", 1, "Hello!", "인사하기", [
        { t: "Greetings", k: "인사", v: "Hello! Hi! Good morning! Let's say hello to Dreamy.", w: [W("hello", "안녕", "👋"), W("good morning", "좋은 아침", "🌅"), W("thank you", "고마워", "🙏"), W("bye", "잘 가", "👋")] },
        { t: "My Name", k: "내 이름", v: "My name is Dreamy. What's your name?", w: [W("name", "이름", "📛"), W("I", "나", "🙋"), W("you", "너", "👉"), W("friend", "친구", "🧑‍🤝‍🧑")] },
        { t: "Feelings", k: "기분", v: "I'm happy! Are you happy today?", w: [W("happy", "행복한", "😊"), W("sad", "슬픈", "😢"), W("angry", "화난", "😠"), W("sleepy", "졸린", "😴")] },
      ]),
      unit("ground", 2, "My Family", "우리 가족", [
        { t: "Family", k: "가족", v: "This is my mom. This is my dad.", w: [W("mom", "엄마", "👩"), W("dad", "아빠", "👨"), W("sister", "여동생/언니", "👧"), W("brother", "남동생/형", "👦")] },
        { t: "At Home", k: "집에서", v: "Where is the bed? In the bedroom!", w: [W("bed", "침대", "🛏️"), W("table", "탁자", "🪑"), W("door", "문", "🚪"), W("window", "창문", "🪟")] },
        { t: "Pets", k: "반려동물", v: "I have a dog. Woof woof!", w: [W("dog", "강아지", "🐶"), W("cat", "고양이", "🐱"), W("rabbit", "토끼", "🐰"), W("bird", "새", "🐦")] },
      ]),
      unit("ground", 3, "Colors & Numbers", "색깔과 숫자", [
        { t: "Colors", k: "색깔", v: "Red, blue, yellow — what color is it?", w: [W("red", "빨강", "🔴"), W("blue", "파랑", "🔵"), W("yellow", "노랑", "🟡"), W("green", "초록", "🟢")] },
        { t: "Numbers 1-5", k: "숫자 1~5", v: "One, two, three, four, five!", w: [W("one", "하나", "1️⃣"), W("two", "둘", "2️⃣"), W("three", "셋", "3️⃣"), W("four", "넷", "4️⃣")] },
        { t: "Shapes", k: "모양", v: "Circle, square, triangle, star!", w: [W("circle", "동그라미", "⭕"), W("square", "네모", "🟥"), W("triangle", "세모", "🔺"), W("star", "별", "⭐")] },
      ]),
    ],
  },
  {
    id: "mountain", name: "Mountain", ko: "구름 산", icon: "⛰️", color: "#2E6BD6", soft: "#E1ECFB",
    units: [
      unit("mountain", 1, "Food", "음식", [
        { t: "Fruits", k: "과일", v: "I like apples. Do you like bananas?", w: [W("apple", "사과", "🍎"), W("banana", "바나나", "🍌"), W("mango", "망고", "🥭"), W("watermelon", "수박", "🍉")] },
        { t: "Meals", k: "식사", v: "Breakfast, lunch, dinner — yummy!", w: [W("rice", "밥", "🍚"), W("bread", "빵", "🍞"), W("soup", "국", "🍲"), W("juice", "주스", "🧃")] },
        { t: "I like…", k: "좋아해요", v: "I like pizza! I don't like carrots.", w: [W("pizza", "피자", "🍕"), W("carrot", "당근", "🥕"), W("ice cream", "아이스크림", "🍦"), W("cookie", "쿠키", "🍪")] },
      ]),
      unit("mountain", 2, "School", "학교", [
        { t: "Classroom", k: "교실", v: "Open your book. Take out your pencil!", w: [W("book", "책", "📖"), W("pencil", "연필", "✏️"), W("desk", "책상", "🪑"), W("teacher", "선생님", "👩‍🏫")] },
        { t: "Actions", k: "동작", v: "Stand up! Sit down! Jump!", w: [W("stand up", "일어서", "🧍"), W("sit down", "앉아", "🪑"), W("jump", "점프", "🦘"), W("run", "달려", "🏃")] },
        { t: "Weather", k: "날씨", v: "It's sunny today. Let's go outside!", w: [W("sunny", "맑은", "☀️"), W("rainy", "비 오는", "🌧️"), W("cloudy", "흐린", "☁️"), W("windy", "바람 부는", "🌬️")] },
      ]),
      unit("mountain", 3, "Body", "우리 몸", [
        { t: "Head to Toe", k: "머리부터 발끝", v: "Head, shoulders, knees and toes!", w: [W("head", "머리", "🙂"), W("hand", "손", "✋"), W("foot", "발", "🦶"), W("eye", "눈", "👁️")] },
        { t: "I can…", k: "할 수 있어요", v: "I can swim! I can dance!", w: [W("swim", "수영", "🏊"), W("dance", "춤", "💃"), W("sing", "노래", "🎤"), W("draw", "그림", "🎨")] },
        { t: "Feel Good", k: "건강", v: "Wash your hands. Brush your teeth!", w: [W("wash", "씻다", "🧼"), W("brush", "닦다", "🪥"), W("sleep", "자다", "😴"), W("eat", "먹다", "🍽️")] },
      ]),
    ],
  },
  {
    id: "sky", name: "Sky", ko: "하늘 나라", icon: "☁️", color: "#9B5DE5", soft: "#F1E8FB",
    units: [
      unit("sky", 1, "Animals", "동물", [
        { t: "Zoo", k: "동물원", v: "Look! A lion! Roar!", w: [W("lion", "사자", "🦁"), W("monkey", "원숭이", "🐵"), W("giraffe", "기린", "🦒"), W("zebra", "얼룩말", "🦓")] },
        { t: "Sea", k: "바다", v: "Fish swim in the sea. Cebu has a beautiful sea!", w: [W("whale", "고래", "🐳"), W("turtle", "거북이", "🐢"), W("octopus", "문어", "🐙"), W("crab", "게", "🦀")] },
        { t: "Bugs", k: "곤충", v: "A butterfly is flying!", w: [W("butterfly", "나비", "🦋"), W("bee", "벌", "🐝"), W("ladybug", "무당벌레", "🐞"), W("snail", "달팽이", "🐌")] },
      ]),
      unit("sky", 2, "Places", "장소", [
        { t: "In Town", k: "동네", v: "Where are you going? To the park!", w: [W("park", "공원", "🏞️"), W("school", "학교", "🏫"), W("hospital", "병원", "🏥"), W("market", "시장", "🛒")] },
        { t: "Cebu Trip", k: "세부 여행", v: "Beach, boat, island — let's go!", w: [W("beach", "해변", "🏖️"), W("boat", "배", "⛵"), W("island", "섬", "🏝️"), W("airplane", "비행기", "✈️")] },
        { t: "Directions", k: "방향", v: "Go straight. Turn left. Turn right!", w: [W("left", "왼쪽", "⬅️"), W("right", "오른쪽", "➡️"), W("up", "위", "⬆️"), W("down", "아래", "⬇️")] },
      ]),
      unit("sky", 3, "Time & Days", "시간과 요일", [
        { t: "Days", k: "요일", v: "Monday, Tuesday, Wednesday…", w: [W("Monday", "월요일", "📅"), W("Friday", "금요일", "🎉"), W("Saturday", "토요일", "🛝"), W("Sunday", "일요일", "⛪")] },
        { t: "Daily Routine", k: "하루 일과", v: "I wake up at seven. I go to school.", w: [W("wake up", "일어나다", "⏰"), W("morning", "아침", "🌄"), W("night", "밤", "🌙"), W("today", "오늘", "📆")] },
        { t: "Graduation", k: "졸업", v: "You did it! Congratulations from Dreamy!", w: [W("great", "멋진", "🌟"), W("proud", "자랑스러운", "🏅"), W("finish", "끝내다", "🏁"), W("celebrate", "축하하다", "🎊")] },
      ]),
    ],
  },
];

export const ALL_LESSONS: Array<Lesson & { courseId: CourseId; unitId: string; index: number }> = (() => {
  const out: Array<Lesson & { courseId: CourseId; unitId: string; index: number }> = [];
  let i = 0;
  for (const c of COURSES) for (const u of c.units) for (const l of u.lessons) out.push({ ...l, courseId: c.id, unitId: u.id, index: i++ });
  return out;
})();

export const STICKERS = ["🦄", "🐲", "🚀", "🌈", "🍭", "🎈", "🦖", "🐬", "🏆", "🎁", "🧁", "🪐", "🐨", "🎠", "🛸", "🍩"];

export const MASCOT_LINES = {
  welcome: ["안녕! 오늘도 같이 영어 놀이하자!", "드림이가 기다렸어! 준비됐어?", "오늘 미션 하나만 해볼까? 금방 끝나!"],
  morning: ["좋은 아침! 상쾌하게 시작해 볼까?"],
  evening: ["오늘 하루 잘 보냈어? 자기 전에 한 판!"],
  video: ["잘 보고 잘 들어봐. 드림이가 옆에 있을게!"],
  speak: ["마이크를 누르고 크게 따라 말해봐!", "부끄러워하지 말고! 틀려도 괜찮아."],
  quiz: ["자, 이제 문제! 천천히 생각해 봐."],
  correct: ["딩동댕! 정답이야!", "우와, 대단해!", "바로 그거야!"],
  wrong: ["아깝다! 다시 한 번 생각해 볼까?", "괜찮아, 한 번 더!"],
  result3: ["완벽해! 별 세 개!! 드림이가 너무 자랑스러워!"],
  result2: ["잘했어! 별 두 개! 다음엔 세 개 가보자!"],
  result1: ["끝까지 해낸 게 제일 멋져! 한 번 더 하면 별이 늘어날 거야."],
  locked: ["여긴 아직 잠겨 있어. 앞 단계를 먼저 깨보자!"],
  streak: ["연속 학습 중! 내일도 잊지 마!"],
  limit: ["오늘은 여기까지! 눈도 쉬어야 해. 내일 또 만나!"],
};
