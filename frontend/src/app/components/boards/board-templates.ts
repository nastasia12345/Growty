export interface TemplateTask {
  title: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'ToDo' | 'InProgress' | 'Done';
}

export interface BoardTemplate {
  id: string;
  name: string;
  emoji: string;
  author: string;
  tagline: string;
  description: string;
  color: string;       // accent colour for the card
  tasks: TemplateTask[];
}

export const BOARD_TEMPLATES: BoardTemplate[] = [

  // ── 1. Empty board ──────────────────────────────────────────
  {
    id: 'empty',
    name: 'Пуста дошка',
    emoji: '✨',
    author: '',
    tagline: 'Почни з нуля',
    description: 'Чистий канбан без попередньо створених завдань. Підходить, коли ти вже знаєш що робити.',
    color: '#64748b',
    tasks: []
  },

  // ── 2. GTD ──────────────────────────────────────────────────
  {
    id: 'gtd',
    name: 'GTD',
    emoji: '🧠',
    author: 'David Allen',
    tagline: 'Getting Things Done',
    description: 'Фіксуй все → обробляй → організовуй → переглядай → дій. Ніколи не тримай задачі в голові.',
    color: '#6366f1',
    tasks: [
      { title: 'Обробити Вхідне (Inbox)', description: 'Переглянь всі нові входи: email, нотатки, повідомлення. Вирішіть що з кожним робити.', priority: 'High', status: 'ToDo' },
      { title: 'Щотижневий огляд (Weekly Review)', description: 'Перегляд всіх списків, проєктів і календаря. Переконайся що нічого не випало.', priority: 'High', status: 'ToDo' },
      { title: 'Сформувати список Наступних Дій', description: 'Конкретні фізичні дії по кожному проєкту. Починаються з дієслова: "Зателефонувати...", "Написати..."', priority: 'Medium', status: 'ToDo' },
      { title: 'Список "Очікую відповіді"', description: 'Все що делеговано або чекає на відповідь інших людей.', priority: 'Medium', status: 'ToDo' },
      { title: 'Список "Колись / Може бути"', description: 'Ідеї та проєкти без чіткого дедлайну. Переглядай раз на тиждень.', priority: 'Low', status: 'ToDo' },
      { title: 'Визначити проєкти (>1 кроку)', description: 'Будь-що що потребує більше одного кроку — це проєкт. Зафіксуй бажаний результат.', priority: 'Medium', status: 'ToDo' }
    ]
  },

  // ── 3. Eisenhower Matrix ─────────────────────────────────────
  {
    id: 'eisenhower',
    name: 'Матриця Ейзенхауера',
    emoji: '⚡',
    author: 'Dwight D. Eisenhower',
    tagline: 'Терміново × Важливо',
    description: 'Ділить задачі на 4 квадранти: Роби, Плануй, Делегуй, Видали. Фокус на Квадранті II — важливе, але не термінове.',
    color: '#ef4444',
    tasks: [
      { title: '[Q1] Кризова задача — зробити ЗАРАЗ', description: 'Квадрант I: Терміново + Важливо. Дедлайн палає. Зроби першим.', priority: 'Critical', status: 'ToDo' },
      { title: '[Q2] Стратегічне планування', description: 'Квадрант II: Не терміново + Важливо. Сюди має йти більшість твого часу.', priority: 'High', status: 'ToDo' },
      { title: '[Q2] Навчання та розвиток навичок', description: 'Квадрант II: Інвестиція в майбутнє. Плануй регулярно.', priority: 'High', status: 'ToDo' },
      { title: '[Q2] Профілактика та підготовка', description: 'Квадрант II: Проактивні дії щоб Q1 не виникав.', priority: 'Medium', status: 'ToDo' },
      { title: '[Q3] Термінове але неважливе — делегувати', description: 'Квадрант III: Терміново + Не важливо. Делегуй або спрости.', priority: 'Medium', status: 'ToDo' },
      { title: '[Q4] Переглянути та видалити', description: 'Квадрант IV: Не терміново + Не важливо. Від цього треба позбутися.', priority: 'Low', status: 'ToDo' }
    ]
  },

  // ── 4. Pomodoro ──────────────────────────────────────────────
  {
    id: 'pomodoro',
    name: 'Техніка Помодоро',
    emoji: '🍅',
    author: 'Francesco Cirillo',
    tagline: '25 хв роботи · 5 хв відпочинку',
    description: 'Розбий день на помодори (25+5 хв). 4 помодори → довга перерва. Підвищує концентрацію та знижує прокрастинацію.',
    color: '#f97316',
    tasks: [
      { title: 'Ранковий блок — 4 помодори', description: '4 × 25 хв глибокої роботи + короткі перерви. Найважливіші задачі першими.', priority: 'Critical', status: 'ToDo' },
      { title: 'Оцінити задачі в помодорах', description: 'До початку дня: скільки помодорів займе кожна задача? Запиши поруч.', priority: 'High', status: 'ToDo' },
      { title: 'Денний блок глибокої роботи', description: '2–3 помодори на головний проєкт. Телефон — у режим "Не турбувати".', priority: 'High', status: 'ToDo' },
      { title: 'Адміністративний блок', description: 'Email, повідомлення, дзвінки — в окремому блоці. Не переривай помодорі.', priority: 'Medium', status: 'ToDo' },
      { title: 'Підвечірній огляд прогресу', description: 'Скільки помодорів витрачено? Що заважало? Що перенести на завтра?', priority: 'Medium', status: 'ToDo' },
      { title: 'Планування завтра (останній помодоро)', description: 'Запиши топ-3 задачі на завтра. Закрий всі вкладки. Завершуй ритуал.', priority: 'Low', status: 'ToDo' }
    ]
  },

  // ── 5. MIT ───────────────────────────────────────────────────
  {
    id: 'mit',
    name: 'MIT — Найважливіші Задачі',
    emoji: '🎯',
    author: 'Leo Babauta · Zen Habits',
    tagline: '1 велика + 2–3 середніх на день',
    description: 'Щоранку визнач 1 головну задачу дня. Зроби її ПЕРШОЮ, ще до пошти та нарад. Решта — бонус.',
    color: '#f59e0b',
    tasks: [
      { title: 'MIT #1 — Головна задача дня', description: 'Одна велика задача що наближає до цілі. Зроби її до 12:00. Якщо встигнеш лише її — день вдався.', priority: 'Critical', status: 'ToDo' },
      { title: 'MIT #2 — Важлива підтримуюча задача', description: 'Друга за пріоритетом. Починай лише після MIT #1.', priority: 'High', status: 'ToDo' },
      { title: 'MIT #3 — Корисна задача', description: 'Третя задача. Якщо часу немає — переноси, не скорочуй MIT #1.', priority: 'High', status: 'ToDo' },
      { title: 'Пакетні дрібниці', description: 'Email, дзвінки, адмін. Об\'єднай в один блок після MIT-задач.', priority: 'Medium', status: 'ToDo' },
      { title: 'Вечірній ритуал: обрати MIT на завтра', description: 'Запиши 1-3 MIT на наступний день. Не думай про це вранці — рішення вже прийнято.', priority: 'Medium', status: 'ToDo' }
    ]
  },

  // ── 6. Time Blocking ────────────────────────────────────────
  {
    id: 'timeblocking',
    name: 'Time Blocking',
    emoji: '📅',
    author: 'Cal Newport',
    tagline: 'Заплануй кожну годину наперед',
    description: 'Розбий день на іменовані блоки. Кожна хвилина має призначення. Усуває рішення в моменті та захищає глибоку роботу.',
    color: '#8b5cf6',
    tasks: [
      { title: 'Блок глибокої роботи — ранок', description: '08:00–11:00. Zero interruptions. Найскладніші задачі з повною концентрацією.', priority: 'Critical', status: 'ToDo' },
      { title: 'Блок комунікацій', description: '11:00–12:00. Email, Slack, дзвінки. Тільки в цей час — не раніше.', priority: 'High', status: 'ToDo' },
      { title: 'Блок творчої / проєктної роботи', description: '13:00–15:30. Другий блок глибокої роботи після обіду.', priority: 'High', status: 'ToDo' },
      { title: 'Блок адміністративних задач', description: '15:30–17:00. Дрібниці, зустрічі, документи.', priority: 'Medium', status: 'ToDo' },
      { title: 'Планування наступного дня', description: '17:00–17:30. Закрий всі задачі. Склади план блоків на завтра.', priority: 'Medium', status: 'ToDo' },
      { title: 'Shutdown ritual', description: '17:30. Запис "Shutdown complete". Мозок знає що робочий день завершено.', priority: 'Low', status: 'ToDo' }
    ]
  },

  // ── 7. SCRUM Sprint ─────────────────────────────────────────
  {
    id: 'scrum',
    name: 'SCRUM Sprint',
    emoji: '🏃',
    author: 'Jeff Sutherland',
    tagline: 'Ітеративна робота 1–2 тижні',
    description: 'Гнучка методологія: планування спринту → щоденний стендап → огляд → ретроспектива. Ідеально для проєктів.',
    color: '#0ea5e9',
    tasks: [
      { title: 'Sprint Planning — визначити ціль', description: 'Що буде "Готово" після спринту? Яка ціль спринту? Обери задачі з Backlog.', priority: 'Critical', status: 'ToDo' },
      { title: 'Backlog Grooming', description: 'Переглянь та пріоритизуй Backlog. Декомпозуй великі задачі на менші.', priority: 'High', status: 'ToDo' },
      { title: 'User Story #1 — основна фіча', description: 'Головна задача спринту. Формат: "Як [користувач] я хочу [дія] щоб [результат]"', priority: 'High', status: 'InProgress' },
      { title: 'Daily Standup — трекер перешкод', description: 'Щодня: Що зробив? Що плануєш? Що блокує? Максимум 15 хвилин.', priority: 'Medium', status: 'ToDo' },
      { title: 'Sprint Review — демо результатів', description: 'Покажи що зроблено. Отримай зворотній зв\'язок від стейкхолдерів.', priority: 'Medium', status: 'ToDo' },
      { title: 'Retrospective — покращити процес', description: 'Що пройшло добре? Що покращити? Один конкретний action item на наступний спринт.', priority: 'Medium', status: 'ToDo' }
    ]
  }

];
