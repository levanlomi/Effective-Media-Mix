(() => {
  "use strict";

  const FIT_LABELS = {
    high: "Сильный fit",
    medium: "Средний fit",
    low: "Слабый fit",
  };

  const PLATFORM_ORDER = ["direct", "media", "vk", "telegram", "avito"];

  /** Базовый горизонт бенчмарков в data.json — месяц. */
  const PERIOD_BASE_DAYS = 30;
  const PERIODS = {
    week: { id: "week", label: "Неделя", days: 7 },
    two_weeks: { id: "two_weeks", label: "2 недели", days: 14 },
    month: { id: "month", label: "Месяц", days: 30 },
  };
  const BUDGET_SLIDER_MONTH = { min: 50000, max: 5000000, step: 50000 };
  /** Давление / доля soft-cap, при которых открываем следующий канал. */
  const PLATFORM_UNLOCK_PRESSURE = 0.6;
  const PLATFORM_UNLOCK_CAP_RATIO = 0.9;

  // Хаотичные позиции внутри ёмкости (пересекаются), % от cluster
  const BUBBLE_LAYOUT = {
    direct: { x: 38, y: 34 },
    media: { x: 62, y: 48 },
    vk: { x: 42, y: 66 },
    telegram: { x: 58, y: 28 },
    avito: { x: 55, y: 60 },
  };

  // Модель пересечения аудиторий (frontend/overlap.js, подключается раньше)
  const { calculateAudienceOverlap, DEFAULT_CORRELATION } = window.ECOverlap;

  const PLATFORM_LOGOS = {
    direct: `<img class="bubble-logo-img" src="./assets/logo-direct.png" alt="" width="96" height="96" decoding="async" />`,
    media: `<img class="bubble-logo-img" src="./assets/logo-media.png" alt="" width="96" height="96" decoding="async" />`,
    vk: `<img class="bubble-logo-img" src="./assets/logo-vk.png" alt="" width="96" height="96" decoding="async" />`,
    telegram: `<img class="bubble-logo-img" src="./assets/logo-tg.webp" alt="" width="96" height="96" decoding="async" />`,
    avito: `<img class="bubble-logo-img" src="./assets/logo-avito.jpg" alt="" width="96" height="96" decoding="async" />`,
  };

  const PLATFORM_LOGO_SRC = {
    direct: "./assets/logo-direct.png",
    media: "./assets/logo-media.png",
    vk: "./assets/logo-vk.png",
    telegram: "./assets/logo-tg.webp",
    avito: "./assets/logo-avito.jpg",
  };

  const FIT_STARS = { high: 5, medium: 3, low: 1 };

  /** Качественные тексты для матрицы сравнения (goal → platform). */
  const PLATFORM_COMPARE_COPY = {
    traffic: {
      direct: {
        note: "Отлично закрывает горячий спрос",
        advantage: "Высокая конверсия и качество клика",
        limitation: "Высокий CPM",
      },
      media: {
        note: "Масштабный охват, но ниже CTR",
        advantage: "Широкий охват и большой инвентарь",
        limitation: "Ниже CTR и доходимость до конверсий",
      },
      vk: {
        note: "Хороший охват при средней эффективности",
        advantage: "Минимальное пересечение с другими каналами",
        limitation: "Средний CPM",
      },
      telegram: {
        note: "Средний охват и эффективность",
        advantage: "Дополнительный охват платёжеспособной аудитории",
        limitation: "Ограниченный объём инвентаря",
      },
      avito: {
        note: "Эффективно для широких аудиторий",
        advantage: "Максимальный охват при хорошем CPC",
        limitation: "Зависит от категории и региона",
      },
    },
    reach: {
      direct: {
        note: "Точечный добор горячего спроса",
        advantage: "Качественные клики по целевой аудитории",
        limitation: "Высокий CPM для масштабного охвата",
      },
      media: {
        note: "Лучший инструмент для широкого охвата",
        advantage: "Широкий охват и большой инвентарь",
        limitation: "Ниже CTR и доходимость до конверсий",
      },
      vk: {
        note: "Сильный охват в соцсетях",
        advantage: "Минимальное пересечение с медийкой",
        limitation: "Средняя стоимость при росте частоты",
      },
      telegram: {
        note: "Охват платёжеспособной аудитории",
        advantage: "Доступ к аудитории вне классической медийки",
        limitation: "Ограниченный объём инвентаря",
      },
      avito: {
        note: "Слабый fit для цели охвата",
        advantage: "Дешёвые клики в категории",
        limitation: "Узкий intent и зависимость от категории",
      },
    },
  };

  const state = {
    data: null,
    goal: "reach",
    geo: "capitals",
    industry: "realty",
    period: "two_weeks",
    budget: 2_900_000,
    platforms: {
      direct: false,
      media: false,
      vk: false,
      telegram: false,
      avito: false,
    },
    /** Ручные оверрайды чипов: "on" | "off"; иначе следуем рекомендации. */
    platformOverrides: {},
    /** Закрытые пользователем подсказки: `${id}:on` | `${id}:off`. */
    dismissedPlatformTips: {},
    /** Последний автонабор (без оверрайдов) — для плашек. */
    recommendedPlatforms: [],
    bubblePos: {},
    mixScenarioPool: [],
    unlockShareFromId: null,
  };

  const els = {
    themeToggle: document.getElementById("themeToggle"),
    benchDate: document.getElementById("benchDate"),
    footerSources: document.getElementById("footerSources"),
    goalSwitch: document.getElementById("goalSwitch"),
    geoSwitch: document.getElementById("geoSwitch"),
    periodSwitch: document.getElementById("periodSwitch"),
    industrySelect: document.getElementById("industrySelect"),
    industrySelectWrap: document.querySelector(".industry-select-wrap"),
    budget: document.getElementById("budget"),
    budgetRange: document.getElementById("budgetRange"),
    budgetRichTip: document.getElementById("budgetRichTip"),
    budgetSliderHint: document.getElementById("budgetSliderHint"),
    capacityBars: document.getElementById("capacityBars"),
    overlapMount: document.getElementById("overlapMount"),
    platformGrid: document.getElementById("platformGrid"),
    mixSub: document.getElementById("mixSub"),
    qualityTable: document.querySelector("#qualityTable tbody"),
    qualityCards: document.getElementById("qualityCards"),
    seasonalityMount: document.getElementById("seasonalityMount"),
    seasonalitySub: document.getElementById("seasonalitySub"),
    seasonalityHeadMeta: document.getElementById("seasonalityHeadMeta"),
  };

  function initTheme() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("theme");
    let saved = localStorage.getItem("ec_theme");
    if (saved === "glass") saved = "light";
    const urlTheme = fromUrl === "glass" ? "light" : fromUrl;
    const allowed = new Set(["light", "dark"]);
    const theme = allowed.has(urlTheme) ? urlTheme : allowed.has(saved) ? saved : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeToggleLabel(theme);
  }

  const THEME_SUN_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 00-1.41-1.41l-1.06 1.06a.996.996 0 000 1.41c.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 00-1.41-1.41l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>';
  const THEME_MOON_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  function updateThemeToggleLabel(theme) {
    if (!els.themeToggle) return;
    const labels = {
      light: "Переключить на тёмную тему",
      dark: "Переключить на светлую тему",
    };
    els.themeToggle.setAttribute("aria-label", labels[theme] || labels.dark);
    els.themeToggle.innerHTML = theme === "light" ? THEME_SUN_ICON : THEME_MOON_ICON;
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ec_theme", next);
    updateThemeToggleLabel(next);
  }

  function formatBudget(value) {
    return new Intl.NumberFormat("ru-RU").format(Math.round(value));
  }

  function parseBudget(raw) {
    const digits = String(raw || "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }

  function activePlatforms() {
    return PLATFORM_ORDER.filter((id) => state.platforms[id]);
  }

  function hasPlatformOverrides() {
    return PLATFORM_ORDER.some((id) => state.platformOverrides[id]);
  }

  /** Бюджет для расчётов/unlock: не гасим UI при mid-edit ниже min слайдера. */
  function workingBudget() {
    const { min } = budgetSliderLimits();
    if (!(state.budget > 0) || state.budget < min) return min;
    return state.budget;
  }

  /** Подпись микса в дательном падеже после «по …». */
  function mixFramingLabel() {
    return hasPlatformOverrides()
      ? "миксу по включённым площадкам"
      : "рекомендованному миксу";
  }

  function buildConclusionText(parts, goal) {
    if (!parts?.length) return "";
    const sorted = [...parts].sort((a, b) => b.share - a.share);
    if (sorted.length === 1) {
      const name = platformShort(sorted[0].estimate.id, "nom");
      return goal === "traffic"
        ? `При текущем бюджете основной канал — ${name}. По мере роста бюджета подключатся следующие площадки по эффективности.`
        : `При текущем бюджете основной канал — ${name}. По мере роста бюджета подключатся следующие площадки для охвата.`;
    }
    const tops = sorted
      .slice(0, Math.min(3, sorted.length))
      .map((p) => platformShort(p.estimate.id, "acc"));
    const rest = sorted.length > 3;
    if (goal === "traffic") {
      return `Для трафика опирайтесь на ${tops.join(", ")}.${rest ? " Остальное — добор кликов." : ""}`;
    }
    return `Для охвата опирайтесь на ${tops.join(", ")}.${rest ? " Остальное — добор горячего сегмента." : ""}`;
  }

  function currentPeriod() {
    return PERIODS[state.period] || PERIODS.month;
  }

  /**
   * Частота за срок кампании: сублинейно от месячного бенча.
   * TAM (люди) не масштабируется — меняется только накопленная частота.
   * freq = 1 + (freqMonth − 1) × (days/30)^0.75
   */
  function scaleFreq(freq) {
    const t = Math.pow(currentPeriod().days / PERIOD_BASE_DAYS, 0.75);
    const scaleKey = (monthVal, fallback) => {
      const base = Number.isFinite(Number(monthVal)) ? Number(monthVal) : fallback;
      return Math.max(0.85, 1 + (base - 1) * t);
    };
    if (!freq) {
      return { min: scaleKey(2, 2), typical: scaleKey(3, 3), max: scaleKey(4, 4) };
    }
    return {
      min: scaleKey(freq.min, 2),
      typical: scaleKey(freq.typical, 3),
      max: scaleKey(freq.max, 4.5),
    };
  }

  /** Лимиты слайдера: фиксированные (бюджет = тотал на срок, рынок не сжимаем). */
  function budgetSliderLimits() {
    return { ...BUDGET_SLIDER_MONTH };
  }

  function applyBudgetSliderLimits({ clampBudget = false } = {}) {
    if (!els.budgetRange) return;
    const { min, max, step } = budgetSliderLimits();
    els.budgetRange.min = String(min);
    els.budgetRange.max = String(max);
    els.budgetRange.step = String(step);
    if (clampBudget && state.budget > 0 && state.budget < min) {
      // Поднимаем только ниже min; верх слайдера не режет поле ввода.
      state.budget = min;
      els.budget.value = formatBudget(min);
    }
    els.budgetRange.value = String(
      Math.min(max, Math.max(min, state.budget || min))
    );
    updateBudgetSliderHintPos();
  }

  const BUDGET_SLIDER_HINT_KEY = "ec_budget_slider_hint_seen";

  function updateBudgetSliderHintPos() {
    const range = els.budgetRange;
    const hint = els.budgetSliderHint;
    if (!range || !hint || hint.hidden) return;
    const min = Number(range.min);
    const max = Number(range.max);
    const val = Number(range.value);
    const span = max - min;
    const pct = span > 0 ? ((val - min) / span) * 100 : 0;
    hint.style.setProperty("--hint-left", `${pct}%`);
  }

  function showBudgetSliderHintIfNeeded() {
    const hint = els.budgetSliderHint;
    const range = els.budgetRange;
    if (!hint || !range) return;
    try {
      if (localStorage.getItem(BUDGET_SLIDER_HINT_KEY) === "1") return;
    } catch (_) {
      /* ignore */
    }
    if (Number(range.value) >= Number(range.max)) return;
    hint.hidden = false;
    updateBudgetSliderHintPos();
  }

  function dismissBudgetSliderHint() {
    const hint = els.budgetSliderHint;
    if (!hint || hint.hidden) return;
    hint.hidden = true;
    try {
      localStorage.setItem(BUDGET_SLIDER_HINT_KEY, "1");
    } catch (_) {
      /* ignore */
    }
  }

  /** Индустрия из data.json или null, если выбран «Любая». */
  function currentIndustry() {
    if (!state.industry || !state.data?.industries) return null;
    return state.data.industries[state.industry] || null;
  }

  /**
   * Ёмкость для пузырей и пересечения: гео × доля индустрии.
   * Без индустрии — полный TAM гео.
   */
  function resolveAudience() {
    const geo = state.data.geos[state.geo];
    const geoAudience = geo.audience_mln * 1_000_000;
    const industry = currentIndustry();
    const share = industry?.audience_share;
    if (Number.isFinite(share) && share > 0 && share < 1) {
      return {
        audience: geoAudience * share,
        audienceMln: geo.audience_mln * share,
        geoAudience,
        geoAudienceMln: geo.audience_mln,
        industry,
      };
    }
    return {
      audience: geoAudience,
      audienceMln: geo.audience_mln,
      geoAudience,
      geoAudienceMln: geo.audience_mln,
      industry: null,
    };
  }

  /** k корреляции: для ниши ниже → выше пересечение при тех же охватах. */
  function resolveCorrelationFactor() {
    const industry = currentIndustry();
    const k = industry?.correlation_factor;
    return Number.isFinite(k) && k > 0 && k <= 1 ? k : DEFAULT_CORRELATION;
  }

  /** Якорь медиамикса: отраслевой override, иначе глобальный mix_rules. */
  function mixRulesForGoal(goal) {
    const industryRules = currentIndustry()?.mix_rules?.[goal];
    if (industryRules && typeof industryRules === "object") return industryRules;
    return state.data?.mix_rules?.[goal] || {};
  }

  function normalizedMixRules(goal) {
    const base = mixRulesForGoal(goal);
    const selected = activePlatforms();
    const rawSum = selected.reduce((s, id) => s + (base[id] || 0), 0);
    const rules = {};
    if (!selected.length) return rules;
    if (rawSum <= 0) {
      const equal = 1 / selected.length;
      selected.forEach((id) => {
        rules[id] = equal;
      });
      return rules;
    }
    selected.forEach((id) => {
      rules[id] = (base[id] || 0) / rawSum;
    });
    return rules;
  }

  /** Коридоры долей вокруг якоря mix_rules (динамический сплит). */
  const MIX_SHARE_CORRIDORS = {
    traffic: {
      direct: [0.22, 0.55],
      avito: [0.08, 0.36],
      vk: [0.08, 0.28],
      telegram: [0.08, 0.28],
      media: [0.04, 0.2],
    },
    reach: {
      media: [0.16, 0.42],
      vk: [0.1, 0.34],
      telegram: [0.1, 0.36],
      direct: [0.06, 0.26],
      avito: [0.04, 0.22],
    },
  };

  const MIX_PLATFORM_NAMES = {
    direct: {
      nom: "Поиск",
      acc: "Поиск",
      gen: "Поиска",
      prep: "Поиске",
      into: "Поиск",
      inst: "Поиском",
    },
    media: {
      nom: "Медийка",
      acc: "Медийку Яндекса",
      gen: "Медийки",
      prep: "Медийке",
      into: "Медийку",
      inst: "Медийкой Яндекса",
    },
    vk: { nom: "VK", acc: "VK", gen: "VK", prep: "VK", into: "VK", inst: "VK" },
    telegram: {
      nom: "Telegram",
      acc: "Telegram",
      gen: "Telegram",
      prep: "Telegram",
      into: "Telegram",
      inst: "Telegram",
    },
    avito: {
      nom: "Avito",
      acc: "Avito",
      gen: "Avito",
      prep: "Avito",
      into: "Avito",
      inst: "Avito",
    },
  };

  /** Короткие названия площадок; form: nom | acc | gen | prep | into | inst */
  function platformShort(id, form = "nom") {
    const row = MIX_PLATFORM_NAMES[id];
    if (row?.[form]) return row[form];
    if (row?.nom) return row.nom;
    return state.data?.platforms?.[id]?.label || id;
  }

  /** Список имён для «ёмкостью …»: одно — nom, несколько — «VK и Медийкой». */
  function formatCheaperCapacityPhrase(ids) {
    if (!ids?.length) return "основных каналов";
    if (ids.length === 1) return platformShort(ids[0], "nom");
    return ids
      .map((pid, i) => platformShort(pid, i === 0 ? "nom" : "inst"))
      .join(" и ");
  }

  /**
   * Более дешёвые/ранние каналы водопада относительно force-on вне рекомендации.
   * Берём recommended (порядок подключения), предпочитаем включённые; до 2 штук.
   */
  function preferredCheaperPlatforms(forcedId, recommended) {
    const ahead = (recommended || []).filter((p) => p !== forcedId);
    const active = ahead.filter((p) => state.platforms[p]);
    const pool = active.length ? active : ahead;
    return pool.slice(0, 2);
  }

  function evaluateWaterfallSet(goal, geoId, budget, ids) {
    const activeIds = (ids || []).filter((id) => PLATFORM_ORDER.includes(id));
    const totalBudget = Math.max(0, Number(budget) || 0);
    if (!activeIds.length || !(totalBudget > 0)) {
      return { clicks: 0, cpc: Infinity };
    }
    const ranked = rankChannelsWaterfall(goal, geoId, totalBudget, activeIds);
    const allocated = allocateWaterfallBudget(goal, geoId, totalBudget, ranked);
    let clicks = 0;
    for (const id of activeIds) {
      const partBudget = allocated.allocations[id] || 0;
      if (!(partBudget > 0)) continue;
      const est = estimatePlatform(id, geoId, partBudget, goal);
      clicks += est?.clicks?.typical || 0;
    }
    const cpc = clicks > 0 ? totalBudget / clicks : Infinity;
    return { clicks, cpc };
  }

  function shouldRecommendReturnPlatform(platformId, goal, geoId, budget) {
    if (goal !== "traffic") return true;
    const activeWithout = activePlatforms().filter((id) => id !== platformId);
    if (!activeWithout.length) return true;

    const base = evaluateWaterfallSet(goal, geoId, budget, activeWithout);
    const next = evaluateWaterfallSet(goal, geoId, budget, [...activeWithout, platformId]);
    if (!(base.clicks > 0) || !(next.clicks > 0)) return true;

    const clicksDeltaPct = (next.clicks - base.clicks) / base.clicks;
    const cpcDeltaPct = Number.isFinite(base.cpc) && base.cpc > 0
      ? (next.cpc - base.cpc) / base.cpc
      : 0;

    if (clicksDeltaPct > 0.01 || cpcDeltaPct < -0.015) return true;
    return clicksDeltaPct >= 0 && cpcDeltaPct <= 0;
  }

  /** Почему стоит вернуть канал в набор (выгода под цель). */
  const PLATFORM_RETURN_WHY = {
    traffic: {
      direct: "там высокий intent и проще держать CPC под контролем",
      avito: "там горячий спрос и обычно ниже CPC",
      vk: "это добор кликов из другой аудитории",
      telegram: "это добор кликов и другой охват",
      media: "небольшой прогрев расширит воронку до поиска",
    },
    reach: {
      media: "там ниже CPM и шире уникальный охват",
      vk: "это охват в соцсети при хорошем CPM",
      telegram: "это дешёвый охват другой аудитории в мессенджере",
      direct: "горячий сегмент доберёт тех, кто уже ищет",
      avito: "маркетплейс доберёт уникальную аудиторию с намерением",
    },
  };

  function platformTipWhy(platformId, goal) {
    return PLATFORM_RETURN_WHY[goal]?.[platformId] || "канал усиливает микс под эту цель";
  }

  function goalTipLabel(goal) {
    return goal === "traffic" ? "трафик" : "охват";
  }

  function clamp01(x) {
    return Math.min(1, Math.max(0, x));
  }

  function mediaInventoryForGeo(geoId) {
    const platform = state.data.platforms.media;
    const forecast = platform?.forecast || {};
    const industryForecast = currentIndustry()?.media_forecast || {};
    const days = currentPeriod().days;
    const invPerDay = Number.isFinite(forecast.inventory_imps_per_day)
      ? forecast.inventory_imps_per_day
      : 28143750;
    const universes = forecast.universe_by_geo || {};
    const universeRu = universes.russia || 137120000;
    const baseUniverse = universes[geoId] || universeRu;
    const inventoryShare = Number.isFinite(industryForecast.inventory_share)
      ? industryForecast.inventory_share
      : (Number.isFinite(industryForecast.universe_share) ? industryForecast.universe_share : 1);
    return invPerDay * days * (baseUniverse / universeRu) * inventoryShare;
  }

  function fitRank(fit) {
    if (fit === "high") return 0;
    if (fit === "medium") return 1;
    return 2;
  }

  /** Порядок подключения каналов под цель: fit, затем вес mix_rules. */
  function platformPriority(goal) {
    const rules = mixRulesForGoal(goal);
    return [...PLATFORM_ORDER].sort((a, b) => {
      const fa = fitRank(state.data?.platforms?.[a]?.fit?.[goal]);
      const fb = fitRank(state.data?.platforms?.[b]?.fit?.[goal]);
      if (fa !== fb) return fa - fb;
      return (rules[b] || 0) - (rules[a] || 0);
    });
  }

  /**
   * Мягкий потолок бюджета канала (₽ за срок) — тот же якорь, что и pressure.
   */
  function channelSoftCapacity(platformId, goal, geoId) {
    if (!state.data) return 0;
    const days = currentPeriod().days;
    const { audience } = resolveAudience();
    const geoScale = audience > 0 ? audience / 98_000_000 : 1;
    const periodScale = days / PERIOD_BASE_DAYS;

    if (platformId === "avito") {
      const platform = state.data.platforms.avito;
      const geoBench = resolveGeoBench("avito", geoId);
      if (!platform?.forecast || !geoBench?.cpc) {
        return 400_000 * periodScale * Math.max(0.4, geoScale);
      }
      const forecast = resolveAvitoForecast(platform);
      const cpcTypical = rangeOf(geoBench.cpc, "typical") || forecast.cpc_floor || 12;
      const clicks = avitoClicksAtCpc(10_000_000, cpcTypical, geoId, forecast, days);
      return Math.max(clicks * cpcTypical, 200_000 * periodScale * Math.max(0.4, geoScale));
    }

    if (platformId === "media") {
      const inventory = mediaInventoryForGeo(geoId);
      const geoBench = resolveGeoBench("media", geoId);
      const cpm = rangeOf(geoBench?.cpm, "typical") || 220;
      // SOV ≈ 0.35 ≈ mid pressure в probeChannelPressure
      const imps = inventory * 0.35;
      return Math.max((imps / 1000) * cpm, 300_000 * periodScale * Math.max(0.4, geoScale));
    }

    if (platformId === "direct") {
      const geoBench = resolveGeoBench("direct", geoId);
      const cpc = rangeOf(geoBench?.cpc, "typical") || 55;
      const softClicks = Math.min(audience * 0.00028, 32_000) * periodScale;
      return Math.max(
        softClicks * cpc,
        1_200_000 * periodScale * Math.max(0.4, geoScale)
      );
    }

    const softBase = platformId === "telegram" ? 850_000 : 1_100_000;
    return softBase * periodScale * Math.max(0.4, geoScale);
  }

  /**
   * Цена канала для водопада (как на карточке): reach → CPM / eCPM, traffic → CPC.
   * eCPM для CPC-каналов без CPM: 1000 × cpc × ctr.
   */
  function waterfallChannelPrice(platformId, goal, geoId, probeBudget) {
    const est = estimatePlatform(platformId, geoId, probeBudget, goal);
    const bench = resolveGeoBench(platformId, geoId);
    if (!est) return Infinity;
    const { cpc, cpm } = resolveCostPair(est, probeBudget, bench);

    if (goal === "traffic") {
      return Number.isFinite(cpc?.typical) ? cpc.typical : Infinity;
    }

    if (Number.isFinite(cpm?.typical)) return cpm.typical;

    const cpcVal = cpc?.typical;
    const ctr = Number.isFinite(est.ctr?.typical)
      ? est.ctr.typical
      : bench?.ctr?.typical;
    if (Number.isFinite(cpcVal) && Number.isFinite(ctr) && ctr > 0) {
      return 1000 * cpcVal * ctr;
    }
    return Infinity;
  }

  function waterfallChannelQuality(platformId) {
    const q = state.data?.quality?.[platformId];
    const bounce = q?.bounce?.min;
    const bot = q?.bot?.min;
    if (Number.isFinite(bounce) && Number.isFinite(bot)) return bounce + bot;
    return 1e9;
  }

  function trafficPriorityAdjustedPrice(platformId, price) {
    if (!Number.isFinite(price)) return price;
    // Под цель traffic даём Поиску небольшой conversion-приоритет vs VK.
    if (platformId === "direct") return price * 0.88;
    if (platformId === "vk") return price * 1.08;
    return price;
  }

  /**
   * Ранг каналов для водопада: цена → качество → ёмкость; fit=low в хвост.
   */
  function rankChannelsWaterfall(goal, geoId, budget, candidateIds) {
    const ids =
      candidateIds && candidateIds.length
        ? candidateIds.filter((id) => PLATFORM_ORDER.includes(id))
        : [...PLATFORM_ORDER];
    const probeBudget = Math.max((Number(budget) || 0) * 0.1, 50_000);

    const rows = ids.map((id) => {
      const fit = state.data?.platforms?.[id]?.fit?.[goal];
      return {
        id,
        fitLow: fit === "low",
        price: waterfallChannelPrice(id, goal, geoId, probeBudget),
        quality: waterfallChannelQuality(id),
        capacity: channelSoftCapacity(id, goal, geoId),
      };
    });

    rows.sort((a, b) => {
      if (a.fitLow !== b.fitLow) return a.fitLow ? 1 : -1;
      const priceA = goal === "traffic"
        ? trafficPriorityAdjustedPrice(a.id, a.price)
        : a.price;
      const priceB = goal === "traffic"
        ? trafficPriorityAdjustedPrice(b.id, b.price)
        : b.price;
      if (priceA !== priceB) return priceA - priceB;
      if (a.quality !== b.quality) return a.quality - b.quality;
      return b.capacity - a.capacity;
    });

    return rows.map((r) => r.id);
  }

  /** Веса перелива остатка на traffic: Поиск/Avito/TG важнее VK; Медийка — только force-on. */
  function trafficLeftoverWeight(platformId) {
    if (platformId === "direct") return 3.2;
    if (platformId === "avito") return 2.6;
    if (platformId === "telegram") return 1.6;
    if (platformId === "vk") return 1;
    return 0.4;
  }

  /** Веса остатка на reach: Медийка основа, VK/TG добор, Поиск — тонкий горячий хвост. */
  function reachLeftoverWeight(platformId) {
    if (platformId === "media") return 3.0;
    if (platformId === "vk") return 1.8;
    if (platformId === "telegram") return 1.4;
    if (platformId === "direct") return 0.45;
    return 0.3;
  }

  function waterfallFillCandidates(goal, orderedIds) {
    if (goal !== "traffic" && goal !== "reach") return [...orderedIds];
    const preferred = orderedIds.filter((id) => {
      const fit = state.data?.platforms?.[id]?.fit?.[goal];
      if (fit !== "low") return true;
      // fit=low: Медийка на traffic / Avito на reach — только force-on
      return state.platformOverrides?.[id] === "on";
    });
    return preferred.length ? preferred : [...orderedIds];
  }

  /**
   * Водопадная аллокация: soft-cap по рангу, затем остаток весами.
   * Reach: Медийка — основа (soft-cap SOV + вес), VK/TG добор, Поиск — горячий хвост;
   *        fit=low не берём в авто. Soft-cap Медийки в phase 1 не больше ~65% бюджета,
   *        чтобы оставался пул на диверсификацию.
   * Traffic: fit=low не берём в авто; остаток — веса перформанса (Поиск/Avito/TG).
   */
  function allocateWaterfallBudget(goal, geoId, totalBudget, orderedIds) {
    const budget = Math.max(0, Number(totalBudget) || 0);
    const allocations = {};
    const shares = {};
    const notes = [];
    const order = [];

    if (!(budget > 0) || !orderedIds?.length) {
      return { shares, allocations, order, notes };
    }

    const fillIds = waterfallFillCandidates(goal, orderedIds);
    let remaining = budget;
    for (const id of fillIds) {
      if (!(remaining > 0)) break;
      let cap = channelSoftCapacity(id, goal, geoId);
      // Reach: не отдаём Медийке весь remaining в soft-fill, если soft-cap ≫ бюджета.
      if (goal === "reach" && id === "media") {
        cap = Math.min(cap, budget * 0.65);
      }
      // Reach: Поиск — только тонкий горячий хвост, не полный soft-cap.
      if (goal === "reach" && id === "direct") {
        cap = Math.min(cap, budget * 0.06);
      }
      const take = Math.min(remaining, Math.max(0, cap));
      if (!(take > 0)) continue;
      allocations[id] = take;
      order.push(id);
      remaining -= take;
    }

    if (remaining > 0 && fillIds.length) {
      const isTraffic = goal === "traffic";
      const sinks = (isTraffic ? order : fillIds).filter((id) => {
        const fit = state.data?.platforms?.[id]?.fit?.[goal];
        return fit !== "low" || state.platformOverrides?.[id] === "on";
      });
      const pool = sinks.length ? sinks : fillIds;
      const weightFn = isTraffic ? trafficLeftoverWeight : reachLeftoverWeight;
      const weights = {};
      let wSum = 0;
      for (const id of pool) {
        const w = weightFn(id);
        weights[id] = w;
        wSum += w;
      }
      if (wSum > 0) {
        for (const id of pool) {
          const add = remaining * (weights[id] / wSum);
          if (!(add > 0)) continue;
          allocations[id] = (allocations[id] || 0) + add;
          if (!order.includes(id)) order.push(id);
        }
        remaining = 0;
        notes.push({
          text: isTraffic
            ? "остаток бюджета на traffic ушёл в перформанс-каналы, не в Медийку"
            : "остаток бюджета на reach распределён: Медийка / VK / TG / Поиск",
        });
      }
    }

    if (!order.length && orderedIds.length) {
      const pourId =
        fillIds.find(
          (id) => state.data?.platforms?.[id]?.fit?.[goal] !== "low"
        ) || fillIds[0] || orderedIds[0];
      allocations[pourId] = budget;
      order.push(pourId);
    }

    for (const id of orderedIds) {
      shares[id] = (allocations[id] || 0) / budget;
    }
    const shareSum = orderedIds.reduce((s, id) => s + (shares[id] || 0), 0);
    if (shareSum > 0 && Math.abs(shareSum - 1) > 1e-9) {
      orderedIds.forEach((id) => {
        shares[id] = (shares[id] || 0) / shareSum;
      });
    }

    return { shares, allocations, order, notes };
  }

  /** 0…1: насколько канал «упирается» в ёмкость при данном бюджете доли. */
  function probeChannelPressure(platformId, goal, geoId, partBudget) {
    if (!(partBudget > 0)) return { pressure: 0, reason: null };

    const days = currentPeriod().days;
    const { audience } = resolveAudience();
    const geoScale = audience > 0 ? audience / 98_000_000 : 1;

    if (platformId === "avito") {
      const platform = state.data.platforms.avito;
      const geoBench = resolveGeoBench("avito", geoId);
      if (!platform?.forecast || !geoBench?.cpc) return { pressure: 0, reason: null };
      const forecast = resolveAvitoForecast(platform);
      const cpcTypical = rangeOf(geoBench.cpc, "typical") || forecast.cpc_floor || 12;
      const atTypical = avitoClicksAtCpc(partBudget, cpcTypical, geoId, forecast, days);
      const spendAtTypical = atTypical * cpcTypical;
      const gap = 1 - spendAtTypical / partBudget;
      const pressure = clamp01((gap - 0.04) / 0.42);
      return {
        pressure,
        reason: pressure > 0.18 ? "дешёвый объём Avito исчерпан — нужен выше CPC" : null,
      };
    }

    if (platformId === "media") {
      const est = estimatePlatform("media", geoId, partBudget, goal);
      const inventory = mediaInventoryForGeo(geoId);
      if (!est || !(inventory > 0)) return { pressure: 0, reason: null };
      const sov = Math.min(1.5, (est.impressions?.typical || 0) / inventory);
      const pressure = clamp01((sov - 0.1) / 0.45);
      return {
        pressure,
        reason: pressure > 0.18 ? "высокая доля инвентаря Медийки (SOV)" : null,
      };
    }

    if (platformId === "direct") {
      const softBudget = channelSoftCapacity("direct", goal, geoId);
      const ratio = partBudget / Math.max(1, softBudget);
      const pressure = clamp01((ratio - 0.75) / 1.1);
      return {
        pressure,
        reason: pressure > 0.18 ? "на объёме Поиск дороже дешёвых кликов" : null,
      };
    }

    // VK / Telegram
    const softBudget = channelSoftCapacity(platformId, goal, geoId);
    const ratio = partBudget / Math.max(1, softBudget);
    const pressure = clamp01((ratio - 0.75) / 1.2);
    return {
      pressure,
      reason: pressure > 0.22
        ? `ёмкость ${platformShort(platformId, "gen")} на объёме ограничена`
        : null,
    };
  }

  function mixSharesForIds(goal, ids) {
    const base = mixRulesForGoal(goal);
    const rules = {};
    if (!ids.length) return rules;
    const rawSum = ids.reduce((s, id) => s + (base[id] || 0), 0);
    if (rawSum <= 0) {
      const equal = 1 / ids.length;
      ids.forEach((id) => {
        rules[id] = equal;
      });
      return rules;
    }
    ids.forEach((id) => {
      rules[id] = (base[id] || 0) / rawSum;
    });
    return rules;
  }

  /**
   * Потолок для лестницы unlock (₽) внутри слайдера 50k–5M.
   * Масштаб только по полному geo и сроку — индустрия на unlock не влияет.
   */
  function channelUnlockCapacity(platformId, goal, geoId) {
    const days = currentPeriod().days;
    const geoMln = state.data?.geos?.[geoId]?.audience_mln || 98;
    const geoScale = geoMln > 0 ? (geoMln * 1_000_000) / 98_000_000 : 1;
    const periodScale = days / PERIOD_BASE_DAYS;
    const ceilMonth = {
      direct: 1_200_000,
      media: 1_400_000,
      vk: 1_100_000,
      telegram: 850_000,
      avito: 650_000,
    }[platformId] || 1_000_000;
    return ceilMonth * periodScale * Math.max(0.4, geoScale);
  }

  function needsNextPlatform(unlocked, budget, goal, geoId) {
    if (!unlocked.length) return true;
    const sumCap = unlocked.reduce((s, id) => s + channelUnlockCapacity(id, goal, geoId), 0);
    const shares = mixSharesForIds(goal, unlocked);
    let maxPressure = 0;
    for (const id of unlocked) {
      const probe = probeChannelPressure(id, goal, geoId, budget * (shares[id] || 0));
      maxPressure = Math.max(maxPressure, probe.pressure);
    }
    // Также давление, если весь бюджет ушёл бы в «голову» набора
    const head = unlocked[0];
    const headPressure = probeChannelPressure(head, goal, geoId, budget).pressure;
    return (
      budget > sumCap * PLATFORM_UNLOCK_CAP_RATIO ||
      maxPressure >= PLATFORM_UNLOCK_PRESSURE ||
      headPressure >= PLATFORM_UNLOCK_PRESSURE
    );
  }

  /**
   * Автонабор площадок: каналы с ненулевой аллокацией водопада (порядок подключения).
   */
  function resolveRecommendedPlatforms(budget, goal, geoId) {
    const unlockBudget = Number(budget) || 0;
    if (!(unlockBudget > 0) || !state.data) return [];
    const ranked = rankChannelsWaterfall(goal, geoId, unlockBudget, PLATFORM_ORDER);
    if (!ranked.length) return [];
    const { order } = allocateWaterfallBudget(goal, geoId, unlockBudget, ranked);
    if (order.length) return order;
    return [ranked[0]];
  }

  function applyPlatformSelectionFromRecommendation() {
    const recommended = resolveRecommendedPlatforms(
      workingBudget(),
      state.goal,
      state.geo
    );
    const prev = state.recommendedPlatforms || [];
    // Tip «было 100%» при открытии 2-го канала
    if (prev.length === 1 && recommended.length >= 2) {
      state.unlockShareFromId = prev[0];
    } else if (recommended.length < 2) {
      state.unlockShareFromId = null;
    }
    state.recommendedPlatforms = recommended;
    const recSet = new Set(recommended);
    for (const id of PLATFORM_ORDER) {
      const ov = state.platformOverrides[id];
      if (ov === "on") state.platforms[id] = true;
      else if (ov === "off") state.platforms[id] = false;
      else state.platforms[id] = recSet.has(id);
    }
  }

  function syncPlatformChips() {
    document.querySelectorAll('input[name="platform"]').forEach((input) => {
      const id = input.value;
      input.checked = !!state.platforms[id];
      const label = input.closest(".plat-chip");
      if (!label) return;
      const forceOnExtra =
        state.platformOverrides[id] === "on" &&
        !state.recommendedPlatforms.includes(id);
      const forceOff =
        state.platformOverrides[id] === "off" &&
        state.recommendedPlatforms.includes(id);
      label.classList.toggle("is-override-on", forceOnExtra);
      label.classList.toggle("is-override-off", forceOff);
    });
  }

  const PLATFORM_TIP_VISIBLE_MS = 5500;
  const PLATFORM_TIP_FADE_MS = 700;
  let platformTipHideTimer = null;
  let platformTipFadeTimer = null;
  let platformTipActiveKey = null;

  function clearPlatformTipTimers() {
    if (platformTipHideTimer) {
      clearTimeout(platformTipHideTimer);
      platformTipHideTimer = null;
    }
    if (platformTipFadeTimer) {
      clearTimeout(platformTipFadeTimer);
      platformTipFadeTimer = null;
    }
  }

  function fadeOutPlatformTip(tip, id, kind) {
    if (!tip || !tip.isConnected) {
      clearPlatformTipTimers();
      platformTipActiveKey = null;
      state.dismissedPlatformTips[`${id}:${kind}`] = true;
      renderPlatformRecTips();
      return;
    }
    if (tip.classList.contains("is-fading")) return;

    clearPlatformTipTimers();
    tip.classList.add("is-fading");
    tip.classList.remove("is-visible");
    state.dismissedPlatformTips[`${id}:${kind}`] = true;

    platformTipFadeTimer = setTimeout(() => {
      tip.remove();
      platformTipActiveKey = null;
      platformTipFadeTimer = null;
      renderPlatformRecTips();
    }, PLATFORM_TIP_FADE_MS);
  }

  function renderPlatformRecTips() {
    const recommended = state.recommendedPlatforms || [];
    const tips = [];
    const goalLabel = goalTipLabel(state.goal);

    for (const id of PLATFORM_ORDER) {
      if (state.platformOverrides[id] !== "on") continue;
      if (recommended.includes(id)) continue;
      if (!state.platforms[id]) continue;
      if (state.dismissedPlatformTips[`${id}:on`]) continue;
      const short = platformShort(id, "acc");
      let cheaperIds = preferredCheaperPlatforms(id, recommended);
      if (!cheaperIds.length) {
        const fallback = PLATFORM_ORDER.find((p) => state.platforms[p] && p !== id);
        if (fallback) cheaperIds = [fallback];
      }
      const capacityPhrase = formatCheaperCapacityPhrase(cheaperIds);
      tips.push({
        id,
        kind: "on",
        text: `Рекомендуем пока отключить ${short}: сперва закрыть ${goalLabel} более дешёвой ёмкостью ${capacityPhrase}`,
      });
    }

    for (const id of PLATFORM_ORDER) {
      if (state.platformOverrides[id] !== "off") continue;
      if (!recommended.includes(id)) continue;
      if (state.dismissedPlatformTips[`${id}:off`]) continue;
      if (!shouldRecommendReturnPlatform(id, state.goal, state.geo, workingBudget())) continue;
      const short = platformShort(id, "acc");
      tips.push({
        id,
        kind: "off",
        text: `Рекомендуем вернуть ${short}: ${platformTipWhy(id, state.goal)}`,
      });
    }

    const next = tips[0] || null;
    const nextKey = next ? `${next.id}:${next.kind}` : null;
    const existing = document.querySelector(".plat-chip-tip");

    if (!next) {
      clearPlatformTipTimers();
      platformTipActiveKey = null;
      document.querySelectorAll(".plat-chip-tip").forEach((node) => node.remove());
      return;
    }

    // Уже показываем нужную подсказку — не сбрасываем таймер при каждом render.
    if (
      platformTipActiveKey === nextKey &&
      existing &&
      !existing.classList.contains("is-fading")
    ) {
      const body = existing.querySelector(".plat-chip-tip-text");
      if (body && body.textContent !== next.text) body.textContent = next.text;
      return;
    }

    clearPlatformTipTimers();
    document.querySelectorAll(".plat-chip-tip").forEach((node) => node.remove());

    const chip = document.querySelector(`.plat-chip[data-platform="${next.id}"]`);
    if (!chip) {
      platformTipActiveKey = null;
      return;
    }

    platformTipActiveKey = nextKey;
    const tip = document.createElement("div");
    tip.className = "plat-chip-tip";
    tip.setAttribute("role", "status");
    tip.dataset.tipKey = nextKey;

    const body = document.createElement("p");
    body.className = "plat-chip-tip-text";
    body.textContent = next.text;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "plat-chip-tip-close";
    close.setAttribute("aria-label", "Скрыть подсказку");
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      fadeOutPlatformTip(tip, next.id, next.kind);
    });

    tip.appendChild(close);
    tip.appendChild(body);
    chip.appendChild(tip);

    requestAnimationFrame(() => {
      tip.classList.add("is-visible");
    });

    platformTipHideTimer = setTimeout(() => {
      fadeOutPlatformTip(tip, next.id, next.kind);
    }, PLATFORM_TIP_VISIBLE_MS);
  }

  /** Проекция долей на коридоры ∩ simplex (сумма = 1). */
  function enforceShareCorridors(sharesIn, ids, goal) {
    const corridors = MIX_SHARE_CORRIDORS[goal] || {};
    const bounds = ids.map((id) => {
      const [lo, hi] = corridors[id] || [0.03, 0.7];
      return { id, lo, hi };
    });
    let loSum = bounds.reduce((s, b) => s + b.lo, 0);
    if (loSum > 1) {
      bounds.forEach((b) => {
        b.lo /= loSum;
      });
      loSum = 1;
    }
    let hiSum = bounds.reduce((s, b) => s + b.hi, 0);
    if (hiSum < 1 && hiSum > 0) {
      bounds.forEach((b) => {
        b.hi = Math.min(1, b.hi / hiSum);
      });
    }

    const out = {};
    ids.forEach((id) => {
      out[id] = Math.max(0, sharesIn[id] || 0);
    });

    for (let iter = 0; iter < 16; iter++) {
      for (const b of bounds) {
        out[b.id] = Math.min(b.hi, Math.max(b.lo, out[b.id]));
      }
      const sum = ids.reduce((s, id) => s + out[id], 0);
      if (Math.abs(sum - 1) < 1e-8) break;
      if (sum > 1) {
        const free = bounds.filter((b) => out[b.id] > b.lo + 1e-12);
        const freeSum = free.reduce((s, b) => s + (out[b.id] - b.lo), 0);
        const excess = sum - 1;
        if (freeSum <= 0) break;
        free.forEach((b) => {
          out[b.id] -= excess * ((out[b.id] - b.lo) / freeSum);
        });
      } else {
        const free = bounds.filter((b) => out[b.id] < b.hi - 1e-12);
        const freeSum = free.reduce((s, b) => s + (b.hi - out[b.id]), 0);
        const deficit = 1 - sum;
        if (freeSum <= 0) break;
        free.forEach((b) => {
          out[b.id] += deficit * ((b.hi - out[b.id]) / freeSum);
        });
      }
    }

    const finalSum = ids.reduce((s, id) => s + out[id], 0) || 1;
    ids.forEach((id) => {
      out[id] /= finalSum;
    });
    return out;
  }

  /**
   * Водопадный сплит по активным площадкам (чипы ON).
   * Legacy adjustMixShares / corridors / mix_rules больше не драйвят автосплит.
   */
  function resolveRecommendedShares(goal, geoId, budget) {
    const totalBudget = Math.max(0, Number(budget) || 0);
    const selected = activePlatforms();
    const empty = {
      shares: {},
      baseShares: {},
      tips: {},
      notes: [],
      adjusted: false,
      order: [],
      allocations: {},
    };
    if (!selected.length || !(totalBudget > 0) || !state.data) return empty;

    const ranked = rankChannelsWaterfall(goal, geoId, totalBudget, selected);
    const result = allocateWaterfallBudget(goal, geoId, totalBudget, ranked);

    const shares = {};
    selected.forEach((id) => {
      shares[id] = result.shares[id] || 0;
    });
    const shareSum = selected.reduce((s, id) => s + shares[id], 0);
    if (shareSum > 0) {
      selected.forEach((id) => {
        shares[id] /= shareSum;
      });
    } else {
      const equal = 1 / selected.length;
      selected.forEach((id) => {
        shares[id] = equal;
      });
    }

    const tips = {};
    const notes = [];
    const priceLabel = goal === "traffic" ? "CPC" : "CPM";
    const fromId = state.unlockShareFromId;
    if (fromId && selected.includes(fromId) && result.order.length >= 2) {
      tips[fromId] =
        `Было 100% на ${platformShort(fromId, "prep")}. Подключён следующий канал по ёмкости`;
      notes.push({ id: fromId, delta: (shares[fromId] || 0) - 1, text: tips[fromId] });
      state.unlockShareFromId = null;
    }

    result.order.forEach((id, idx) => {
      if (!(shares[id] > 0)) return;
      if (tips[id]) return;
      let tip;
      if (idx === 0) {
        tip = `1-й в очереди: низкий ${priceLabel} и запас ёмкости`;
      } else {
        const prev = result.order[idx - 1];
        tip = `Подключён после исчерпания ёмкости ${platformShort(prev, "gen")}`;
      }
      tips[id] = tip;
      notes.push({ id, delta: shares[id], text: tip });
    });

    return {
      shares,
      baseShares: { ...shares },
      tips,
      notes: notes.slice(0, 3),
      adjusted: Object.keys(tips).length > 0,
      order: result.order,
      allocations: result.allocations,
    };
  }

  function formatNumber(value, digits = 0) {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value);
  }

  function formatMoney(value) {
    return `${formatNumber(Math.round(value))} ₽`;
  }

  function formatPercent(share) {
    return `${formatNumber(share * 100, 1)}%`;
  }

  function formatCompact(value) {
    if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)} млн`;
    if (value >= 1_000) return `${formatNumber(value / 1_000, 1)} тыс.`;
    return formatNumber(value);
  }

  /** Предложный падеж после «в …»: в России / в регионах … */
  function geoLabelIn(geoId) {
    const forms = {
      russia: "России",
      capitals: "Мск+МО и СПб+ЛО",
      regions: "регионах без МО и ЛО",
    };
    return forms[geoId] || state.data.geos?.[geoId]?.label || geoId;
  }

  /** Родительный падеж после «аудитории …»: аудитории России / регионов … */
  function geoLabelOf(geoId) {
    const forms = {
      russia: "России",
      capitals: "Мск+МО и СПб+ЛО",
      regions: "регионов без МО и ЛО",
    };
    return forms[geoId] || state.data.geos?.[geoId]?.label || geoId;
  }

  function rangeOf(metric, key) {
    if (!metric || metric[key] == null) return null;
    return metric[key];
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * CTR Поиска зависит от «глубины» объёма: малый бюджет → ближе к PremiumCTR,
   * большой → ближе к базовому CTR гарантии (min / base_typical).
   */
  function searchVolumePressure(partBudget) {
    const days = currentPeriod().days;
    const { audience } = resolveAudience();
    const geoScale = audience > 0 ? audience / 98_000_000 : 1;
    const soft =
      1_200_000 * (days / PERIOD_BASE_DAYS) * Math.max(0.4, geoScale);
    const ratio = (Number(partBudget) || 0) / soft;
    return clamp01((ratio - 0.35) / 1.45);
  }

  function resolveSearchCtrRange(ctrBench, partBudget) {
    if (!ctrBench) return null;
    const min = rangeOf(ctrBench, "min");
    const typical = rangeOf(ctrBench, "typical");
    const max = rangeOf(ctrBench, "max");
    if (!Number.isFinite(typical)) return ctrBench;

    const premium =
      rangeOf(ctrBench, "premium_typical") ??
      (Number.isFinite(max) ? lerp(typical, max, 0.35) : typical);
    const base =
      rangeOf(ctrBench, "base_typical") ??
      (Number.isFinite(min) ? lerp(min, typical, 0.35) : typical * 0.65);

    const t = searchVolumePressure(partBudget);
    const ctrTypical = lerp(premium, base, t);
    const lo = Number.isFinite(min) ? min : base * 0.85;
    const hi = Number.isFinite(max) ? max : premium * 1.05;
    const ctrMin = lerp(lerp(lo, base, 0.4), lo * 0.9, t);
    const ctrMax = lerp(hi, lerp(premium, base, 0.55), t);
    const ordered = [ctrMin, ctrTypical, ctrMax].sort((a, b) => a - b);

    return {
      ...ctrBench,
      min: ordered[0],
      typical: ordered[1],
      max: ordered[2],
      volume_pressure: t,
      effective_source: "search CTR · premium→base by budget volume",
    };
  }

  const PLATFORM_SOURCE_LABELS = {
    direct: "прогноз Яндекс Поиск",
    media: "бенчмарк Прайм-баннер",
    vk: "бенчмарк VK",
    telegram: "бенчмарк Telegram Ads",
    avito: "бенчмарк Авито Реклама",
  };

  function sourceForPlatform(platformId) {
    if (!state.data.platforms[platformId]) return null;
    return PLATFORM_SOURCE_LABELS[platformId] || "рыночный бенчмарк";
  }

  function updateFooterSources() {
    if (!els.footerSources) return;
    const selected = activePlatforms();
    const ids = selected.length ? selected : PLATFORM_ORDER;
    const sourceLine = ids.map((id) => sourceForPlatform(id)).filter(Boolean).join("; ");
    els.footerSources.textContent = sourceLine
      ? `Источники расчёта: ${sourceLine}.`
      : "";
  }

  /** Бенч гео: при выбранной индустрии — индустриальный срез, иначе рынок. */
  function resolveGeoBench(platformId, geoId) {
    const platform = state.data.platforms[platformId];
    if (!platform) return null;
    const market = platform.by_geo?.[geoId];
    const industry = currentIndustry();
    const override = industry?.platforms?.[platformId]?.by_geo?.[geoId];
    if (!override) return market || null;
    return {
      ...market,
      ...override,
      cpc: override.cpc || market?.cpc,
      cpm: override.cpm || market?.cpm,
      ctr: override.ctr || market?.ctr,
      freq: override.freq || market?.freq,
    };
  }

  function mediaReachCurveK(sovI, forecast) {
    if (Number.isFinite(forecast.reach_curve_k)) return forecast.reach_curve_k;
    const k0 = Number.isFinite(forecast.reach_curve_k0) ? forecast.reach_curve_k0 : 2.0;
    const kInf = Number.isFinite(forecast.reach_curve_k_inf)
      ? forecast.reach_curve_k_inf
      : 1.25;
    const tau = Number.isFinite(forecast.reach_curve_tau) ? forecast.reach_curve_tau : 0.02;
    if (!(tau > 0)) return kInf;
    return kInf + (k0 - kInf) * Math.exp(-sovI / tau);
  }

  function mediaForecastReach(imps, universe, inventory, forecast) {
    if (!(universe > 0) || !(inventory > 0) || !(imps > 0)) return 0;
    const capped = Math.min(imps, inventory);
    const sovI = Math.min(1, capped / inventory);
    const k = mediaReachCurveK(sovI, forecast || {});
    const sovR = 1 - Math.pow(1 - sovI, k);
    return universe * sovR;
  }

  /**
   * Ёмкость кликов/мес при заданном CPC — сегментированная кривая из якорей.
   * Сегменты: [cpc_from..cpc_to] → clicks_monthly_russia (линейная интерполяция внутри).
   * Гео-масштаб различается для низкого (≤ первой границы) и высокого CPC.
   */
  function avitoMonthlyCapacity(cpc, geoId, forecast) {
    const segments = forecast?.segments;
    if (!segments || !segments.length) {
      // Fallback: двухточечная модель
      const cap = cpc <= 15 ? 37008 : 242188;
      return cap;
    }

    const c = Number(cpc) || segments[0].cpc_from;
    const first = segments[0];
    const last = segments[segments.length - 1];

    // Ниже первого сегмента
    if (c <= first.cpc_from) {
      const geoScales = forecast?.geo_scale_low_cpc || {};
      const scale = Number.isFinite(geoScales[geoId]) ? geoScales[geoId] : 1;
      return Math.round(first.clicks_monthly_russia * scale);
    }
    // Выше последнего сегмента
    if (c >= last.cpc_to) {
      const geoScales = forecast?.geo_scale_high_cpc || {};
      const scale = Number.isFinite(geoScales[geoId]) ? geoScales[geoId] : 1;
      return Math.round(last.clicks_monthly_russia * scale);
    }

    // Внутри сегментов — находим нужный и интерполируем
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      if (c >= seg.cpc_from && c <= seg.cpc_to) {
        const prev = i > 0 ? segments[i - 1] : seg;
        const capFrom = prev.clicks_monthly_russia;
        const capTo = seg.clicks_monthly_russia;
        const t = seg.cpc_to === seg.cpc_from
          ? 1
          : (c - seg.cpc_from) / (seg.cpc_to - seg.cpc_from);
        // Гео-масштаб: низкий для первой трети диапазона, высокий для последней
        const isLow = i === 0;
        const geoScales = isLow
          ? (forecast?.geo_scale_low_cpc || {})
          : (forecast?.geo_scale_high_cpc || {});
        const scaleFrom = isLow
          ? (Number.isFinite((forecast?.geo_scale_low_cpc || {})[geoId])
              ? forecast.geo_scale_low_cpc[geoId] : 1)
          : (Number.isFinite((forecast?.geo_scale_low_cpc || {})[geoId])
              ? forecast.geo_scale_low_cpc[geoId] : 1);
        const scaleTo = Number.isFinite((forecast?.geo_scale_high_cpc || {})[geoId])
          ? forecast.geo_scale_high_cpc[geoId] : 1;
        const scale = scaleFrom + (scaleTo - scaleFrom) * t;
        return Math.round((capFrom + (capTo - capFrom) * t) * scale);
      }
    }

    // Если попали между сегментами — используем предыдущий
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      if (c >= segments[i].cpc_from) {
        const geoScales = forecast?.geo_scale_high_cpc || {};
        const scale = Number.isFinite(geoScales[geoId]) ? geoScales[geoId] : 1;
        return Math.round(segments[i].clicks_monthly_russia * scale);
      }
    }

    return first.clicks_monthly_russia;
  }

  function avitoPeriodBaseDays(forecast) {
    return Number.isFinite(forecast?.period_days) ? forecast.period_days : 31;
  }

  function avitoClicksAtCpc(budget, cpc, geoId, forecast, days) {
    if (!(budget > 0) || !(cpc > 0)) return 0;
    const baseDays = avitoPeriodBaseDays(forecast);
    const periodCap = Math.round(
      (avitoMonthlyCapacity(cpc, geoId, forecast) * days) / baseDays
    );
    return Math.min(budget / cpc, periodCap);
  }

  /** Максимум кликов при заданном CPC-диапазоне (учитывает подъём CPC при упоре в ёмкость). */
  function avitoMaxClicks(budget, geoId, forecast, cpcMin, cpcMax, days) {
    if (!(budget > 0)) return 0;
    const lo = Math.max(0.01, Math.min(cpcMin, cpcMax));
    const hi = Math.max(lo, cpcMax);
    const steps = 80;
    const step = (hi - lo) / steps;
    let best = 0;
    for (let i = 0; i <= steps; i += 1) {
      const cpc = lo + step * i;
      best = Math.max(best, avitoClicksAtCpc(budget, cpc, geoId, forecast, days));
    }
    return best;
  }

  /** Типичный сценарий: пробуем CPC от типичного вверх, находим min CPC при котором осваивается бюджет. */
  function avitoTypicalClicks(budget, geoId, forecast, cpcTypical, cpcMax, days) {
    const baseDays = avitoPeriodBaseDays(forecast);
    const atTypical = avitoClicksAtCpc(budget, cpcTypical, geoId, forecast, days);
    if (atTypical * cpcTypical >= budget * 0.995) return atTypical;

    // Бинарный поиск минимального CPC при котором осваивается бюджет
    let lo = cpcTypical;
    let hi = cpcMax;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      const c = avitoClicksAtCpc(budget, mid, geoId, forecast, days);
      if (c * mid >= budget * 0.995) hi = mid;
      else lo = mid;
    }
    const atRaised = avitoClicksAtCpc(budget, hi, geoId, forecast, days);
    return Math.max(atTypical, atRaised);
  }

  function resolveAvitoForecast(platform) {
    const industryForecast = currentIndustry()?.avito_forecast;
    if (industryForecast?.segments?.length) return industryForecast;
    return platform.forecast || {};
  }

  function estimateAvito(platform, geoId, geoBench, budget, goal) {
    const forecast = resolveAvitoForecast(platform);
    const days = currentPeriod().days;
    const cpc = geoBench.cpc;
    const ctr = geoBench.ctr;
    const freq = scaleFreq(geoBench.freq);
    const { audience } = resolveAudience();

    const result = {
      id: "avito",
      label: platform.label,
      model: platform.model,
      fit: platform.fit[goal],
      budget,
      unitCostLabel: "CPC",
      unitCost: {
        min: rangeOf(cpc, "min"),
        typical: rangeOf(cpc, "typical"),
        max: rangeOf(cpc, "max"),
      },
    };

    const cpcTypical = rangeOf(cpc, "typical") || forecast.cpc_floor || 12;
    const cpcMin = rangeOf(cpc, "min") || cpcTypical;
    const cpcMax = rangeOf(cpc, "max") || forecast.cpc_max || 50;

    result.clicks = {
      min: avitoClicksAtCpc(budget, cpcMax, geoId, forecast, days),
      typical: avitoTypicalClicks(budget, geoId, forecast, cpcTypical, cpcMax, days),
      max: avitoMaxClicks(budget, geoId, forecast, cpcMin, cpcMax, days),
    };

    result.impressions = {
      min: result.clicks.min / (rangeOf(ctr, "max") || 0.03),
      typical: result.clicks.typical / (rangeOf(ctr, "typical") || 0.018),
      max: result.clicks.max / (rangeOf(ctr, "min") || 0.01),
    };

    result.reach = {
      min: Math.min(audience, result.impressions.min / freq.max),
      typical: Math.min(audience, result.impressions.typical / freq.typical),
      max: Math.min(audience, result.impressions.max / freq.min),
    };

    return result;
  }

  function estimateMedia(platform, geoId, geoBench, budget, goal) {
    const forecast = platform.forecast || {};
    const industryForecast = currentIndustry()?.media_forecast || {};
    const vat = Number.isFinite(forecast.vat_factor) ? forecast.vat_factor : 0.8;
    const days = currentPeriod().days;
    const invPerDay = Number.isFinite(forecast.inventory_imps_per_day)
      ? forecast.inventory_imps_per_day
      : 28143750;
    const universes = forecast.universe_by_geo || {};
    const universeRu = universes.russia || 137120000;
    const baseUniverse = universes[geoId] || universeRu;
    const universeShare = Number.isFinite(industryForecast.universe_share)
      ? industryForecast.universe_share
      : 1;
    const inventoryShare = Number.isFinite(industryForecast.inventory_share)
      ? industryForecast.inventory_share
      : universeShare;
    const fillFactor = Number.isFinite(industryForecast.fill_factor)
      ? industryForecast.fill_factor
      : 1;
    const curveForecast = {
      ...forecast,
      ...industryForecast,
    };
    const universe = baseUniverse * universeShare;
    // Инвентарь за срок кампании (не фиксированный месяц)
    const inventory = invPerDay * days * (baseUniverse / universeRu) * inventoryShare;

    const cpm = geoBench.cpm;
    const ctr = geoBench.ctr;
    const netBudget = budget * vat;

    const result = {
      id: "media",
      label: platform.label,
      model: platform.model,
      fit: platform.fit[goal],
      budget,
      unitCostLabel: "CPM",
      unitCost: {
        min: rangeOf(cpm, "min"),
        typical: rangeOf(cpm, "typical"),
        max: rangeOf(cpm, "max"),
      },
    };

    // Больше CPM → меньше показов/охвата (как в обычной CPM-ветке)
    result.impressions = {
      min: Math.min((netBudget / cpm.max) * 1000 * fillFactor, inventory),
      typical: Math.min((netBudget / cpm.typical) * 1000 * fillFactor, inventory),
      max: Math.min((netBudget / cpm.min) * 1000 * fillFactor, inventory),
    };

    const { audience } = resolveAudience();
    const reachUniverse = Math.min(universe, audience);
    result.reach = {
      min: Math.min(
        audience,
        mediaForecastReach(result.impressions.min, reachUniverse, inventory, curveForecast)
      ),
      typical: Math.min(
        audience,
        mediaForecastReach(result.impressions.typical, reachUniverse, inventory, curveForecast)
      ),
      max: Math.min(
        audience,
        mediaForecastReach(result.impressions.max, reachUniverse, inventory, curveForecast)
      ),
    };

    result.clicks = {
      min: result.impressions.min * ctr.min,
      typical: result.impressions.typical * ctr.typical,
      max: result.impressions.max * ctr.max,
    };

    return result;
  }

  function estimatePlatform(platformId, geoId, budget, goal) {
    const platform = state.data.platforms[platformId];
    const geoBench = resolveGeoBench(platformId, geoId);
    if (!platform || !geoBench) return null;

    if (platformId === "media" && platform.forecast) {
      return estimateMedia(platform, geoId, geoBench, budget, goal);
    }

    if (platformId === "avito" && platform.forecast) {
      return estimateAvito(platform, geoId, geoBench, budget, goal);
    }

    const result = {
      id: platformId,
      label: platform.label,
      model: platform.model,
      fit: platform.fit[goal],
      budget,
    };

    const freq = scaleFreq(geoBench.freq);
    const { audience } = resolveAudience();

    if (platform.model === "cpc" || (platform.model === "mixed" && goal === "traffic")) {
      const cpc = geoBench.cpc;
      const ctr =
        platformId === "direct"
          ? resolveSearchCtrRange(geoBench.ctr, budget) || geoBench.ctr
          : geoBench.ctr;

      result.unitCostLabel = "CPC";
      result.unitCost = {
        min: rangeOf(cpc, "min"),
        typical: rangeOf(cpc, "typical"),
        max: rangeOf(cpc, "max"),
      };
      result.ctr = {
        min: rangeOf(ctr, "min"),
        typical: rangeOf(ctr, "typical"),
        max: rangeOf(ctr, "max"),
      };

      result.clicks = {
        min: budget / cpc.max,
        typical: budget / cpc.typical,
        max: budget / cpc.min,
      };

      result.impressions = {
        min: result.clicks.min / ctr.max,
        typical: result.clicks.typical / ctr.typical,
        max: result.clicks.max / ctr.min,
      };

      // Охват: показы / частота периода; потолок — TAM (люди не сжимаются со сроком)
      result.reach = {
        min: Math.min(audience, result.impressions.min / freq.max),
        typical: Math.min(audience, result.impressions.typical / freq.typical),
        max: Math.min(audience, result.impressions.max / freq.min),
      };
    } else {
      const cpm = geoBench.cpm;
      const ctr = geoBench.ctr;

      result.unitCostLabel = "CPM";
      result.unitCost = {
        min: rangeOf(cpm, "min"),
        typical: rangeOf(cpm, "typical"),
        max: rangeOf(cpm, "max"),
      };

      result.impressions = {
        min: (budget / cpm.max) * 1000,
        typical: (budget / cpm.typical) * 1000,
        max: (budget / cpm.min) * 1000,
      };

      result.reach = {
        min: Math.min(audience, result.impressions.min / freq.max),
        typical: Math.min(audience, result.impressions.typical / freq.typical),
        max: Math.min(audience, result.impressions.max / freq.min),
      };

      result.clicks = {
        min: result.impressions.min * ctr.min,
        typical: result.impressions.typical * ctr.typical,
        max: result.impressions.max * ctr.max,
      };
    }

    return result;
  }

  function estimateMix(goal, geoId, budget) {
    const totalBudget = Math.max(0, Number(budget) || 0);
    const resolved = resolveRecommendedShares(goal, geoId, totalBudget);
    const rules = resolved.shares;
    // Тотал режется долями микса под цель (и выбранные площадки) + динамический сплит.
    const parts = activePlatforms().map((id) => {
      const share = rules[id] || 0;
      const partBudget = totalBudget * share;
      const estimate = estimatePlatform(id, geoId, partBudget, goal);
      return { share, partBudget, estimate };
    });

    const totals = {
      clicks: { min: 0, typical: 0, max: 0 },
      reach: { min: 0, typical: 0, max: 0 },
      impressions: { min: 0, typical: 0, max: 0 },
      budget: totalBudget,
    };

    for (const part of parts) {
      for (const key of ["min", "typical", "max"]) {
        // Клики и показы только суммируем (уникальность — только для охвата).
        totals.clicks[key] += part.estimate.clicks?.[key] || 0;
        totals.reach[key] += part.estimate.reach?.[key] || 0;
        totals.impressions[key] += part.estimate.impressions?.[key] || 0;
      }
    }

    const efficiency = {};
    for (const key of ["min", "typical", "max"]) {
      const clicks = totals.clicks[key];
      const imps = totals.impressions[key];
      efficiency[key] = {
        cpc: clicks > 0 ? totalBudget / clicks : null,
        cpm: imps > 0 ? totalBudget / (imps / 1000) : null,
        ctr: imps > 0 ? clicks / imps : null,
      };
    }

    return {
      parts,
      totals,
      rules,
      baseRules: resolved.baseShares,
      shareNotes: resolved.notes,
      shareTips: resolved.tips || {},
      sharesAdjusted: resolved.adjusted,
      efficiency,
      totalBudget,
    };
  }

  function resolveBubblePos(id) {
    if (state.bubblePos[id]) return state.bubblePos[id];
    return BUBBLE_LAYOUT[id] || { x: 50, y: 50 };
  }

  function setBubblePos(bubble, pos, { animate = false } = {}) {
    if (animate) {
      bubble.classList.add("is-sliding");
      window.setTimeout(() => bubble.classList.remove("is-sliding"), 420);
    }
    bubble.style.setProperty("--x", `${pos.x}%`);
    bubble.style.setProperty("--y", `${pos.y}%`);
    state.bubblePos[bubble.dataset.platform] = { x: pos.x, y: pos.y };
  }

  function clampBubblePercent(cluster, xPct, yPct, bubbleEl, { bounce = false } = {}) {
    const w = cluster.clientWidth;
    const h = cluster.clientHeight;
    if (!w || !h) return { x: xPct, y: yPct };

    const cx = w / 2;
    const cy = h / 2;
    const rBubble = bubbleEl.offsetWidth / 2;
    const maxR = Math.max(8, Math.min(cx, cy) - rBubble - 2);

    let x = (xPct / 100) * w;
    let y = (yPct / 100) * h;
    let dx = x - cx;
    let dy = y - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > maxR) {
      const k = maxR / dist;
      dx *= k;
      dy *= k;
      if (bounce) {
        bubbleEl.classList.remove("is-bounce-edge");
        void bubbleEl.offsetWidth;
        bubbleEl.classList.add("is-bounce-edge");
      }
    }

    return {
      x: ((cx + dx) / w) * 100,
      y: ((cy + dy) / h) * 100,
    };
  }

  function separateBubbles(cluster, { preferMoveId = null, animateOthers = true } = {}) {
    const bubbles = [...cluster.querySelectorAll(".bubble-platform")];
    if (bubbles.length < 2) return;

    const w = cluster.clientWidth;
    const h = cluster.clientHeight;
    if (!w || !h) return;

    const gap = 6; // небольшой зазор между кружками
    const moved = new Set();

    // Несколько итераций, чтобы разъехались все пары
    for (let iter = 0; iter < 8; iter += 1) {
      for (let i = 0; i < bubbles.length; i += 1) {
        for (let j = i + 1; j < bubbles.length; j += 1) {
          const a = bubbles[i];
          const b = bubbles[j];
          const pa = resolveBubblePos(a.dataset.platform);
          const pb = resolveBubblePos(b.dataset.platform);

          const ax = (pa.x / 100) * w;
          const ay = (pa.y / 100) * h;
          const bx = (pb.x / 100) * w;
          const by = (pb.y / 100) * h;

          const ra = a.offsetWidth / 2;
          const rb = b.offsetWidth / 2;
          const minDist = ra + rb + gap;

          let dx = bx - ax;
          let dy = by - ay;
          let dist = Math.hypot(dx, dy);

          if (dist < 0.01) {
            // Полное совпадение — слегка расталкиваем в случайную сторону
            const angle = (i + j + iter) * 2.1;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            dist = 1;
          }

          if (dist >= minDist) continue;

          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          const idA = a.dataset.platform;
          const idB = b.dataset.platform;

          let pushA = 0.5;
          let pushB = 0.5;
          if (preferMoveId === idA) {
            pushA = 0.15;
            pushB = 0.85;
          } else if (preferMoveId === idB) {
            pushA = 0.85;
            pushB = 0.15;
          }

          const ax2 = ax - nx * overlap * pushA;
          const ay2 = ay - ny * overlap * pushA;
          const bx2 = bx + nx * overlap * pushB;
          const by2 = by + ny * overlap * pushB;

          const nextA = clampBubblePercent(cluster, (ax2 / w) * 100, (ay2 / h) * 100, a);
          const nextB = clampBubblePercent(cluster, (bx2 / w) * 100, (by2 / h) * 100, b);

          const aChanged = Math.hypot(nextA.x - pa.x, nextA.y - pa.y) > 0.15;
          const bChanged = Math.hypot(nextB.x - pb.x, nextB.y - pb.y) > 0.15;

          if (aChanged) {
            setBubblePos(a, nextA, {
              animate: animateOthers && preferMoveId !== idA,
            });
            if (preferMoveId !== idA) moved.add(a);
          }
          if (bChanged) {
            setBubblePos(b, nextB, {
              animate: animateOthers && preferMoveId !== idB,
            });
            if (preferMoveId !== idB) moved.add(b);
          }
        }
      }
    }

    moved.forEach((el) => {
      el.classList.remove("is-bounce-edge");
      void el.offsetWidth;
      el.classList.add("is-bounce-edge");
    });
  }

  function enableBubbleDrag(cluster) {
    if (!cluster) return;

    // Стартовое разведение, если уже лежат друг на друге
    separateBubbles(cluster, { animateOthers: false });

    cluster.querySelectorAll(".bubble-platform").forEach((bubble) => {
      bubble.setAttribute("role", "button");
      bubble.setAttribute("tabindex", "0");
      bubble.setAttribute("aria-grabbed", "false");

      bubble.addEventListener("pointerdown", (event) => {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        bubble.setPointerCapture(event.pointerId);
        bubble.classList.add("is-dragging");
        bubble.classList.remove("is-dropped", "is-bounce-edge", "is-sliding");
        bubble.setAttribute("aria-grabbed", "true");
        bubble.style.zIndex = "20";

        const move = (ev) => {
          const rect = cluster.getBoundingClientRect();
          const xPct = ((ev.clientX - rect.left) / rect.width) * 100;
          const yPct = ((ev.clientY - rect.top) / rect.height) * 100;
          const clamped = clampBubblePercent(cluster, xPct, yPct, bubble);
          setBubblePos(bubble, clamped);
          // Остальные стезжают с перетаскиваемого (без анимации на каждый кадр)
          separateBubbles(cluster, {
            preferMoveId: bubble.dataset.platform,
            animateOthers: false,
          });
        };

        const up = (ev) => {
          bubble.releasePointerCapture(ev.pointerId);
          bubble.classList.remove("is-dragging");
          bubble.classList.add("is-dropped");
          bubble.setAttribute("aria-grabbed", "false");
          bubble.style.zIndex = "";
          // Финальное разведение с анимацией «съехали»
          separateBubbles(cluster, { animateOthers: true });
          bubble.removeEventListener("pointermove", move);
          bubble.removeEventListener("pointerup", up);
          bubble.removeEventListener("pointercancel", up);
          window.setTimeout(() => bubble.classList.remove("is-dropped"), 600);
        };

        bubble.addEventListener("pointermove", move);
        bubble.addEventListener("pointerup", up);
        bubble.addEventListener("pointercancel", up);
      });
    });
  }

  const helpTipControllers = new Map();

  function bindHelpTip(btnId, popId) {
    const btn = document.getElementById(btnId);
    const pop = document.getElementById(popId);
    if (!btn || !pop) return;

    const prev = helpTipControllers.get(btnId);
    if (prev) prev.abort();
    const controller = new AbortController();
    helpTipControllers.set(btnId, controller);
    const { signal } = controller;

    const close = () => {
      pop.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      btn.classList.remove("is-open");
    };

    const open = () => {
      pop.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      btn.classList.add("is-open");
    };

    btn.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
        if (pop.hidden) open();
        else close();
      },
      { signal }
    );

    document.addEventListener(
      "click",
      (event) => {
        if (pop.hidden) return;
        if (btn.contains(event.target) || pop.contains(event.target)) return;
        close();
      },
      { signal }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") close();
      },
      { signal }
    );
  }

  function bindOverlapHelpTip() {
    bindHelpTip("overlapHelpTip", "overlapHelpPop");
  }

  function bindGoalHelpTip() {
    bindHelpTip("goalHelpTip", "goalHelpPop");
  }

  function bindGeoHelpTip() {
    bindHelpTip("geoHelpTip", "geoHelpPop");
  }

  function bindPeriodHelpTip() {
    bindHelpTip("periodHelpTip", "periodHelpPop");
  }

  function bindIndustryHelpTip() {
    bindHelpTip("industryHelpTip", "industryHelpPop");
  }

  function bindPlatformsHelpTip() {
    bindHelpTip("platformsHelpTip", "platformsHelpPop");
  }

  function bindBudgetHelpTip() {
    bindHelpTip("budgetHelpTip", "budgetHelpPop");
  }

  function bindSeasonalityHelpTip() {
    bindHelpTip("seasonalityHelpTip", "seasonalityHelpPop");
  }

  /**
   * Масштаб пузыря: площадь ∝ охват / ёмкость рынка.
   * Радиус = sqrt(share), поэтому отношение площадей = отношение охватов,
   * а доля от внешнего круга ≈ доля в TAM (как в легенде «% ёмкости»).
   */
  function bubbleScaleFromReach(reach, audience) {
    if (!(audience > 0)) return 0;
    const r = Math.max(0, Number(reach) || 0);
    const share = Math.min(1, r / audience);
    // Небольшой запас, чтобы пузырь не вылезал за край ёмкости при оффсет-позиции
    return Math.min(0.9, Math.sqrt(share));
  }

  function renderCapacity() {
    const geo = state.data.geos[state.geo];
    const { audience, audienceMln, industry } = resolveAudience();
    const correlationFactor = resolveCorrelationFactor();
    const selected = activePlatforms();
    const singleChannel = selected.length === 1;
    const mix = estimateMix(state.goal, state.geo, workingBudget());

    const maxAudience = Math.max(
      ...Object.values(state.data.geos).map((g) => g.audience_mln)
    );
    const outerScale = 0.88 + 0.12 * Math.sqrt(audienceMln / maxAudience);

    const platformBubbles = mix.parts.map(({ estimate, partBudget, share: mixShare }) => {
      const reach = estimate.reach.typical;
      const share = Math.min(1, Math.max(0, reach / audience));
      const scale = bubbleScaleFromReach(reach, audience);
      const pos = resolveBubblePos(estimate.id);
      return {
        id: estimate.id,
        label: estimate.label,
        reach,
        clicks: estimate.clicks.typical,
        share,
        mixShare,
        partBudget,
        scale,
        x: pos.x,
        y: pos.y,
      };
    });

    const overlap = calculateAudienceOverlap(
      audience,
      platformBubbles.map((p) => ({ id: p.id, reach: p.reach })),
      { correlationFactor }
    );
    const totalReach = overlap.grossReach;
    const unique = overlap.totalUnique;
    if (singleChannel && platformBubbles.length === 1) {
      const bubble = platformBubbles[0];
      bubble.reach = unique;
      bubble.share = Math.min(1, Math.max(0, unique / audience));
      bubble.scale = bubbleScaleFromReach(unique, audience);
    }
    const overlapTotal = overlap.overlapAbsolute;
    const overlapShare = overlap.overlapPercentage / 100;
    const totalClicks = mix.totals.clicks.typical;
    const eff = mix.efficiency.typical;

    const bubblesHtml = platformBubbles
      .map(
        (p) => `
        <div class="bubble bubble-platform${p.scale < 0.12 ? " is-tiny" : ""}" data-platform="${p.id}"
          style="--plat-scale:${p.scale}; --x:${p.x}%; --y:${p.y}%"
          title="${p.label}: ~${formatCompact(p.reach)} охвата (${formatPercent(p.share)} ёмкости) · доля микса ${formatPercent(p.mixShare)} · потяните">
          <span class="bubble-visual" aria-hidden="true">${PLATFORM_LOGOS[p.id]}</span>
        </div>`
      )
      .join("");

    const bubblesById = Object.fromEntries(platformBubbles.map((p) => [p.id, p]));
    const legendPlatforms = PLATFORM_ORDER.map((id) => {
      const label = state.data.platforms[id]?.label || id;
      const p = bubblesById[id];
      if (!p) {
        const manualOff = state.platformOverrides[id] === "off";
        const offLabel = manualOff ? "выключено вручную" : "пока не в наборе";
        return `
        <li class="is-off" aria-disabled="true">
          <span class="bubble-swatch platform" data-platform="${id}"></span>
          <div>
            <strong>${label}</strong>
            <p class="muted">${offLabel}</p>
          </div>
        </li>`;
      }
      const secondary =
        state.goal === "traffic"
          ? `${formatCompact(p.clicks)} кликов`
          : `${formatPercent(p.share)} ёмкости`;
      return `
        <li>
          <span class="bubble-swatch platform" data-platform="${id}"></span>
          <div>
            <strong>${label}</strong>
            <p>~${formatCompact(p.reach)} охвата · ${secondary} · ${formatMoney(p.partBudget)}</p>
          </div>
        </li>`;
    }).join("");

    const capacityTitle = industry ? `Ёмкость · ${industry.label}` : "Ёмкость рынка";
    const capacityDesc = industry
      ? `~${formatNumber(audienceMln, 1)} млн в «${industry.label}» · ${formatPercent(industry.audience_share)} аудитории ${geoLabelOf(state.geo)}`
      : `~${formatNumber(geo.audience_mln, 0)} млн пользователей в выбранном гео`;

    const mixLabel = mixFramingLabel();
    const overlapHelp = industry
      ? `Охваты считаются по ${mixLabel} от тотал-бюджета. При фокусе на индустрию «${industry.label}» ёмкость сужается до доли аудитории (~${formatPercent(industry.audience_share)}), а корреляция площадок усиливается (k=${correlationFactor}). Поэтому при тех же охватах доля пересечения растёт — площадки чаще бьют в одно и то же ядро интереса.`
      : singleChannel
        ? `Сейчас в расчёте одна площадка — пересечения между каналами нет. Охваты и клики считаются по бюджету на этом канале.`
        : `Охваты считаются по ${mixLabel} от тотал-бюджета. Расчёт пересечения работает на базе теории вероятностей, но с поправкой на реальное поведение людей. Он автоматически сужает официальную численность населения региона до «активного интернет-ядра», чтобы честно показать, как часто одни и те же люди будут видеть вашу рекламу на разных площадках.`;

    const insightPlace = industry
      ? `в сегменте «${industry.label}» в ${geoLabelIn(state.geo)}`
      : `в ${geoLabelIn(state.geo)}`;

    const cpcText = Number.isFinite(eff.cpc) ? formatMoney(eff.cpc) : "—";
    const cpmText = Number.isFinite(eff.cpm) ? formatMoney(eff.cpm) : "—";
    const costPrimary =
      state.goal === "traffic"
        ? { label: "Ср. CPC", value: cpcText, sub: `CPM ${cpmText}` }
        : { label: "Ср. CPM", value: cpmText, sub: `CPC ${cpcText}` };
    const ctrText = Number.isFinite(eff.ctr) ? formatPercent(eff.ctr) : "—";

    const disclaimerHtml = `
      <div class="disclaimer">
        <span>${state.data.meta.disclaimer}</span>
      </div>`;

    const overlapIcons = {
      sum: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true"><defs><linearGradient id="ogSum" x1="2" y1="18" x2="22" y2="5" gradientUnits="userSpaceOnUse"><stop stop-color="#3d9cff"/><stop offset=".5" stop-color="#8b6bff"/><stop offset="1" stop-color="#e0a8ff"/></linearGradient></defs><g stroke="url(#ogSum)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.7" cy="8.35" r="2.2"/><path d="M3.15 18.35c.5-2.4 1.9-3.6 3.55-3.6 1.05 0 1.95.45 2.65 1.25"/><circle cx="17.3" cy="8.35" r="2.2"/><path d="M14.65 16c.7-.8 1.6-1.25 2.65-1.25 1.65 0 3.05 1.2 3.55 3.6"/><circle cx="12" cy="7.55" r="2.7"/><path d="M6.7 18.75c.8-2.95 2.8-4.4 5.3-4.4s4.5 1.45 5.3 4.4"/></g></svg>`,
      overlap: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true"><defs><linearGradient id="ogOverlap" x1="3" y1="12" x2="21" y2="12" gradientUnits="userSpaceOnUse"><stop stop-color="#ff5f8a"/><stop offset="1" stop-color="#ff9a45"/></linearGradient></defs><path d="M12 7.2a5.5 5.5 0 0 0-3.7 9.55 5.5 5.5 0 0 0 7.4 0A5.5 5.5 0 0 0 12 7.2z" fill="url(#ogOverlap)" fill-opacity=".32" stroke="none"/><circle cx="9.05" cy="12" r="5.5" stroke="url(#ogOverlap)" stroke-width="1.8"/><circle cx="14.95" cy="12" r="5.5" stroke="url(#ogOverlap)" stroke-width="1.8"/></svg>`,
      unique: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true"><defs><linearGradient id="ogUnique" x1="4" y1="12" x2="20" y2="12" gradientUnits="userSpaceOnUse"><stop stop-color="#5eb8ff"/><stop offset="1" stop-color="#3d6fff"/></linearGradient></defs><g stroke="url(#ogUnique)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="12.4" r="7.1"/><circle cx="11" cy="12.4" r="4.2"/><circle cx="11" cy="12.4" r="1.25"/><path d="M16.15 5.05l4.55-1.35-1.4 4.55-1.55-1.15z" fill="url(#ogUnique)" stroke="none"/><path d="M16.55 6.85 12.35 11.05"/></g></svg>`,
      budget: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true"><g stroke="#ff6a45" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.4" y="6.6" width="17.2" height="11.8" rx="2.6"/><path d="M3.4 10.2h17.2"/><circle cx="16.55" cy="14.55" r="1.2"/></g></svg>`,
      cost: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true"><path d="M6 3.5v14.2l3.55-3.35 2.35 5.55 2.35-.95-2.4-5.55H18.6L6 3.5z" stroke="#ff6a45" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
      ctr: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true"><g stroke="#4d8dff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 17.2 7.9 12.4l3.35 2.85L16.6 8.6 20.4 4.9"/><path d="M16.2 4.9h4.2v4.15"/></g></svg>`,
    };

    const overlapCard = (tone, icon, label, value, sub) => `
      <div class="overlap-card" data-tone="${tone}">
        <span class="overlap-card-icon" aria-hidden="true">${icon}</span>
        <div class="overlap-card-body">
          <span class="overlap-metric-label">${label}</span>
          <strong class="overlap-metric-value">${value}</strong>
          <span class="overlap-metric-sub">${sub}</span>
        </div>
      </div>`;

    const overlapTitle = singleChannel ? "Результат за бюджет" : "С учётом пересечений";
    const overlapCards = singleChannel
      ? [
          overlapCard("blue", overlapIcons.unique, "Охват", `≈${formatCompact(unique)}`, `${formatCompact(totalClicks)} кликов`),
          overlapCard("pink", overlapIcons.budget, "Бюджет канала", formatMoney(mix.totalBudget), "тотал на площадку"),
          overlapCard("red", overlapIcons.cost, costPrimary.label, costPrimary.value, costPrimary.sub),
          overlapCard("blue", overlapIcons.ctr, "CTR", ctrText, "клики / показы"),
        ].join("")
      : [
          overlapCard("cyan", overlapIcons.sum, "Общий охват", formatCompact(totalReach), "сумма по площадкам"),
          overlapCard("pink", overlapIcons.overlap, "Пересечение аудиторий", formatCompact(overlapTotal), `${formatPercent(overlapShare)} от суммы по площадкам`),
          overlapCard("blue", overlapIcons.unique, "Уникальный охват", `≈${formatCompact(unique)}`, `${formatCompact(totalClicks)} кликов`),
          overlapCard("pink", overlapIcons.budget, "Бюджет микса", formatMoney(mix.totalBudget), "тотал · сплит по цели"),
          overlapCard("red", overlapIcons.cost, costPrimary.label, costPrimary.value, costPrimary.sub),
          overlapCard("blue", overlapIcons.ctr, "CTR микса", ctrText, "клики / показы"),
        ].join("");

    const insightText =
      state.goal === "traffic"
        ? `Около ${formatCompact(totalClicks)} кликов ${insightPlace} по ${mixLabel}`
        : `Около ${formatCompact(unique)} уникальных пользователей ${insightPlace} по ${mixLabel}`;

    const overlapSummary = selected.length
      ? `<section class="overlap-summary planner-card" aria-label="${overlapTitle}">
          <div class="metric-title-row">
            <strong>${overlapTitle}</strong>
            <button type="button" class="help-tip" id="overlapHelpTip" aria-expanded="false" aria-controls="overlapHelpPop" aria-label="Как считается пересечение">?</button>
            <div class="help-pop" id="overlapHelpPop" role="tooltip" hidden>
              ${overlapHelp}
            </div>
          </div>
          <div class="overlap-grid">
            ${overlapCards}
          </div>
          <div class="overlap-insight">
            <span class="overlap-insight-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2.5l1.2 4.2L17.5 8l-4.3 1.3L12 13.5l-1.2-4.2L6.5 8l4.3-1.3L12 2.5z"/>
                <path d="M18.5 13.2l.7 2.4 2.4.7-2.4.7-.7 2.4-.7-2.4-2.4-.7 2.4-.7.7-2.4z" opacity=".85"/>
                <path d="M6.2 14.5l.55 1.85 1.85.55-1.85.55-.55 1.85-.55-1.85-1.85-.55 1.85-.55.55-1.85z" opacity=".7"/>
              </svg>
            </span>
            <div>
              <strong>Что это значит</strong>
              <p>${insightText}</p>
            </div>
          </div>
          ${disclaimerHtml}
        </section>`
      : `<section class="overlap-summary planner-card" aria-label="Результат за бюджет">
          <div class="metric-title-row">
            <strong>Результат за бюджет</strong>
          </div>
          ${disclaimerHtml}
        </section>`;

    els.capacityBars.innerHTML = `
      <div class="bubbles-layout">
        <div class="bubbles-stage">
          <div class="bubble bubble-outer" style="--outer-scale:${outerScale}">
            <div class="bubble-cluster">
              ${bubblesHtml}
            </div>
          </div>
        </div>
        <ul class="bubbles-legend">
          <li>
            <span class="bubble-swatch outer"></span>
            <div>
              <strong>${capacityTitle}</strong>
              <p>${capacityDesc}</p>
            </div>
          </li>
          ${legendPlatforms}
        </ul>
      </div>`;

    if (els.overlapMount) {
      els.overlapMount.innerHTML = overlapSummary;
    }

    enableBubbleDrag(els.capacityBars.querySelector(".bubble-cluster"));
    bindOverlapHelpTip();
  }

  /** Эффективные CPC и CPM для карточки: бенч, если есть, иначе из бюджета / клики|показы. */
  function resolveCostPair(est, partBudget, geoBench) {
    const moneyRange = (typical, min, max) => ({
      typical: Number.isFinite(typical) ? typical : null,
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null,
    });

    let cpc = null;
    let cpm = null;

    if (geoBench?.cpc) {
      cpc = moneyRange(geoBench.cpc.typical, geoBench.cpc.min, geoBench.cpc.max);
    } else if (est.clicks?.typical > 0) {
      cpc = moneyRange(
        partBudget / est.clicks.typical,
        partBudget / est.clicks.max,
        partBudget / est.clicks.min
      );
    }

    if (geoBench?.cpm) {
      cpm = moneyRange(geoBench.cpm.typical, geoBench.cpm.min, geoBench.cpm.max);
    } else if (est.impressions?.typical > 0) {
      cpm = moneyRange(
        partBudget / (est.impressions.typical / 1000),
        partBudget / (est.impressions.max / 1000),
        partBudget / (est.impressions.min / 1000)
      );
    }

    return { cpc, cpm };
  }

  function formatCostMetric(range) {
    if (!range || !Number.isFinite(range.typical)) {
      return { typical: "—", range: "—" };
    }
    const lo = Number.isFinite(range.min) ? formatMoney(range.min) : "—";
    const hi = Number.isFinite(range.max) ? formatMoney(range.max) : "—";
    return {
      typical: formatMoney(range.typical),
      range: `${lo} – ${hi}`,
    };
  }

  function pc2RowIcon(kind) {
    const icons = {
      share: `<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v9h9"/></svg>`,
      budget: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/></svg>`,
      cpc: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5c.6-1 1.7-1.6 2.8-1.5 1.5.1 2.5 1.2 2.5 2.6 0 1.6-1.2 2.3-2.5 2.9-.9.4-1.8.8-1.8 1.8"/><path d="M12 17.2v.3"/></svg>`,
      cpm: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 10.5h8M8 13.5h5.5"/></svg>`,
      ctr: `<svg viewBox="0 0 24 24"><path d="M4 16l5-5 3.5 3.5L20 7"/><path d="M15 7h5v5"/></svg>`,
      clicks: `<svg viewBox="0 0 24 24"><path d="M5 14l5-5 3.5 3.5L19 7"/><path d="M14 7h5v5"/></svg>`,
      reach: `<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="2.4"/><circle cx="16" cy="10.5" r="2"/><path d="M4.5 18c.7-2.2 2.4-3.4 4.5-3.4s3.8 1.2 4.5 3.4"/><path d="M13.2 18c.4-1.5 1.5-2.4 2.9-2.4 1.2 0 2.2.7 2.7 1.8"/></svg>`,
      fit: `<svg viewBox="0 0 24 24"><path d="M4 16l5-5 3.5 3.5L20 7"/><path d="M15 7h5v5"/></svg>`,
      plus: `<svg viewBox="0 0 24 24"><path d="M8 6h11M8 12h11M8 18h11"/><path d="M5 6h.01M5 12h.01M5 18h.01"/></svg>`,
      limit: `<svg viewBox="0 0 24 24"><path d="M12 9v4.5"/><path d="M12 17h.01"/><path d="M10.3 4.8L2.9 18a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0z"/></svg>`,
    };
    return `<span class="pc2-row-icon" aria-hidden="true">${icons[kind] || ""}</span>`;
  }

  function pc2StarsHtml(count) {
    const n = Math.max(0, Math.min(5, Number(count) || 0));
    const star = `<svg viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M12 3.2l2.4 5.2 5.7.6-4.3 3.8 1.3 5.6L12 15.6 6.9 18.4l1.3-5.6L3.9 9l5.7-.6z"/></svg>`;
    return `<div class="pc2-stars" aria-label="${n} из 5">${Array.from({ length: 5 }, (_, i) =>
      i < n ? star : star.replace("<svg", '<svg class="empty"')
    ).join("")}</div>`;
  }

  function renderPlatforms() {
    const selected = activePlatforms();
    if (!selected.length) {
      els.platformGrid.innerHTML = `<p class="empty-hint">Включите хотя бы одну площадку во вводных.</p>`;
      return;
    }

    const mix = estimateMix(state.goal, state.geo, workingBudget());
    const byId = Object.fromEntries(mix.parts.map((p) => [p.estimate.id, p]));
    const cols = selected
      .map((id) => byId[id])
      .filter(Boolean);

    if (!cols.length) {
      els.platformGrid.innerHTML = `<p class="empty-hint">Нет данных по выбранным площадкам.</p>`;
      return;
    }

    const copyFor = (id) =>
      PLATFORM_COMPARE_COPY[state.goal]?.[id] || {
        note: "",
        advantage: "—",
        limitation: "—",
      };

    const metricCell = (typical, range) => `
      <div class="pc2-metric">
        <p class="pc2-value">${typical}</p>
        <p class="pc2-range">${range}</p>
      </div>`;

    const headCells = cols.map(({ estimate }) => {
      const id = estimate.id;
      const logo = PLATFORM_LOGO_SRC[id] || "";
      return `
        <th class="pc2-col" data-platform="${id}" scope="col">
          <div class="pc2-platform">
            <div class="pc2-logo-wrap">
              <img class="pc2-logo" src="${logo}" alt="" width="36" height="36" decoding="async" />
            </div>
            <div class="pc2-platform-meta">
              <p class="pc2-name">${estimate.label}</p>
              <span class="pc2-fit ${estimate.fit}">${FIT_LABELS[estimate.fit] || estimate.fit}</span>
            </div>
          </div>
        </th>`;
    }).join("");

    const shareCells = cols.map(({ estimate, share }) => {
      const pct = Math.round(share * 1000) / 10;
      return `
        <td class="pc2-col" data-platform="${estimate.id}">
          <div class="pc2-share">
            <p class="pc2-value">${formatPercent(share)}</p>
            <div class="pc2-share-bar" aria-hidden="true"><span style="width:${Math.min(100, Math.max(0, pct))}%"></span></div>
          </div>
        </td>`;
    }).join("");

    const budgetCells = cols.map(({ estimate, partBudget }) => `
      <td class="pc2-col" data-platform="${estimate.id}">
        <p class="pc2-value">${formatMoney(partBudget)}</p>
      </td>`).join("");

    const cpcCells = cols.map(({ estimate, partBudget }) => {
      const geoBench = resolveGeoBench(estimate.id, state.geo);
      const { cpc } = resolveCostPair(estimate, partBudget, geoBench);
      const view = formatCostMetric(cpc);
      return `<td class="pc2-col" data-platform="${estimate.id}">${metricCell(view.typical, view.range)}</td>`;
    }).join("");

    const cpmCells = cols.map(({ estimate, partBudget }) => {
      const geoBench = resolveGeoBench(estimate.id, state.geo);
      const { cpm } = resolveCostPair(estimate, partBudget, geoBench);
      const view = formatCostMetric(cpm);
      return `<td class="pc2-col" data-platform="${estimate.id}">${metricCell(view.typical, view.range)}</td>`;
    }).join("");

    const ctrCells = cols.map(({ estimate }) => {
      let typ = estimate.ctr?.typical;
      let lo = estimate.ctr?.min;
      let hi = estimate.ctr?.max;
      if (!Number.isFinite(typ) && estimate.clicks?.typical > 0 && estimate.impressions?.typical > 0) {
        typ = estimate.clicks.typical / estimate.impressions.typical;
        lo = estimate.clicks.max > 0 && estimate.impressions.min > 0
          ? estimate.clicks.max / estimate.impressions.min
          : typ;
        hi = estimate.clicks.min > 0 && estimate.impressions.max > 0
          ? estimate.clicks.min / estimate.impressions.max
          : typ;
        if (lo > hi) [lo, hi] = [hi, lo];
      }
      if (!Number.isFinite(typ)) {
        return `<td class="pc2-col" data-platform="${estimate.id}">${metricCell("—", "—")}</td>`;
      }
      const fmt = (v) => formatPercent(v);
      const range = Number.isFinite(lo) && Number.isFinite(hi)
        ? `${fmt(lo)} – ${fmt(hi)}`
        : "—";
      return `<td class="pc2-col" data-platform="${estimate.id}">${metricCell(fmt(typ), range)}</td>`;
    }).join("");

    const clicksCells = cols.map(({ estimate }) => {
      const typical = formatCompact(estimate.clicks.typical);
      const range = `${formatCompact(estimate.clicks.min)} – ${formatCompact(estimate.clicks.max)}`;
      return `<td class="pc2-col" data-platform="${estimate.id}">${metricCell(typical, range)}</td>`;
    }).join("");

    const reachCells = cols.map(({ estimate }) => {
      const typical = formatCompact(estimate.reach.typical);
      const range = `${formatCompact(estimate.reach.min)} – ${formatCompact(estimate.reach.max)}`;
      return `<td class="pc2-col" data-platform="${estimate.id}">${metricCell(typical, range)}</td>`;
    }).join("");

    const fitCells = cols.map(({ estimate }) => {
      const id = estimate.id;
      const copy = copyFor(id);
      const stars = FIT_STARS[estimate.fit] ?? 3;
      return `
        <td class="pc2-col" data-platform="${id}">
          ${pc2StarsHtml(stars)}
          <p class="pc2-fit-note">${copy.note}</p>
        </td>`;
    }).join("");

    const advantageCells = cols.map(({ estimate }) => {
      const copy = copyFor(estimate.id);
      return `<td class="pc2-col" data-platform="${estimate.id}"><p class="pc2-text">${copy.advantage}</p></td>`;
    }).join("");

    const limitCells = cols.map(({ estimate }) => {
      const copy = copyFor(estimate.id);
      return `<td class="pc2-col" data-platform="${estimate.id}"><p class="pc2-text">${copy.limitation}</p></td>`;
    }).join("");

    const rowLabel = (icon, text) => `
      <th class="pc2-row-label" scope="row">
        <div class="pc2-row-label-inner">
          ${pc2RowIcon(icon)}
          <span>${text}</span>
        </div>
      </th>`;

    const recText = buildConclusionText(cols, state.goal);
    const conclusionHtml = recText
      ? `<div class="pc2-conclusion">
          <div class="pc2-conclusion-head">
            <span class="pc2-conclusion-sparkles" aria-hidden="true">✦✦</span>
            <strong class="pc2-conclusion-title">Вывод</strong>
          </div>
          <p class="pc2-conclusion-text">${recText}</p>
        </div>`
      : "";

    const cardsHtml = cols.map(({ estimate, share, partBudget }) => {
      const id = estimate.id;
      const copy = copyFor(id);
      const logo = PLATFORM_LOGO_SRC[id] || "";
      const geoBench = resolveGeoBench(id, state.geo);
      const { cpc, cpm } = resolveCostPair(estimate, partBudget, geoBench);
      const cpcView = formatCostMetric(cpc);
      const cpmView = formatCostMetric(cpm);
      let ctrTyp = estimate.ctr?.typical;
      let ctrLo = estimate.ctr?.min;
      let ctrHi = estimate.ctr?.max;
      if (!Number.isFinite(ctrTyp) && estimate.clicks?.typical > 0 && estimate.impressions?.typical > 0) {
        ctrTyp = estimate.clicks.typical / estimate.impressions.typical;
        ctrLo = estimate.clicks.max > 0 && estimate.impressions.min > 0
          ? estimate.clicks.max / estimate.impressions.min
          : ctrTyp;
        ctrHi = estimate.clicks.min > 0 && estimate.impressions.max > 0
          ? estimate.clicks.min / estimate.impressions.max
          : ctrTyp;
        if (ctrLo > ctrHi) [ctrLo, ctrHi] = [ctrHi, ctrLo];
      }
      const ctrTypical = Number.isFinite(ctrTyp) ? formatPercent(ctrTyp) : "—";
      const ctrRange = Number.isFinite(ctrLo) && Number.isFinite(ctrHi)
        ? `${formatPercent(ctrLo)} – ${formatPercent(ctrHi)}`
        : "—";
      const pct = Math.round(share * 1000) / 10;
      const stars = FIT_STARS[estimate.fit] ?? 3;
      return `
        <article class="pc2-card" data-platform="${id}">
          <div class="pc2-card-head">
            <div class="pc2-logo-wrap">
              <img class="pc2-logo" src="${logo}" alt="" width="36" height="36" decoding="async" />
            </div>
            <div class="pc2-card-head-meta">
              <p class="pc2-name">${estimate.label}</p>
              <span class="pc2-fit ${estimate.fit}">${FIT_LABELS[estimate.fit] || estimate.fit}</span>
            </div>
            <div class="pc2-card-share">
              <p class="pc2-value">${formatPercent(share)}</p>
              <div class="pc2-share-bar" aria-hidden="true"><span style="width:${Math.min(100, Math.max(0, pct))}%"></span></div>
            </div>
          </div>
          <dl class="pc2-card-metrics">
            <div><dt>Бюджет</dt><dd>${formatMoney(partBudget)}</dd></div>
            <div><dt>CPC</dt><dd>${cpcView.typical}<span>${cpcView.range}</span></dd></div>
            <div><dt>CPM</dt><dd>${cpmView.typical}<span>${cpmView.range}</span></dd></div>
            <div><dt>CTR</dt><dd>${ctrTypical}<span>${ctrRange}</span></dd></div>
            <div><dt>Клики</dt><dd>${formatCompact(estimate.clicks.typical)}<span>${formatCompact(estimate.clicks.min)} – ${formatCompact(estimate.clicks.max)}</span></dd></div>
            <div><dt>Охват</dt><dd>${formatCompact(estimate.reach.typical)}<span>${formatCompact(estimate.reach.min)} – ${formatCompact(estimate.reach.max)}</span></dd></div>
          </dl>
          <div class="pc2-card-fit">
            ${pc2StarsHtml(stars)}
            <p class="pc2-fit-note">${copy.note}</p>
          </div>
          <div class="pc2-card-notes">
            <p><strong>Плюс</strong> ${copy.advantage}</p>
            <p><strong>Минус</strong> ${copy.limitation}</p>
          </div>
        </article>`;
    }).join("");

    els.platformGrid.innerHTML = `
      <div class="pc2">
        <div class="pc2-table-wrap">
          <table class="pc2-table" style="--pc2-n:${cols.length}">
            <thead>
              <tr>
                <th class="pc2-row-label" scope="col">
                  <span class="visually-hidden">Метрика</span>
                </th>
                ${headCells}
              </tr>
            </thead>
            <tbody>
              <tr>${rowLabel("share", cols.length === 1 ? "Доля бюджета" : "Доля в миксе")}${shareCells}</tr>
              <tr>${rowLabel("budget", cols.length === 1 ? "Бюджет канала" : "Бюджет при текущем миксе")}${budgetCells}</tr>
              <tr>${rowLabel("cpc", "CPC")}${cpcCells}</tr>
              <tr>${rowLabel("cpm", "CPM")}${cpmCells}</tr>
              <tr>${rowLabel("ctr", "CTR")}${ctrCells}</tr>
              <tr>${rowLabel("clicks", "Клики (прогноз)")}${clicksCells}</tr>
              <tr>${rowLabel("reach", "Охват (грубо)")}${reachCells}</tr>
              <tr>${rowLabel("fit", "Оценка соответствия")}${fitCells}</tr>
              <tr>${rowLabel("plus", "Ключевое преимущество")}${advantageCells}</tr>
              <tr>${rowLabel("limit", "Ограничения")}${limitCells}</tr>
            </tbody>
          </table>
        </div>
        <div class="pc2-cards">${cardsHtml}</div>
        ${conclusionHtml}
      </div>
    `;
  }

  const MIX_ROLE_LABELS = {
    "media+reach": "основной охват",
    "vk+reach": "дополнительный охват",
    "telegram+reach": "охват в мессенджере",
    "direct+reach": "горячий спрос",
    "direct+traffic": "основной трафик",
    "vk+traffic": "добор трафика",
    "telegram+traffic": "трафик из мессенджера",
    "media+traffic": "прогрев аудитории",
    "avito+traffic": "маркетплейс-трафик",
    "avito+reach": "точечный добор",
  };

  function mixRoleLabel(platformId, goal) {
    return MIX_ROLE_LABELS[`${platformId}+${goal}`] || "";
  }

  function mixWhyReasons(parts, goal) {
    if (!parts.length) return {};

    const reasons = {};
    parts.forEach(({ estimate }) => { reasons[estimate.id] = []; });

    // CPM/CPC как на карточке микса (resolveCostPair), не «сырой» typical из by_geo.
    const costRows = parts.map(({ estimate, partBudget }) => {
      const bench = resolveGeoBench(estimate.id, state.geo);
      const budget = Number.isFinite(partBudget) ? partBudget : 0;
      const { cpc, cpm } = resolveCostPair(estimate, budget, bench);
      return {
        id: estimate.id,
        cpm: Number.isFinite(cpm?.typical) ? cpm.typical : Infinity,
        cpc: Number.isFinite(cpc?.typical) ? cpc.typical : Infinity,
        ctr: Number.isFinite(estimate.ctr?.typical)
          ? estimate.ctr.typical
          : (bench?.ctr?.typical ?? 0),
      };
    });
    const minCpmId = costRows.reduce((a, b) => (a.cpm <= b.cpm ? a : b)).id;
    const maxCpmId = costRows.reduce((a, b) => (a.cpm >= b.cpm ? a : b)).id;
    const maxCtrId = costRows.reduce((a, b) => (a.ctr >= b.ctr ? a : b)).id;
    const minCtrId = costRows.reduce((a, b) => (a.ctr <= b.ctr ? a : b)).id;
    const minCpcId = costRows.reduce((a, b) => (a.cpc <= b.cpc ? a : b)).id;
    const maxReach = Math.max(...parts.map((p) => p.estimate.reach.typical));

    // Для отказов/роботности берём нижнюю границу диапазона (min), не typical
    // (typical часто ≈ среднее min–max и завышает ориентир в текстах микса).
    const qualityRows = parts.map(({ estimate }) => {
      const q = state.data.quality?.[estimate.id];
      return {
        id: estimate.id,
        bounce: q?.bounce?.min ?? Infinity,
        bot: q?.bot?.min ?? Infinity,
      };
    });
    const minBounceId = qualityRows.reduce((a, b) => (a.bounce <= b.bounce ? a : b)).id;
    const minBotId = qualityRows.reduce((a, b) => (a.bot <= b.bot ? a : b)).id;
    const maxBounce = Math.max(...qualityRows.map((r) => (Number.isFinite(r.bounce) ? r.bounce : 0)));
    const maxBot = Math.max(...qualityRows.map((r) => (Number.isFinite(r.bot) ? r.bot : 0)));

    const add = (id, text, tone) => {
      if (!reasons[id]) reasons[id] = [];
      if (reasons[id].length < 2 && !reasons[id].some((r) => r.text === text)) {
        reasons[id].push({ text, tone });
      }
    };

    const qualityReasonFor = (id) => {
      const row = qualityRows.find((r) => r.id === id);
      if (!row || !Number.isFinite(row.bounce) || !Number.isFinite(row.bot)) return null;

      // Prefer the metric where this platform is strongest vs peers in the mix
      if (id === minBounceId && parts.length > 1 && row.bounce < maxBounce) {
        return [`Отказы ${formatPercent(row.bounce)} — ниже, чем у остальных в миксе`, "positive"];
      }
      if (id === minBotId && parts.length > 1 && row.bot < maxBot) {
        return [`Роботность ${formatPercent(row.bot)} — ниже, чем у остальных в миксе`, "positive"];
      }
      if (row.bounce < maxBounce) {
        return [`Отказы ${formatPercent(row.bounce)} vs до ${formatPercent(maxBounce)} у других каналов`, "positive"];
      }
      if (row.bot < maxBot) {
        return [`Роботность ${formatPercent(row.bot)} vs до ${formatPercent(maxBot)} у других каналов`, "positive"];
      }
      return [`Отказы ${formatPercent(row.bounce)}, роботность ${formatPercent(row.bot)}`, "neutral"];
    };

    const byShare = [...parts].sort((a, b) => b.share - a.share);
    const primaryId = byShare[0]?.estimate.id;
    const bottomId = byShare[byShare.length - 1]?.estimate.id;

    const tierFor = (id, share) => {
      if (id === primaryId) return "primary";
      if (share <= 0.12 || (parts.length > 1 && id === bottomId)) return "limited";
      return "support";
    };

    const primaryReasons = {
      reach: {
        media: [
          ["Масштабный охват на медийном инвентаре", "positive"],
          ["Основной инструмент для широкой аудитории", "positive"],
        ],
        vk: [
          ["Дополнительный охват в соцсетях", "positive"],
          ["Минимальное пересечение с медийными площадками", "positive"],
        ],
        telegram: [
          ["Охват в мессенджере с высокой вовлечённостью", "positive"],
          ["Аудитория, недоступная в классической медийке", "positive"],
        ],
        direct: [
          ["Закрывает сегмент с высоким спросом", "positive"],
          ["Даёт качественные клики по целевой аудитории", "positive"],
        ],
      },
      traffic: {
        direct: [
          ["Закрывает пользователей с высоким спросом", "positive"],
          ["Даёт качественные клики по целевой аудитории", "positive"],
        ],
        vk: [
          ["Добор кликов из соцсетей", "positive"],
          ["Расширяет охват целевой аудитории", "positive"],
        ],
        telegram: [
          ["Добор кликов из мессенджера", "positive"],
          ["Доступ к вовлечённой аудитории каналов", "positive"],
        ],
        media: [
          ["Прогревает аудиторию перед конверсией", "positive"],
          ["Расширяет воронку на верхнем уровне", "positive"],
        ],
      },
    };

    const supportReasons = {
      reach: {
        vk: [
          ["Баланс между охватом и стоимостью", "neutral"],
          ["Дополняет медийку без сильного пересечения", "positive"],
        ],
        telegram: [
          ["Усиливает охват в мессенджере", "positive"],
          ["Сбалансированная доля для дополнительного охвата", "neutral"],
        ],
        direct: [
          ["Точечный добор горячего спроса", "neutral"],
          ["Не масштабирует охват, но закрывает intent-сегмент", "neutral"],
        ],
      },
      traffic: {
        vk: [
          ["Дополнительный источник кликов", "positive"],
          ["Расширяет охват целевой аудитории", "positive"],
        ],
        telegram: [
          ["Вовлечённая аудитория мессенджера", "positive"],
          ["Доступ к аудитории каналов", "positive"],
        ],
        direct: [
          ["Основной драйвер кликов в миксе", "positive"],
          ["Высокое намерение аудитории", "positive"],
        ],
      },
    };

    const limitedReasons = {
      reach: {
        direct: [
          ["Высокий CPM — неэффективен для масштабного охвата", "negative"],
          ["Узкий поисковый сегмент не даёт широкого охвата", "negative"],
          ["Оставлен только для захвата горячего спроса", "neutral"],
        ],
        media: [
          ["Недостаточная доля для лидерства по охвату", "neutral"],
          ["Используется как вспомогательный канал", "neutral"],
        ],
        vk: [
          ["Минимальная доля — основной охват закрывают другие площадки", "neutral"],
          ["Низкий приоритет в текущем миксе", "neutral"],
        ],
        telegram: [
          ["Ограниченная доля из-за стоимости и ёмкости", "neutral"],
          ["Не основной драйвер охвата в этом миксе", "neutral"],
        ],
      },
      traffic: {
        media: [
          ["Инструмент прогрева, а не прямого трафика", "negative"],
          ["Ниже CTR по сравнению с поиском и соцсетями", "negative"],
          ["Минимальная доля — только для верхней воронки", "neutral"],
        ],
        vk: [
          ["Добор кликов, не основной канал", "neutral"],
          ["CTR ниже, чем у поискового трафика", "negative"],
        ],
        telegram: [
          ["Добор кликов из мессенджера", "neutral"],
          ["Не заменяет поисковый спрос", "negative"],
        ],
        direct: [
          ["Слишком мала доля для основного драйвера трафика", "negative"],
          ["Поисковый спрос недоиспользован в миксе", "negative"],
        ],
      },
    };

    parts.forEach(({ estimate, share }) => {
      const id = estimate.id;
      const tier = tierFor(id, share);
      const pool = (tier === "primary" ? primaryReasons : tier === "support" ? supportReasons : limitedReasons)[goal]?.[id] || [];

      // Сначала факты по миксу (те же CPM/CPC/охват, что на карточке), потом шаблон.
      const factual = [];
      if (parts.length > 1) {
        if (goal === "reach" && id === minCpmId && Number.isFinite(costRows.find((r) => r.id === id)?.cpm)) {
          factual.push(["Самый низкий CPM среди выбранных инструментов", "positive"]);
        }
        if (goal === "reach" && id === maxCpmId && tier === "limited") {
          factual.push(["Самый высокий CPM в миксе", "negative"]);
        }
        if (goal === "reach" && estimate.reach.typical === maxReach && tier === "primary") {
          factual.push(["Лидер по охвату в рекомендуемом миксе", "positive"]);
        }
        if (goal === "traffic" && id === maxCtrId && tier === "primary") {
          factual.push(["Самый высокий CTR в миксе", "positive"]);
        }
        if (goal === "traffic" && id === minCpcId && tier === "primary") {
          factual.push(["Самый низкий CPC среди каналов", "positive"]);
        }
        if (goal === "traffic" && id === minCtrId && tier === "limited") {
          factual.push(["Самый низкий CTR — не основной канал для кликов", "negative"]);
        }
      }
      for (const [text, tone] of factual) {
        add(id, text, tone);
        if (reasons[id].length >= 2) break;
      }

      for (const [text, tone] of pool) {
        if (reasons[id].length >= 2) break;
        add(id, text, tone);
      }

      if (reasons[id].length < 2) {
        const qReason = qualityReasonFor(id);
        if (qReason) add(id, qReason[0], qReason[1]);
      }

      while (reasons[id].length < 2) {
        const qReason = qualityReasonFor(id);
        if (qReason && !reasons[id].some((r) => r.text === qReason[0])) {
          add(id, qReason[0], qReason[1]);
          continue;
        }
        add(id, tier === "limited" ? "Снижена доля в пользу более эффективных каналов" : "Эффективен в рамках выбранной цели", tier === "limited" ? "neutral" : "positive");
      }
      reasons[id] = reasons[id].slice(0, 2);
    });

    return reasons;
  }

  function estimateMixCustom(goal, geoId, budget, excludeIds, budgetShift, customShares) {
    const totalBudget = Math.max(0, Number(budget) || 0);
    const excluding = Boolean(excludeIds?.length);
    const useSmart = !excluding && !budgetShift && !customShares;
    const baseRules = useSmart
      ? resolveRecommendedShares(goal, geoId, totalBudget).shares
      : normalizedMixRules(goal);

    let partsConfig = activePlatforms()
      .filter((id) => !excludeIds || !excludeIds.includes(id))
      .map((id) => ({
        id,
        share: customShares && Number.isFinite(customShares[id])
          ? customShares[id]
          : baseRules[id] || 0,
      }));

    // При удалении канала доли остальных НЕ раздуваем до 100% —
    // бюджет убранного канала просто выходит из микса.
    // Ренормализация нужна только когда пересчитываем тот же тотал
    // (рост бюджета / перенос между каналами / кастомный сплит).
    if (!excluding || customShares) {
      const shareSum = partsConfig.reduce((s, p) => s + p.share, 0);
      if (shareSum > 0) {
        partsConfig = partsConfig.map((p) => ({ ...p, share: p.share / shareSum }));
      } else if (partsConfig.length) {
        partsConfig = partsConfig.map((p) => ({ ...p, share: 1 / partsConfig.length }));
      }
    }

    if (budgetShift && partsConfig.length >= 2) {
      const fromIdx = partsConfig.findIndex((p) => p.id === budgetShift.from);
      const toIdx = partsConfig.findIndex((p) => p.id === budgetShift.to);
      if (fromIdx >= 0 && toIdx >= 0) {
        const maxShift = partsConfig[fromIdx].share * totalBudget;
        const amount = Math.min(Math.max(0, budgetShift.amount), maxShift);
        const shiftShare = totalBudget > 0 ? amount / totalBudget : 0;
        partsConfig[fromIdx] = {
          ...partsConfig[fromIdx],
          share: Math.max(0, partsConfig[fromIdx].share - shiftShare),
        };
        partsConfig[toIdx] = {
          ...partsConfig[toIdx],
          share: partsConfig[toIdx].share + shiftShare,
        };
      }
    }

    const parts = partsConfig.map(({ id, share }) => {
      const partBudget = totalBudget * share;
      const estimate = estimatePlatform(id, geoId, partBudget, goal);
      return { share, partBudget, estimate };
    });

    const totals = {
      clicks: { min: 0, typical: 0, max: 0 },
      reach: { min: 0, typical: 0, max: 0 },
      impressions: { min: 0, typical: 0, max: 0 },
      budget: totalBudget,
    };

    for (const part of parts) {
      for (const key of ["min", "typical", "max"]) {
        totals.clicks[key] += part.estimate.clicks?.[key] || 0;
        totals.reach[key] += part.estimate.reach?.[key] || 0;
        totals.impressions[key] += part.estimate.impressions?.[key] || 0;
      }
    }

    const spentBudget = parts.reduce((s, p) => s + p.partBudget, 0);
    const efficiency = {};
    for (const key of ["min", "typical", "max"]) {
      const clicks = totals.clicks[key];
      const imps = totals.impressions[key];
      efficiency[key] = {
        cpc: clicks > 0 ? spentBudget / clicks : null,
        cpm: imps > 0 ? spentBudget / (imps / 1000) : null,
      };
    }

    return { parts, totals, rules: {}, efficiency, totalBudget: spentBudget };
  }

  function buildMixScenarioPool(mix, mixOverlap) {
    const { audience } = resolveAudience();
    const corrFactor = resolveCorrelationFactor();
    const baseReach = mixOverlap.totalUnique;
    const baseClicks = mix.totals.clicks.typical;
    const baseBudget = mix.totalBudget;
    const baseCpm = mix.efficiency.typical.cpm || 0;
    const baseCpc = mix.efficiency.typical.cpc || 0;
    const baseOverlapPct = mixOverlap.overlapPercentage / 100;

    const shortAcc = (id) => platformShort(id, "acc");
    const shortFrom = (id) => platformShort(id, "gen");
    const shortTo = (id) => platformShort(id, "into");

    const formatDelta = (val) => {
      const sign = val >= 0 ? "+" : "−";
      return `${sign}${formatCompact(Math.abs(val))}`;
    };

    const evalMix = (nextMix) => {
      const overlap = calculateAudienceOverlap(
        audience,
        nextMix.parts.map(({ estimate }) => ({ id: estimate.id, reach: estimate.reach.typical })),
        { correlationFactor: corrFactor }
      );
      const dReach = overlap.totalUnique - baseReach;
      const dClicks = nextMix.totals.clicks.typical - baseClicks;
      const nextCpm = nextMix.efficiency.typical.cpm || 0;
      const nextCpc = nextMix.efficiency.typical.cpc || 0;
      const dCpmPct = baseCpm > 0 ? Math.round(((nextCpm - baseCpm) / baseCpm) * 100) : 0;
      const dCpc = nextCpc - baseCpc;
      const dOverlapPp = (overlap.overlapPercentage / 100 - baseOverlapPct) * 100;
      return { dReach, dClicks, dCpmPct, dCpc, dOverlapPp };
    };

    const pool = [];
    const seen = new Set();
    const push = (sc) => {
      if (!sc?.title || seen.has(sc.title)) return;
      seen.add(sc.title);
      pool.push(sc);
    };

    const addBudgetScale = (factor, title, badge) => {
      const next = estimateMixCustom(state.goal, state.geo, baseBudget * factor, null, null);
      const e = evalMix(next);
      push({
        title,
        budgetDelta: badge,
        budgetDeltaTone: factor >= 1 ? "positive" : "negative",
        budgetDeltaKind: "badge",
        metrics: [
          { label: "Охват", value: formatDelta(e.dReach), tone: e.dReach >= 0 ? "positive" : "negative" },
          { label: "Клики", value: formatDelta(e.dClicks), tone: e.dClicks >= 0 ? "positive" : "negative" },
        ],
      });
    };

    addBudgetScale(1.5, "Увеличить бюджет ×1,5", "+50% ₽");
    addBudgetScale(2, "Увеличить бюджет ×2", "×2 ₽");
    addBudgetScale(3, "Увеличить бюджет ×3", "×3 ₽");
    addBudgetScale(0.75, "Снизить бюджет на 25%", "−25% ₽");
    addBudgetScale(0.5, "Срезать бюджет вдвое", "−50% ₽");

    // Убрать каждый канал по отдельности
    if (mix.parts.length > 1) {
      for (const part of mix.parts) {
        const id = part.estimate.id;
        const next = estimateMixCustom(state.goal, state.geo, baseBudget, [id], null);
        const e = evalMix(next);
        const isMinShare = part === mix.parts.reduce((a, b) => (a.share < b.share ? a : b));
        push({
          title: `Убрать ${shortAcc(id)}`,
          budgetDelta: `−${formatMoney(part.partBudget)}`,
          budgetDeltaTone: "negative",
          budgetDeltaKind: "badge",
          metrics: isMinShare
            ? [
                { label: "Охват", value: formatDelta(e.dReach), tone: e.dReach >= 0 ? "positive" : "negative" },
                { label: "Пересечение", value: `${e.dOverlapPp >= 0 ? "+" : "−"}${Math.abs(e.dOverlapPp).toFixed(1).replace(".", ",")} п.п.`, tone: e.dOverlapPp <= 0 ? "positive" : "negative" },
              ]
            : [
                { label: "Охват", value: formatDelta(e.dReach), tone: e.dReach >= 0 ? "positive" : "negative" },
                { label: "CPM микса", value: `${e.dCpmPct >= 0 ? "+" : "−"}${Math.abs(e.dCpmPct)}%`, tone: e.dCpmPct <= 0 ? "positive" : "negative" },
              ],
        });
      }
    }

    // Убрать два самых маленьких канала
    if (mix.parts.length >= 4) {
      const smallest = [...mix.parts].sort((a, b) => a.share - b.share).slice(0, 2);
      const ids = smallest.map((p) => p.estimate.id);
      const cutBudget = smallest.reduce((s, p) => s + p.partBudget, 0);
      const next = estimateMixCustom(state.goal, state.geo, baseBudget, ids, null);
      const e = evalMix(next);
      push({
        title: `Убрать ${shortAcc(ids[0])} и ${shortAcc(ids[1])}`,
        budgetDelta: `−${formatMoney(cutBudget)}`,
        budgetDeltaTone: "negative",
        budgetDeltaKind: "badge",
        metrics: [
          { label: "Охват", value: formatDelta(e.dReach), tone: e.dReach >= 0 ? "positive" : "negative" },
          { label: "Клики", value: formatDelta(e.dClicks), tone: e.dClicks >= 0 ? "positive" : "negative" },
        ],
      });
    }

    // Переносы 50% / 30% между парами
    const byShare = [...mix.parts].sort((a, b) => b.share - a.share);
    const shiftPairs = [];
    if (byShare.length >= 2) {
      const top = byShare[0];
      for (let i = 1; i < byShare.length; i += 1) {
        shiftPairs.push([top, byShare[i], 0.5]);
        shiftPairs.push([byShare[i], top, 0.5]);
      }
      if (byShare.length >= 3) {
        shiftPairs.push([byShare[1], byShare[2], 0.5]);
        shiftPairs.push([byShare[2], byShare[1], 0.3]);
        shiftPairs.push([top, byShare[byShare.length - 1], 0.3]);
      }
    }

    for (const [fromPart, toPart, frac] of shiftPairs) {
      if (fromPart.estimate.id === toPart.estimate.id) continue;
      const shift = Math.floor(fromPart.partBudget * frac);
      if (shift < 1000) continue;
      const pctLabel = Math.round(frac * 100);
      const next = estimateMixCustom(state.goal, state.geo, baseBudget, null, {
        from: fromPart.estimate.id,
        to: toPart.estimate.id,
        amount: shift,
      });
      const e = evalMix(next);
      push({
        title: `Перенести ${pctLabel}% бюджета из ${shortFrom(fromPart.estimate.id)} в ${shortTo(toPart.estimate.id)}`,
        budgetDelta: "",
        budgetDeltaTone: "neutral",
        budgetDeltaKind: "swap",
        focusPlatform: toPart.estimate.id,
        metrics: [
          { label: "Охват", value: formatDelta(e.dReach), tone: e.dReach >= 0 ? "positive" : "negative" },
          { label: "CPC", value: `${e.dCpc >= 0 ? "+" : "−"}${formatNumber(Math.round(Math.abs(e.dCpc)))} ₽`, tone: e.dCpc <= 0 ? "positive" : "negative" },
        ],
      });
    }

    // Равный сплит
    if (mix.parts.length >= 2) {
      const ids = mix.parts.map((p) => p.estimate.id);
      const equal = Object.fromEntries(ids.map((id) => [id, 1 / ids.length]));
      const next = estimateMixCustom(state.goal, state.geo, baseBudget, null, null, equal);
      const e = evalMix(next);
      push({
        title: "Выровнять доли поровну",
        budgetDelta: "1/n",
        budgetDeltaTone: "neutral",
        budgetDeltaKind: "badge",
        metrics: [
          { label: "Охват", value: formatDelta(e.dReach), tone: e.dReach >= 0 ? "positive" : "negative" },
          { label: "Клики", value: formatDelta(e.dClicks), tone: e.dClicks >= 0 ? "positive" : "negative" },
        ],
      });
    }

    // Всё в один сильнейший канал под цель
    if (mix.parts.length >= 2) {
      const best = [...mix.parts].sort((a, b) => {
        const metric = state.goal === "traffic" ? "clicks" : "reach";
        return (b.estimate[metric]?.typical || 0) - (a.estimate[metric]?.typical || 0);
      })[0];
      const shares = Object.fromEntries(
        mix.parts.map((p) => [p.estimate.id, p.estimate.id === best.estimate.id ? 1 : 0])
      );
      const next = estimateMixCustom(state.goal, state.geo, baseBudget, null, null, shares);
      const e = evalMix(next);
      push({
        title: `Всё в ${shortTo(best.estimate.id)}`,
        budgetDelta: "100%",
        budgetDeltaTone: "neutral",
        budgetDeltaKind: "badge",
        focusPlatform: best.estimate.id,
        metrics: [
          { label: "Охват", value: formatDelta(e.dReach), tone: e.dReach >= 0 ? "positive" : "negative" },
          { label: "Клики", value: formatDelta(e.dClicks), tone: e.dClicks >= 0 ? "positive" : "negative" },
        ],
      });
    }

    // Усилить топ-канал: +50% к его доле за счёт остальных
    if (mix.parts.length >= 2) {
      const top = byShare[0];
      const boost = Math.min(0.5, 1 - top.share);
      if (boost > 0.05) {
        const rest = byShare.slice(1);
        const restSum = rest.reduce((s, p) => s + p.share, 0) || 1;
        const shares = { [top.estimate.id]: top.share + boost };
        for (const p of rest) {
          shares[p.estimate.id] = Math.max(0, p.share - (boost * p.share) / restSum);
        }
        const next = estimateMixCustom(state.goal, state.geo, baseBudget, null, null, shares);
        const e = evalMix(next);
        push({
          title: `Усилить ${shortTo(top.estimate.id)} (+${Math.round(boost * 100)} п.п.)`,
          budgetDelta: `+${Math.round(boost * 100)}%`,
          budgetDeltaTone: "positive",
          budgetDeltaKind: "badge",
          focusPlatform: top.estimate.id,
          metrics: [
            { label: "Охват", value: formatDelta(e.dReach), tone: e.dReach >= 0 ? "positive" : "negative" },
            { label: "CPM микса", value: `${e.dCpmPct >= 0 ? "+" : "−"}${Math.abs(e.dCpmPct)}%`, tone: e.dCpmPct <= 0 ? "positive" : "negative" },
          ],
        });
      }
    }

    // Бюджет ×2 без самого дорогого по CPM канала
    if (mix.parts.length > 2) {
      const cpmRanked = mix.parts.map((part) => {
        const bench = resolveGeoBench(part.estimate.id, state.geo);
        const { cpm } = resolveCostPair(part.estimate, part.partBudget, bench);
        return { id: part.estimate.id, label: part.estimate.label, cpm: cpm?.typical ?? 0, share: part.share };
      }).sort((a, b) => b.cpm - a.cpm);
      const costly = cpmRanked[0];
      const remain = cpmRanked.filter((p) => p.id !== costly.id);
      const remainSum = remain.reduce((s, p) => s + p.share, 0) || 1;
      const shares = Object.fromEntries(remain.map((p) => [p.id, p.share / remainSum]));
      const next = estimateMixCustom(state.goal, state.geo, baseBudget * 2, [costly.id], null, shares);
      const e = evalMix(next);
      push({
        title: `×2 бюджета без ${shortAcc(costly.id)}`,
        budgetDelta: "×2 ₽",
        budgetDeltaTone: "positive",
        budgetDeltaKind: "badge",
        metrics: [
          { label: "Охват", value: formatDelta(e.dReach), tone: e.dReach >= 0 ? "positive" : "negative" },
          { label: "Клики", value: formatDelta(e.dClicks), tone: e.dClicks >= 0 ? "positive" : "negative" },
        ],
      });
    }

    return pool;
  }

  function trafficScenarioPriority(sc) {
    if (state.goal !== "traffic") return 0;
    if (sc?.focusPlatform === "direct") return 3;
    if (typeof sc?.title === "string" && sc.title.includes("Поиск")) return 2;
    return 0;
  }

  function shuffleScenarioPool(pool) {
    const weighted = [...pool].map((sc) => {
      const w = 1 + trafficScenarioPriority(sc) * 2;
      return { sc, w };
    });
    const out = [];
    while (weighted.length) {
      const totalW = weighted.reduce((sum, row) => sum + row.w, 0);
      let roll = Math.random() * totalW;
      let pick = weighted.length - 1;
      for (let i = 0; i < weighted.length; i += 1) {
        roll -= weighted[i].w;
        if (roll <= 0) {
          pick = i;
          break;
        }
      }
      out.push(weighted[pick].sc);
      weighted.splice(pick, 1);
    }
    return out;
  }

  function scenarioCardsHtml(scenarios) {
    const swapIcon = `<svg class="mix2-swap-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10h13l-3-3"/><path d="M17 14H4l3 3"/></svg>`;
    return scenarios.map((sc) => {
      const badge = sc.budgetDeltaKind === "swap"
        ? `<span class="mix2-scenario-badge mix2-scenario-badge-swap" title="перераспределение">${swapIcon}</span>`
        : `<span class="mix2-scenario-badge mix2-scenario-badge-${sc.budgetDeltaTone}">${sc.budgetDelta}</span>`;
      return `
      <div class="mix2-scenario-card">
        <div class="mix2-scenario-head">
          <span class="mix2-scenario-title">${sc.title}</span>
          ${badge}
        </div>
        <div class="mix2-scenario-metrics">
          ${sc.metrics.map((m) => `
            <div class="mix2-scenario-metric">
              <span class="mix2-metric-lbl">${m.label}</span>
              <strong class="mix2-metric-val mix2-tone-${m.tone}">${m.value}</strong>
            </div>`).join("")}
        </div>
      </div>`;
    }).join("");
  }

  function bindMixScenarioDice() {
    const btn = document.getElementById("mixScenarioDice");
    const row = document.getElementById("mixScenariosRow");
    if (!btn || !row || !state.mixScenarioPool?.length) return;

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.classList.add("is-rolling");
      row.classList.add("is-reshuffling");

      window.setTimeout(() => {
        const prevTitles = new Set(
          [...row.querySelectorAll(".mix2-scenario-title")].map((el) => el.textContent.trim())
        );
        let nextPool = shuffleScenarioPool(state.mixScenarioPool);
        // Стараемся показать другой набор, если в пуле хватает карточек
        if (nextPool.length > 4) {
          for (let attempt = 0; attempt < 8; attempt += 1) {
            const batchTitles = nextPool.slice(0, 4).map((s) => s.title);
            const overlap = batchTitles.filter((t) => prevTitles.has(t)).length;
            if (overlap < 3) break;
            nextPool = shuffleScenarioPool(state.mixScenarioPool);
          }
        }
        state.mixScenarioPool = nextPool;
        const batch = state.mixScenarioPool.slice(0, Math.min(4, state.mixScenarioPool.length));
        row.innerHTML = scenarioCardsHtml(batch);
        row.classList.remove("is-reshuffling");
        row.classList.add("is-reshuffled");
        btn.classList.remove("is-rolling");
        btn.disabled = false;
        window.setTimeout(() => row.classList.remove("is-reshuffled"), 420);
      }, 220);
    });
  }

  function renderMix() {
    const mix = estimateMix(state.goal, state.geo, workingBudget());
    const goalLabel = state.goal === "traffic" ? "трафик" : "охват";
    const splitHint = hasPlatformOverrides()
      ? "микс по включённым"
      : mix.sharesAdjusted
        ? "динамический сплит по ёмкости"
        : mix.parts.length === 1
          ? "один канал при текущем бюджете"
          : "сплит по цели";
    els.mixSub.textContent = `- под цель «${goalLabel}» · ${currentPeriod().label.toLowerCase()} · тотал ${formatMoney(workingBudget())} · ${splitHint}`;

    const mixBody = document.getElementById("mixBody");
    if (!mixBody) return;

    if (!mix.parts.length) {
      mixBody.innerHTML = `<p class="empty-hint">Включите хотя бы одну площадку во вводных.</p>`;
      return;
    }

    const { audience } = resolveAudience();
    const mixOverlap = calculateAudienceOverlap(
      audience,
      mix.parts.map(({ estimate }) => ({ id: estimate.id, reach: estimate.reach.typical })),
      { correlationFactor: resolveCorrelationFactor() }
    );

    const reasons = mixWhyReasons(mix.parts, state.goal);
    const sortedParts = [...mix.parts].sort((a, b) => b.share - a.share);

    const escapeAttr = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");

    // ── Left column: budget distribution ──
    const budgetRows = sortedParts.map(({ share, partBudget, estimate }) => {
      const pct = Math.round(share * 100);
      const baseShare = mix.baseRules?.[estimate.id];
      const basePct = Number.isFinite(baseShare) ? Math.round(baseShare * 100) : null;
      const tip =
        mix.shareTips?.[estimate.id] ||
        (basePct != null && basePct !== pct
          ? `Было ${basePct}%. Скорректировано под ёмкость каналов`
          : "");
      const rankMatch = tip.match(/^(\d+)-й/);
      const tipLabel = tip.startsWith("Было 100%")
        ? "было 100%"
        : rankMatch
          ? `${rankMatch[1]}-й`
          : tip.startsWith("Подключён")
            ? "очередь"
            : basePct != null && basePct !== pct
              ? `было ${basePct}%`
              : tip
                ? "почему"
                : "";
      const deltaHint = tip
        ? `<span class="mix2-pct-base" tabindex="0" data-tip="${escapeAttr(tip)}">${tipLabel}</span>`
        : "";
      const role = mixRoleLabel(estimate.id, state.goal);
      return `
        <div class="mix2-budget-row" data-platform="${estimate.id}">
          <div class="mix2-budget-row-left">
            <span class="dot ${estimate.id}" style="width:0.85rem;height:0.85rem;flex-shrink:0"></span>
            <div>
              <span class="mix2-plat-name">${estimate.label}</span>
              ${role ? `<span class="mix2-plat-role">${role}</span>` : ""}
            </div>
          </div>
          <div class="mix2-budget-row-right">
            <span class="mix2-pct-wrap">
              <span class="mix2-pct">${pct}%</span>
              ${deltaHint}
            </span>
            <div class="mix2-bar-wrap">
              <div class="mix2-bar-fill" data-platform="${estimate.id}" style="width:${pct}%"></div>
            </div>
            <span class="mix2-amount">${formatMoney(partBudget)}</span>
          </div>
        </div>`;
    }).join("");

    // Summary totals row
    const eff = mix.efficiency.typical;
    const uniqueReach = mixOverlap.totalUnique;
    const totalClicks = mix.totals.clicks.typical;
    const avgCpm = Number.isFinite(eff.cpm) ? formatMoney(eff.cpm) : "—";
    const avgCpc = Number.isFinite(eff.cpc) ? formatMoney(eff.cpc) : "—";

    /** Кросс-частота: показы микса / уникальный охват (ориентир + разброс min–max). */
    const crossFreqAt = (imps) =>
      uniqueReach > 0 && Number.isFinite(imps) && imps > 0 ? imps / uniqueReach : null;
    const crossFreqTypical = crossFreqAt(mix.totals.impressions.typical);
    const crossFreqMin = crossFreqAt(mix.totals.impressions.min);
    const crossFreqMax = crossFreqAt(mix.totals.impressions.max);
    const freqLabel = mix.parts.length === 1 ? "Частота контакта" : "Кросс-частота";
    let crossFreqRangeText = "—";
    if (Number.isFinite(crossFreqMin) && Number.isFinite(crossFreqMax)) {
      const lo = Math.min(crossFreqMin, crossFreqMax);
      const hi = Math.max(crossFreqMin, crossFreqMax);
      crossFreqRangeText =
        Math.abs(hi - lo) < 0.05
          ? `≈${formatNumber(lo, 1)}`
          : `≈${formatNumber(lo, 1)} – ${formatNumber(hi, 1)}`;
    }
    const crossFreqHtml =
      state.goal === "reach" && Number.isFinite(crossFreqTypical)
        ? `<div class="mix2-cross-freq" title="Ориентир: сумма показов микса ÷ уникальный охват. Частота в данных — допущение модели, не прогноз кабинета.">
            <div class="mix2-cross-freq-main">
              <span class="mix2-cross-freq-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.15"/><circle cx="12" cy="12" r="5.1" opacity=".85"/><circle cx="12" cy="12" r="8.05" opacity=".55"/></g></svg>
              </span>
              <div>
                <span class="mix2-cross-freq-label">${freqLabel}</span>
                <strong class="mix2-cross-freq-val">≈${formatNumber(crossFreqTypical, 1)}</strong>
                <span class="mix2-cross-freq-sub">контакт на пользователя</span>
              </div>
            </div>
            <div class="mix2-cross-freq-range">
              <span class="mix2-cross-freq-label">разброс прогноза</span>
              <strong class="mix2-cross-freq-range-val">${crossFreqRangeText}</strong>
              <span class="mix2-cross-freq-sub">при разных настройках кампаний</span>
            </div>
          </div>`
        : "";

    const totalsHtml = `
      <div class="mix2-totals-row">
        <div class="mix2-total-item">
          <span class="mix2-total-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="9" cy="12" r="5.5" stroke="currentColor" stroke-width="1.7"/><circle cx="15" cy="12" r="5.5" stroke="currentColor" stroke-width="1.7"/></svg>
          </span>
          <div>
            <span class="mix2-total-label">уникальный охват</span>
            <strong class="mix2-total-val">≈${formatCompact(uniqueReach)}</strong>
          </div>
        </div>
        <div class="mix2-total-item">
          <span class="mix2-total-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="3.4" y="6.6" width="17.2" height="11.8" rx="2.6" stroke="currentColor" stroke-width="1.7"/><path d="M3.4 10.2h17.2" stroke="currentColor" stroke-width="1.7"/><circle cx="16.55" cy="14.55" r="1.2" fill="currentColor"/></svg>
          </span>
          <div>
            <span class="mix2-total-label">средний<br>CPM</span>
            <strong class="mix2-total-val">${avgCpm}</strong>
          </div>
        </div>
        <div class="mix2-total-item">
          <span class="mix2-total-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M6 3.5v14.2l3.55-3.35 2.35 5.55 2.35-.95-2.4-5.55H18.6L6 3.5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          </span>
          <div>
            <span class="mix2-total-label">сумма<br>кликов</span>
            <strong class="mix2-total-val">${formatCompact(totalClicks)}</strong>
          </div>
        </div>
        <div class="mix2-total-item">
          <span class="mix2-total-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.7"/><path d="M9.4 9.6c.55-.85 1.45-1.35 2.55-1.35 1.55 0 2.7 1 2.7 2.4 0 1.15-.7 1.9-1.85 2.35l-.95.35v1.55" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="17.2" r=".9" fill="currentColor"/></svg>
          </span>
          <div>
            <span class="mix2-total-label">средний<br>CPC</span>
            <strong class="mix2-total-val">${avgCpc}</strong>
          </div>
        </div>
      </div>`;

    // ── Right column: why this mix ──
    const whyCards = sortedParts.map(({ share, partBudget, estimate }) => {
      const pct = Math.round(share * 100);
      const bench = resolveGeoBench(estimate.id, state.geo);
      const { cpc, cpm } = resolveCostPair(estimate, partBudget, bench);
      const reasonsList = (reasons[estimate.id] || []).slice(0, 2);
      const reasonIcon = (tone) => {
        if (tone === "negative") return '<span class="mix2-reason-icon mix2-reason-negative" aria-hidden="true">−</span>';
        if (tone === "neutral") return '<span class="mix2-reason-icon mix2-reason-neutral" aria-hidden="true">→</span>';
        return '<span class="mix2-reason-icon mix2-reason-positive" aria-hidden="true">✓</span>';
      };
      const isTraffic = state.goal === "traffic";
      const primaryMetricLabel = isTraffic ? "CPC" : "CPM";
      const primaryMetricVal = isTraffic
        ? (cpc?.typical != null ? formatMoney(cpc.typical) : "—")
        : (cpm?.typical != null ? formatMoney(cpm.typical) : "—");
      const secondaryLabel = isTraffic ? "Клики" : "Охват";
      const secondaryVal = isTraffic
        ? formatCompact(estimate.clicks.typical)
        : formatCompact(estimate.reach.typical);
      const channelFreq =
        !isTraffic &&
        estimate.impressions?.typical > 0 &&
        estimate.reach?.typical > 0
          ? estimate.impressions.typical / estimate.reach.typical
          : null;
      const freqMetricHtml =
        !isTraffic && Number.isFinite(channelFreq)
          ? `<div>
              <span class="mix2-metric-lbl">Частота</span>
              <strong class="mix2-metric-val">≈${formatNumber(channelFreq, 1)}</strong>
            </div>`
          : "";

      const logoSrc = {
        direct: "./assets/logo-direct.png",
        media: "./assets/logo-media.png",
        vk: "./assets/logo-vk.png",
        telegram: "./assets/logo-tg.webp",
        avito: "./assets/logo-avito.jpg",
      }[estimate.id] || "";

      return `
        <div class="mix2-why-card" data-platform="${estimate.id}">
          <div class="mix2-why-logo-wrap">
            <img src="${logoSrc}" alt="${estimate.label}" class="mix2-why-logo" width="52" height="52" />
          </div>
          <div class="mix2-why-body">
            <div class="mix2-why-head">
              <span class="mix2-why-name">${estimate.label}</span>
              <span class="mix2-why-badge" data-platform="${estimate.id}">${pct}% бюджета</span>
            </div>
            <ul class="mix2-why-reasons">
              ${reasonsList.map((r) => `<li>${reasonIcon(r.tone)}${r.text}</li>`).join("")}
            </ul>
          </div>
          <div class="mix2-why-metrics">
            <div>
              <span class="mix2-metric-lbl">${primaryMetricLabel}</span>
              <strong class="mix2-metric-val">${primaryMetricVal}</strong>
            </div>
            <div>
              <span class="mix2-metric-lbl">${secondaryLabel}</span>
              <strong class="mix2-metric-val">${secondaryVal}</strong>
            </div>
            ${freqMetricHtml}
          </div>
        </div>`;
    }).join("");

    // ── Scenarios ──
    state.mixScenarioPool = shuffleScenarioPool(buildMixScenarioPool(mix, mixOverlap));
    const visibleScenarios = state.mixScenarioPool.slice(0, Math.min(4, state.mixScenarioPool.length));
    const scenarioCards = scenarioCardsHtml(visibleScenarios);
    const diceDisabled = state.mixScenarioPool.length <= 4;

    // ── Conclusion ──
    const recText = buildConclusionText(mix.parts, state.goal);
    const conclusionHtml = recText ? `
      <div class="mix2-conclusion">
        <div class="mix2-conclusion-head">
          <span class="mix2-conclusion-sparkles" aria-hidden="true">✦✦</span>
          <strong class="mix2-conclusion-title">Вывод</strong>
        </div>
        <p class="mix2-conclusion-text">${recText}</p>
      </div>` : "";

    const whyTitle = mix.parts.length === 1 ? "Почему этот канал?" : "Почему именно такой микс?";
    const scenariosTitle =
      mix.parts.length === 1 ? "Что если изменить бюджет?" : "Что если изменить микс?";

    mixBody.innerHTML = `
      <div class="mix2-main-cols">
        <div class="mix2-budget-col">
          <div class="mix2-budget-head">
            <p class="mix2-col-title">Распределение бюджета</p>
            <div class="mix2-budget-head-labels">
              <span class="mix2-col-head-label">Доля бюджета</span>
              <span class="mix2-col-head-label mix2-col-head-sum">Сумма</span>
            </div>
          </div>
          <div class="mix2-budget-rows">${budgetRows}</div>
          ${crossFreqHtml}
          ${totalsHtml}
        </div>
        <div class="mix2-why-col">
          <p class="mix2-col-title">${whyTitle}</p>
          <div class="mix2-why-cards">${whyCards}</div>
        </div>
      </div>
      <div class="mix2-scenarios">
        <div class="mix2-scenarios-head">
          <p class="mix2-scenarios-title">${scenariosTitle}</p>
          <button
            type="button"
            class="mix2-scenario-dice"
            id="mixScenarioDice"
            aria-label="Показать другие сценарии"
            title="Другие сценарии"
            ${diceDisabled ? "disabled" : ""}
          >🎲</button>
        </div>
        <div class="mix2-scenarios-row" id="mixScenariosRow">${scenarioCards}</div>
        ${conclusionHtml}
      </div>
    `;

    bindMixScenarioDice();
  }

  /** User-facing seasonality source; strips technical API method paths from stored strings. */
  function seasonalitySourceLabel(raw) {
    const s = String(raw || "").trim();
    if (!s) return "Yandex Wordstat · РФ";
    if (/wordstat/i.test(s) || /\/dynamics/i.test(s) || /PERIOD_MONTHLY/i.test(s)) {
      return "Yandex Wordstat · РФ";
    }
    return s;
  }

  const SEASON_MONTH_FULL = [
    "",
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь",
  ];
  const SEASON_MONTH_TITLE = [
    "",
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];
  const SEASON_MONTH_GENITIVE = [
    "",
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  const SEASON_MONTH_PREP = [
    "",
    "январе",
    "феврале",
    "марте",
    "апреле",
    "мае",
    "июне",
    "июле",
    "августе",
    "сентябре",
    "октябре",
    "ноябре",
    "декабре",
  ];

  function seasonMonthNum(m) {
    const n = Number(m?.month);
    if (n >= 1 && n <= 12) return n;
    const idx = SEASON_MONTH_FULL.findIndex(
      (name, i) => i > 0 && (m?.label || "").toLowerCase().startsWith(name.slice(0, 3))
    );
    return idx > 0 ? idx : 0;
  }

  function seasonMonthTitle(m) {
    const n = seasonMonthNum(m);
    return n ? SEASON_MONTH_TITLE[n] : m?.label || "";
  }

  function seasonMonthShort(m) {
    return m?.label || (seasonMonthNum(m) ? SEASON_MONTH_TITLE[seasonMonthNum(m)].slice(0, 3) : "");
  }

  function escapeSeasonHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveSeasonalitySlice() {
    const root = state.data?.seasonality;
    if (!root) return null;
    if (state.industry && root.by_industry?.[state.industry]) {
      return root.by_industry[state.industry];
    }
    if (!state.industry && root.market) return root.market;
    // fallback: industry-local copy
    const local = currentIndustry()?.seasonality;
    if (local?.months?.length) {
      return {
        label: currentIndustry()?.label || state.industry,
        ...local,
      };
    }
    return null;
  }

  function seasonExtremes(months) {
    let peakVal = -Infinity;
    let troughVal = Infinity;
    for (const m of months) {
      const a = Number(m.affinity) || 0;
      if (a > peakVal) peakVal = a;
      if (a < troughVal) troughVal = a;
    }
    const peaks = months.filter((m) => (Number(m.affinity) || 0) === peakVal);
    const troughs = months.filter((m) => (Number(m.affinity) || 0) === troughVal);
    return { peaks, troughs, peakVal, troughVal };
  }

  function pickHighSeasonMonths(months) {
    const affinities = months.map((m) => Number(m.affinity) || 0);
    const peak = Math.max(...affinities, 0);
    let threshold = 110;
    let selected = months.filter((m) => (Number(m.affinity) || 0) >= threshold);
    if (!selected.length) {
      threshold = 100;
      selected = months.filter((m) => (Number(m.affinity) || 0) >= threshold);
    }
    if (selected.length >= 6) {
      threshold = Math.max(100, peak - 4);
      selected = months.filter((m) => (Number(m.affinity) || 0) >= threshold);
    }
    return { months: selected, threshold };
  }

  /** Chart markers: all clear peaks/troughs, not only absolute max/min. */
  function pickSeasonChartMarkers(months) {
    const n = months.length;
    if (!n) return { peaks: [], troughs: [] };
    const affinities = months.map((m) => Number(m.affinity) || 0);
    const peakVal = Math.max(...affinities);
    const troughVal = Math.min(...affinities);
    const highSet = new Set(pickHighSeasonMonths(months).months);
    const peakIdx = new Set();
    const troughIdx = new Set();

    for (let i = 0; i < n; i++) {
      const a = affinities[i];
      if (a === peakVal) peakIdx.add(i);
      if (a === troughVal) troughIdx.add(i);
      if (highSet.has(months[i])) peakIdx.add(i);

      const prev = affinities[(i - 1 + n) % n];
      const next = affinities[(i + 1) % n];
      if (a > prev && a > next && a > 100) peakIdx.add(i);
      if (a < prev && a < next && a < 100) troughIdx.add(i);
    }

    for (const i of peakIdx) troughIdx.delete(i);

    return {
      peaks: [...peakIdx].sort((a, b) => a - b).map((i) => months[i]),
      troughs: [...troughIdx].sort((a, b) => a - b).map((i) => months[i]),
    };
  }

  /**
   * Peaks worth targeting for launch timing: chart-marked highs that are also
   * high-season months or the absolute yearly max (drops weak local bumps).
   */
  function pickSignificantSeasonPeaks(months) {
    const { peaks: absolutePeaks } = seasonExtremes(months);
    if (!months?.length) return absolutePeaks;
    const highSet = new Set(pickHighSeasonMonths(months).months);
    const absSet = new Set(absolutePeaks);
    const filtered = pickSeasonChartMarkers(months).peaks.filter(
      (m) => highSet.has(m) || absSet.has(m)
    );
    return filtered.length ? filtered : absolutePeaks;
  }

  function formatSeasonRanges(months) {
    if (!months.length) return "—";
    const ordered = [...months].sort((a, b) => seasonMonthNum(a) - seasonMonthNum(b));
    const ranges = [];
    let start = ordered[0];
    let prev = ordered[0];
    const flush = () => {
      const a = seasonMonthShort(start);
      const b = seasonMonthShort(prev);
      ranges.push(a === b ? a : `${a}–${b}`);
    };
    for (let i = 1; i < ordered.length; i++) {
      const cur = ordered[i];
      if (seasonMonthNum(cur) === seasonMonthNum(prev) + 1) {
        prev = cur;
      } else {
        flush();
        start = cur;
        prev = cur;
      }
    }
    flush();
    return ranges.join(", ");
  }

  function resolveNextPeakDate(peakMonths, today = new Date()) {
    const nums = [
      ...new Set(peakMonths.map(seasonMonthNum).filter((n) => n >= 1 && n <= 12)),
    ];
    if (!nums.length) return null;
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const candidates = nums.map((month) => {
      let d = new Date(today.getFullYear(), month - 1, 1);
      if (d < startOfToday) d = new Date(today.getFullYear() + 1, month - 1, 1);
      return d;
    });
    candidates.sort((a, b) => a - b);
    return candidates[0];
  }

  function formatRuDayMonth(date) {
    if (!date) return "—";
    const day = date.getDate();
    const month = SEASON_MONTH_GENITIVE[date.getMonth() + 1];
    return `${day} ${month}`;
  }

  function daysBetween(from, to) {
    const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((b - a) / 86400000);
  }

  function ruDayWord(n) {
    const abs = Math.abs(Number(n) || 0);
    const n10 = abs % 10;
    const n100 = abs % 100;
    if (n10 === 1 && n100 !== 11) return "день";
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "дня";
    return "дней";
  }

  function formatAsOfLabel(asOf) {
    if (!asOf) return "";
    const s = String(asOf).trim();
    const m = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
    if (m) {
      const month = Number(m[2]);
      const title = SEASON_MONTH_TITLE[month];
      return title ? `${title} ${m[1]}` : s;
    }
    return s;
  }

  function smoothSeasonPath(points) {
    if (!points.length) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  /** Nice % step so Y labels don't overlap (~5–8 ticks for the plot height). */
  function seasonalityYTickStep(span, plotH) {
    const minLabelPx = 26;
    const maxTicks = Math.max(5, Math.min(8, Math.floor(plotH / minLabelPx) + 1));
    const rough = span / Math.max(maxTicks - 1, 1);
    if (!(rough > 0) || !Number.isFinite(rough)) return 5;
    const exp = Math.floor(Math.log10(rough));
    const mag = Math.pow(10, exp);
    const norm = rough / mag;
    // Prefer 1–2–5 × 10^n (always divides 100, so baseline stays on a tick)
    let niceNorm;
    if (norm <= 1.5) niceNorm = 1;
    else if (norm <= 3) niceNorm = 2;
    else if (norm <= 7) niceNorm = 5;
    else niceNorm = 10;
    return Math.max(1, niceNorm * mag);
  }

  function seasonalityChartSvg(months, peaks, troughs) {
    const affinities = months.map((m) => Number(m.affinity) || 0);
    if (!affinities.length) return "";
    const dataMin = Math.min(...affinities);
    const dataMax = Math.max(...affinities);
    const dataSpan = Math.max(dataMax - dataMin, 1);
    const pad = Math.max(4, dataSpan * 0.28);
    let yMin = Math.min(dataMin - pad, 100 - 8);
    let yMax = Math.max(dataMax + pad, 100 + 8);
    // Prefer mockup-like band when data sits near 100
    if (dataMax <= 115 && dataMin >= 80) {
      yMin = Math.min(yMin, 85);
      yMax = Math.max(yMax, 110);
    }
    const span = Math.max(yMax - yMin, 1);

    const w = 960;
    const h = 256; // ~20% shorter than previous 320
    const left = 48;
    const right = 20;
    const top = 36;
    const bottom = 36;
    const plotW = w - left - right;
    const plotH = h - top - bottom;
    const n = affinities.length;
    const xAt = (i) => left + (n === 1 ? plotW / 2 : (i / Math.max(n - 1, 1)) * plotW);
    const yAt = (a) => top + (1 - (a - yMin) / span) * plotH;
    const y100 = yAt(100);
    const gradOffset100 = Math.max(
      0,
      Math.min(100, ((y100 - top) / Math.max(plotH, 1)) * 100)
    );

    const points = affinities.map((a, i) => ({ x: xAt(i), y: yAt(a), a, i }));
    const linePath = smoothSeasonPath(points);
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(top + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(top + plotH).toFixed(1)} Z`;
    const uid = `seasonGrad-${Math.round(peakishId(affinities))}`;

    // Adaptive Y step: ~5–8 ticks max so labels stay readable at plotH (~184px)
    const tickStep = seasonalityYTickStep(span, plotH);
    const tickVals = [];
    const niceMin = Math.floor(yMin / tickStep) * tickStep;
    const niceMax = Math.ceil(yMax / tickStep) * tickStep;
    for (let v = niceMin; v <= niceMax; v += tickStep) {
      if (v >= yMin - 0.5 && v <= yMax + 0.5) tickVals.push(v);
    }
    // Always keep the 100% baseline tick when it falls in range
    if (!tickVals.includes(100) && 100 >= yMin && 100 <= yMax) tickVals.push(100);
    tickVals.sort((a, b) => b - a);

    const grid = tickVals
      .map((v) => {
        const y = yAt(v).toFixed(1);
        const isBase = v === 100;
        return `
          <line class="seasonality-grid${isBase ? " is-baseline" : ""}" x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}" />
          <text class="seasonality-axis-y" x="${left - 10}" y="${y}" dy="0.35em" text-anchor="end">${v}%</text>
        `;
      })
      .join("");

    const xLabels = months
      .map((m, i) => {
        const x = xAt(i).toFixed(1);
        return `<text class="seasonality-axis-x" x="${x}" y="${h - 12}" text-anchor="middle">${escapeSeasonHtml(seasonMonthShort(m))}</text>`;
      })
      .join("");

    const peakSet = new Set(peaks);
    const troughSet = new Set(troughs);
    const pointsDots = points
      .map((p, i) => {
        if (peakSet.has(months[i]) || troughSet.has(months[i])) return "";
        return `<circle class="seasonality-point" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" />`;
      })
      .join("");
    const markers = months
      .map((m, i) => {
        const isPeak = peakSet.has(m);
        const isTrough = troughSet.has(m);
        if (!isPeak && !isTrough) return "";
        const x = xAt(i);
        const y = yAt(affinities[i]);
        const title = seasonMonthTitle(m);
        const val = `${Math.round(affinities[i])}%`;
        const prevSame =
          i > 0 &&
          ((isPeak && peakSet.has(months[i - 1])) ||
            (isTrough && troughSet.has(months[i - 1])));
        const labelY = isPeak ? y - (prevSame ? 28 : 18) : y + (prevSame ? 34 : 24);
        // Edge months: keep labels inside the plot (Jan clears Y-axis; Dec stays on-canvas)
        const labelAnchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
        const labelX = i === 0 ? x + 4 : i === n - 1 ? x - 4 : x;
        if (isPeak) {
          return `
            <g class="seasonality-mark is-peak">
              <circle class="seasonality-mark-glow" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" />
              <circle class="seasonality-mark-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8.5" />
              <circle class="seasonality-mark-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" />
              <text class="seasonality-mark-label" x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${labelAnchor}">${escapeSeasonHtml(title)} ${val}</text>
            </g>`;
        }
        return `
          <g class="seasonality-mark is-trough">
            <circle class="seasonality-mark-glow" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" />
            <circle class="seasonality-mark-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8.5" />
            <circle class="seasonality-mark-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" />
            <text class="seasonality-mark-label" x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${labelAnchor}">${escapeSeasonHtml(title)} ${val}</text>
          </g>`;
      })
      .join("");

    return `<svg class="seasonality-main-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Сезонность по месяцам" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="${uid}-area" x1="0" y1="0" x2="0" y2="1">
          <stop class="seasonality-area-stop-peak" offset="0%" />
          <stop class="seasonality-area-stop-mid" offset="${gradOffset100.toFixed(1)}%" />
          <stop class="seasonality-area-stop-trough" offset="100%" />
        </linearGradient>
        <linearGradient id="${uid}-line" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${top + plotH}">
          <stop class="seasonality-line-stop-peak" offset="0%" />
          <stop class="seasonality-line-stop-peak" offset="${gradOffset100.toFixed(1)}%" />
          <stop class="seasonality-line-stop-trough" offset="${gradOffset100.toFixed(1)}%" />
          <stop class="seasonality-line-stop-trough" offset="100%" />
        </linearGradient>
      </defs>
      ${grid}
      <path class="seasonality-area" d="${areaPath}" fill="url(#${uid}-area)" />
      <path class="seasonality-line" d="${linePath}" stroke="url(#${uid}-line)" />
      ${pointsDots}
      ${markers}
      ${xLabels}
    </svg>`;
  }

  function peakishId(affinities) {
    return affinities.reduce((s, a, i) => s + Math.round(a) * (i + 1), 0);
  }

  function seasonKpiIcon(kind) {
    if (kind === "peak") {
      return `<svg class="seasonality-kpi-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 11.5 7.2 6.8l2.3 2.2L13 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.2 5H13v2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    if (kind === "trough") {
      return `<svg class="seasonality-kpi-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5 7.2 10.2l2.3-2.2L13 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.2 12H13V9.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    if (kind === "season") {
      return `<svg class="seasonality-kpi-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor" stroke-width="1.45"/><path d="M8 2.2v1.4M8 12.4v1.4M2.2 8h1.4M12.4 8h1.4M3.9 3.9l1 1M11.1 11.1l1 1M12.1 3.9l-1 1M4.9 11.1l-1 1" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/></svg>`;
    }
    return `<svg class="seasonality-kpi-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 10.5 5.5 7l2.2 2.2L11 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 12.5h11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".55"/></svg>`;
  }

  function seasonTipIcon(kind) {
    if (kind === "target") {
      return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="1.3" fill="currentColor"/></svg>`;
    }
    if (kind === "calendar") {
      return `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.2" y="4.5" width="13.6" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.2 8.2h13.6M7 3.2v2.6M13 3.2v2.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    }
    if (kind === "clock") {
      return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 6.2V10l2.6 1.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    // Checkered start flag (F1-style)
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.6v14.8" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"/><path d="M5.6 3h10.6c0 1.55-.7 2.55-.7 3.85S16.2 9.15 16.2 10.7H5.6Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M7.7 3v7.7M10.1 3v7.7M12.5 3.15v7.4M8.9 4.9h6.2M8.9 6.8h6.5M8.9 8.7h6.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  }

  function buildSeasonInsight(peaks, nextPeak) {
    const peakNames = peaks.map((m) => seasonMonthPrep(m));
    const peakList =
      peakNames.length <= 1
        ? peakNames[0] || "пиковые месяцы"
        : peakNames.length === 2
          ? `${peakNames[0]} и ${peakNames[1]}`
          : `${peakNames.slice(0, -1).join(", ")} и ${peakNames[peakNames.length - 1]}`;
    const nextNum = nextPeak ? seasonMonthNum(nextPeak) : 0;
    const nextName = nextNum ? SEASON_MONTH_FULL[nextNum] : "";
    // Several significant peaks: name them, then point launch timing at the nearest one.
    if (nextName && peakNames.length > 1) {
      return `Интерес выше среднего в <strong class="seasonality-em">${escapeSeasonHtml(peakList)}</strong>. Ближайший ориентир — <strong class="seasonality-em">${escapeSeasonHtml(nextName)}</strong>: запускайте кампании за <strong class="seasonality-em">4–6 недель</strong> до начала сезона.`;
    }
    return `Интерес выше среднего в <strong class="seasonality-em">${escapeSeasonHtml(peakList)}</strong>. Рекомендуем запускать кампании за <strong class="seasonality-em">4–6 недель</strong> до начала сезона.`;
  }

  function seasonMonthPrep(m) {
    const n = seasonMonthNum(m);
    return n ? SEASON_MONTH_PREP[n] : String(m?.label || "").toLowerCase();
  }

  function renderSeasonality() {
    const mount = els.seasonalityMount;
    if (!mount) return;
    const root = state.data?.seasonality;
    const slice = resolveSeasonalitySlice();
    const label = !state.industry
      ? "Все индустрии"
      : slice?.label || currentIndustry()?.label || state.industry;

    const asOfNice = formatAsOfLabel(root?.as_of);
    const metaLine = asOfNice
      ? `Wordstat · ${asOfNice} · ${label}`
      : `Wordstat · ${label}`;

    if (els.seasonalitySub) {
      els.seasonalitySub.textContent =
        "Индекс поисковой активности пользователей относительно среднего за год";
    }

    const setHeadMeta = (html) => {
      if (!els.seasonalityHeadMeta) return;
      if (!html) {
        els.seasonalityHeadMeta.hidden = true;
        els.seasonalityHeadMeta.innerHTML = "";
        return;
      }
      els.seasonalityHeadMeta.hidden = false;
      els.seasonalityHeadMeta.innerHTML = html;
    };

    if (!root || ((root.ok === false || root.use_seed) && !slice?.months?.length)) {
      const reason =
        root?.reason ||
        "Нет данных сезонности. Заполните YANDEX_API_KEY и FOLDER_ID в .env и запустите wordstat_collector.";
      setHeadMeta("");
      mount.innerHTML = `<p class="empty-hint">${escapeSeasonHtml(reason)}</p>`;
      return;
    }

    if (!slice?.months?.length) {
      setHeadMeta("");
      mount.innerHTML = `<p class="empty-hint">Для «${escapeSeasonHtml(label)}» сезонность ещё не собрана.</p>`;
      return;
    }

    const months = slice.months;
    const { peaks, troughs, peakVal, troughVal } = seasonExtremes(months);
    const chartMarks = pickSeasonChartMarkers(months);
    const high = pickHighSeasonMonths(months);
    const highLabel = formatSeasonRanges(high.months);
    const peakMonthsLabel = peaks.map(seasonMonthTitle).join(", ");
    const troughMonthsLabel = troughs.map(seasonMonthTitle).join(", ");

    // Launch timing: nearest significant peak (high season / abs max), not only yearly max.
    const significantPeaks = pickSignificantSeasonPeaks(months);
    const today = new Date();
    const nextPeakDate = resolveNextPeakDate(significantPeaks, today);
    const nextPeakMonth = nextPeakDate ? SEASON_MONTH_TITLE[nextPeakDate.getMonth() + 1] : "—";
    const daysToPeak = nextPeakDate != null ? Math.max(0, daysBetween(today, nextPeakDate)) : null;
    const startDate =
      nextPeakDate != null
        ? new Date(nextPeakDate.getTime() - 35 * 86400000)
        : null;
    const nextPeakMonthObj =
      nextPeakDate != null
        ? significantPeaks.find((m) => seasonMonthNum(m) === nextPeakDate.getMonth() + 1)
        : null;

    const tipBody = buildSeasonInsight(significantPeaks, nextPeakMonthObj);

    setHeadMeta(
      `<p class="seasonality-head-meta section-sub">${escapeSeasonHtml(metaLine)}</p>`
    );

    mount.innerHTML = `
      <div class="seasonality-board">
        <div class="seasonality-kpis" role="list">
          <article class="seasonality-kpi is-peak" role="listitem">
            ${seasonKpiIcon("peak")}
            <div class="seasonality-kpi-body">
              <span class="seasonality-kpi-label">Пик спроса</span>
              <p class="seasonality-kpi-value">${Math.round(peakVal)}%</p>
              <p class="seasonality-kpi-sub">${escapeSeasonHtml(peakMonthsLabel)}</p>
            </div>
          </article>
          <article class="seasonality-kpi is-trough" role="listitem">
            ${seasonKpiIcon("trough")}
            <div class="seasonality-kpi-body">
              <span class="seasonality-kpi-label">Минимум</span>
              <p class="seasonality-kpi-value">${Math.round(troughVal)}%</p>
              <p class="seasonality-kpi-sub">${escapeSeasonHtml(troughMonthsLabel)}</p>
            </div>
          </article>
          <article class="seasonality-kpi is-season" role="listitem">
            ${seasonKpiIcon("season")}
            <div class="seasonality-kpi-body">
              <span class="seasonality-kpi-label">Высокий сезон</span>
              <p class="seasonality-kpi-value seasonality-kpi-value-text">${escapeSeasonHtml(highLabel)}</p>
              <p class="seasonality-kpi-sub">Спрос выше среднего</p>
            </div>
          </article>
          <article class="seasonality-kpi is-rec" role="listitem">
            ${seasonKpiIcon("rec")}
            <div class="seasonality-kpi-body">
              <span class="seasonality-kpi-label">Рекомендация</span>
              <p class="seasonality-kpi-value seasonality-kpi-value-text">Начать за 4–6 недель</p>
              <p class="seasonality-kpi-sub">До начала сезона</p>
            </div>
          </article>
        </div>

        <div class="seasonality-chart-panel">
          ${seasonalityChartSvg(months, chartMarks.peaks, chartMarks.troughs)}
        </div>

        <aside class="seasonality-tip" aria-label="Рекомендация по размещению">
          <div class="seasonality-tip-col is-copy">
            <span class="seasonality-tip-icon" aria-hidden="true">${seasonTipIcon("target")}</span>
            <div class="seasonality-tip-copy">
              <p class="seasonality-tip-kicker">Рекомендация</p>
              <p class="seasonality-tip-text">${tipBody}</p>
            </div>
          </div>
          <div class="seasonality-tip-col">
            <span class="seasonality-tip-icon" aria-hidden="true">${seasonTipIcon("calendar")}</span>
            <div class="seasonality-chip">
              <span class="seasonality-chip-label">Следующий пик</span>
              <span class="seasonality-chip-value">${escapeSeasonHtml(nextPeakMonth)}</span>
            </div>
          </div>
          <div class="seasonality-tip-col">
            <span class="seasonality-tip-icon" aria-hidden="true">${seasonTipIcon("clock")}</span>
            <div class="seasonality-chip">
              <span class="seasonality-chip-label">До пика</span>
              <span class="seasonality-chip-value">${daysToPeak == null ? "—" : `${daysToPeak} ${ruDayWord(daysToPeak)}`}</span>
            </div>
          </div>
          <div class="seasonality-tip-col">
            <span class="seasonality-tip-icon" aria-hidden="true">${seasonTipIcon("flag")}</span>
            <div class="seasonality-chip">
              <span class="seasonality-chip-label">Начать размещение</span>
              <span class="seasonality-chip-value">с ${escapeSeasonHtml(formatRuDayMonth(startDate))}</span>
            </div>
          </div>
        </aside>
      </div>
    `;
  }

  function renderQuality() {
    const selected = activePlatforms();
    const rows = selected.length ? selected : PLATFORM_ORDER;
    const cell = (metric, { preferMin = false } = {}) => {
      const lead = preferMin ? metric.min : metric.typical;
      return `${formatPercent(lead)} <span style="color:var(--ink-muted)">(${formatPercent(metric.min)}–${formatPercent(metric.max)})</span>`;
    };
    els.qualityTable.innerHTML = rows.map((id) => {
      const q = state.data.quality[id];
      const label = state.data.platforms[id].label;
      return `
        <tr>
          <td>${label}</td>
          <td>${cell(q.ctr)}</td>
          <td>${cell(q.bounce, { preferMin: true })}</td>
          <td>${cell(q.bot, { preferMin: true })}</td>
        </tr>`;
    }).join("");
    if (els.qualityCards) {
      els.qualityCards.innerHTML = rows.map((id) => {
        const q = state.data.quality[id];
        const label = state.data.platforms[id].label;
        return `
          <article class="quality-card" data-platform="${id}">
            <h3 class="quality-card-name">${label}</h3>
            <dl class="quality-card-metrics">
              <div><dt>CTR</dt><dd>${cell(q.ctr)}</dd></div>
              <div><dt>Отказы</dt><dd>${cell(q.bounce, { preferMin: true })}</dd></div>
              <div><dt>Роботность</dt><dd>${cell(q.bot, { preferMin: true })}</dd></div>
            </dl>
          </article>`;
      }).join("");
    }
  }

  function setGoal(goal) {
    if (goal !== "reach" && goal !== "traffic") return;
    state.goal = goal;
    state.platformOverrides = {};
    state.dismissedPlatformTips = {};
    clearPlatformTipTimers();
    platformTipActiveKey = null;
    document.querySelectorAll(".plat-chip-tip").forEach((node) => node.remove());
    if (els.goalSwitch) {
      els.goalSwitch.dataset.goal = goal;
      els.goalSwitch.querySelectorAll(".goal-option[role='radio']").forEach((btn) => {
        btn.setAttribute("aria-checked", btn.dataset.goal === goal ? "true" : "false");
      });
    }
    renderAll();
  }

  function setGeo(geo) {
    state.geo = geo;
    if (els.geoSwitch) {
      els.geoSwitch.dataset.geo = geo;
      els.geoSwitch.querySelectorAll(".geo-option").forEach((btn) => {
        btn.setAttribute("aria-checked", btn.dataset.geo === geo ? "true" : "false");
      });
    }
    renderAll();
  }

  function setPeriod(period) {
    if (!PERIODS[period]) return;
    state.period = period;
    if (els.periodSwitch) {
      els.periodSwitch.dataset.period = period;
      els.periodSwitch.querySelectorAll(".period-option").forEach((btn) => {
        btn.setAttribute("aria-checked", btn.dataset.period === period ? "true" : "false");
      });
    }
    applyBudgetSliderLimits({ clampBudget: true });
    renderAll();
  }

  function populateIndustryOptions() {
    const select = els.industrySelect;
    if (!select || !state.data?.industries) return;
    const current = state.industry || "";
    const industries = state.data.industries;
    const order = state.data?.seasonality?.industry_order;
    const ids = Array.isArray(order) && order.length
      ? [
          ...order.filter((id) => industries[id]),
          ...Object.keys(industries).filter((id) => !order.includes(id)),
        ]
      : Object.keys(industries).sort((a, b) => {
          const va = Number(state.data?.seasonality?.by_industry?.[a]?.queries_year);
          const vb = Number(state.data?.seasonality?.by_industry?.[b]?.queries_year);
          const aOk = Number.isFinite(va);
          const bOk = Number.isFinite(vb);
          if (aOk && bOk && va !== vb) return vb - va;
          if (aOk !== bOk) return aOk ? -1 : 1;
          const la = industries[a]?.label || a;
          const lb = industries[b]?.label || b;
          return la.localeCompare(lb, "ru");
        });

    select.innerHTML = "";
    const any = document.createElement("option");
    any.value = "";
    any.textContent = "Любая";
    select.appendChild(any);
    ids.forEach((id) => {
      const industry = industries[id];
      if (!industry) return;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = industry.label || id;
      select.appendChild(opt);
    });
    select.value = industries[current] ? current : "";
    state.industry = select.value;
    if (els.industrySelectWrap) {
      els.industrySelectWrap.dataset.industry = state.industry;
    }
  }

  function setIndustry(industry) {
    state.industry = industry || "";
    if (els.industrySelect) {
      els.industrySelect.value = state.industry;
    }
    if (els.industrySelectWrap) {
      els.industrySelectWrap.dataset.industry = state.industry;
    }
    renderAll();
  }

  function renderAll() {
    if (!state.data) return;
    applyPlatformSelectionFromRecommendation();
    syncPlatformChips();
    renderPlatformRecTips();
    const framing = mixFramingLabel();
    const n = activePlatforms().length;
    document.querySelectorAll(".platforms-section-head .section-sub").forEach((el) => {
      el.textContent =
        n <= 1
          ? "Оценка площадки при текущем бюджете"
          : `Оценки по доле тотал-бюджета в ${framing}`;
    });
    const qualityTitle = document.getElementById("qualityTitle");
    if (qualityTitle) {
      qualityTitle.textContent =
        state.goal === "reach"
          ? "Качество площадок (ориентиры)"
          : "Качество трафика (ориентиры)";
    }
    renderCapacity();
    renderPlatforms();
    renderMix();
    renderSeasonality();
    renderQuality();
    updateFooterSources();
  }

  function bindCollapsiblePanels() {
    document.querySelectorAll("[data-collapsible]").forEach((panel) => {
      const toggle = panel.querySelector(".panel-collapse-toggle");
      const body = panel.querySelector(".panel-collapse-body");
      if (!toggle || !body) return;

      const setOpen = (open) => {
        panel.classList.toggle("is-collapsed", !open);
        body.hidden = !open;
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      };

      // Default: collapsed
      setOpen(false);

      toggle.addEventListener("click", () => {
        setOpen(panel.classList.contains("is-collapsed"));
      });
    });
  }

  function bindInputs() {
    if (els.goalSwitch) {
      els.goalSwitch.querySelectorAll(".goal-option[role='radio']").forEach((btn) => {
        btn.addEventListener("click", () => setGoal(btn.dataset.goal));
      });
    }
    bindGoalHelpTip();

    if (els.geoSwitch) {
      els.geoSwitch.querySelectorAll(".geo-option").forEach((btn) => {
        btn.addEventListener("click", () => setGeo(btn.dataset.geo));
      });
    }
    bindGeoHelpTip();

    if (els.periodSwitch) {
      els.periodSwitch.querySelectorAll(".period-option").forEach((btn) => {
        btn.addEventListener("click", () => setPeriod(btn.dataset.period));
      });
    }
    bindPeriodHelpTip();
    bindIndustryHelpTip();
    bindPlatformsHelpTip();
    bindBudgetHelpTip();
    bindSeasonalityHelpTip();

    if (els.industrySelect) {
      els.industrySelect.addEventListener("change", () => {
        setIndustry(els.industrySelect.value || "");
      });
    }

    document.querySelectorAll('input[name="platform"]').forEach((input) => {
      input.addEventListener("change", () => {
        const id = input.value;
        const recommended = new Set(
          resolveRecommendedPlatforms(workingBudget(), state.goal, state.geo)
        );

        // Нельзя снять все площадки, если бюджет > 0
        if (!input.checked) {
          const stillOn = PLATFORM_ORDER.filter((p) =>
            p === id ? false : state.platforms[p]
          );
          if (!stillOn.length && state.budget > 0) {
            input.checked = true;
            return;
          }
        }

        const wantOn = input.checked;
        const autoOn = recommended.has(id);
        if (wantOn === autoOn) {
          delete state.platformOverrides[id];
        } else {
          state.platformOverrides[id] = wantOn ? "on" : "off";
        }
        delete state.dismissedPlatformTips[`${id}:on`];
        delete state.dismissedPlatformTips[`${id}:off`];
        state.platforms[id] = wantOn;
        renderAll();
      });
    });

    const syncBudget = (value, { fromRange = false } = {}) => {
      const raw = fromRange ? Number(value) || 0 : parseBudget(value);
      const { min, max } = budgetSliderLimits();
      // Слайдер — до max; в поле можно ввести больше 5 млн.
      const n = fromRange
        ? Math.min(max, Math.max(min, raw))
        : Math.max(min, raw);
      state.budget = n;
      els.budget.value = formatBudget(n);
      els.budgetRange.value = String(Math.min(max, Math.max(min, n)));
      updateBudgetRichTip(n);
      updateBudgetSliderHintPos();
      if (fromRange) dismissBudgetSliderHint();
      renderAll();
    };

    let richTipTimer = null;

    const hideBudgetRichTip = () => {
      const tip = els.budgetRichTip;
      if (!tip) return;
      tip.classList.remove("is-visible");
      window.setTimeout(() => {
        if (!tip.classList.contains("is-visible")) tip.hidden = true;
      }, 300);
    };

    const updateBudgetRichTip = (budget) => {
      const tip = els.budgetRichTip;
      if (!tip) return;
      if (richTipTimer) {
        window.clearTimeout(richTipTimer);
        richTipTimer = null;
      }

      const max = Number(els.budgetRange.max);
      const show = budget > max;
      if (!show) {
        hideBudgetRichTip();
        return;
      }

      tip.hidden = false;
      void tip.offsetWidth;
      tip.classList.add("is-visible");
      richTipTimer = window.setTimeout(hideBudgetRichTip, 3000);
    };

    els.budget.addEventListener("input", () => {
      const n = parseBudget(els.budget.value);
      const { min, max } = budgetSliderLimits();
      // Пока печатают — не форсим min/max; на blur/Enter подтянем min. Слайдер паркуется у max.
      state.budget = Math.max(0, n);
      els.budgetRange.value = String(
        Math.min(max, Math.max(min, state.budget || min))
      );
      updateBudgetRichTip(state.budget);
      renderAll();
    });

    els.budget.addEventListener("blur", () => {
      syncBudget(els.budget.value);
    });

    els.budget.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        syncBudget(els.budget.value);
        els.budget.blur();
      }
    });

    els.budgetRange.addEventListener("input", () => syncBudget(els.budgetRange.value, { fromRange: true }));
    els.budgetRange.addEventListener("pointerdown", dismissBudgetSliderHint);
    els.budgetRange.addEventListener("keydown", dismissBudgetSliderHint);
    els.themeToggle.addEventListener("click", toggleTheme);

    applyBudgetSliderLimits();
    els.budget.value = formatBudget(state.budget);
    updateBudgetRichTip(state.budget);
  }

  function applyMetaDefaults() {
    const meta = state.data?.meta || {};

    const defaultGoal = meta.goal_default;
    if (defaultGoal === "reach" || defaultGoal === "traffic") {
      state.goal = defaultGoal;
      if (els.goalSwitch) {
        els.goalSwitch.dataset.goal = defaultGoal;
        els.goalSwitch.querySelectorAll(".goal-option[role='radio']").forEach((btn) => {
          btn.setAttribute("aria-checked", btn.dataset.goal === defaultGoal ? "true" : "false");
        });
      }
    }

    const defaultGeo = meta.geo_default;
    if (defaultGeo && state.data?.geos?.[defaultGeo]) {
      state.geo = defaultGeo;
      if (els.geoSwitch) {
        els.geoSwitch.dataset.geo = defaultGeo;
        els.geoSwitch.querySelectorAll(".geo-option").forEach((btn) => {
          btn.setAttribute("aria-checked", btn.dataset.geo === defaultGeo ? "true" : "false");
        });
      }
    }

    const defaultPeriod = meta.period_default;
    if (PERIODS[defaultPeriod]) {
      state.period = defaultPeriod;
      if (els.periodSwitch) {
        els.periodSwitch.dataset.period = defaultPeriod;
        els.periodSwitch.querySelectorAll(".period-option").forEach((btn) => {
          btn.setAttribute("aria-checked", btn.dataset.period === defaultPeriod ? "true" : "false");
        });
      }
    }

    const defaultIndustry = meta.industry_default;
    if (defaultIndustry && state.data?.industries?.[defaultIndustry]) {
      state.industry = defaultIndustry;
    }

    const defaultBudget = Number(meta.budget_default);
    if (Number.isFinite(defaultBudget) && defaultBudget > 0) {
      state.budget = defaultBudget;
    }

    applyBudgetSliderLimits();
    if (els.budget) els.budget.value = formatBudget(state.budget);
  }

  async function loadData() {
    const response = await fetch("./data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Не удалось загрузить data.json (${response.status})`);
    state.data = await response.json();
    applyMetaDefaults();
    const updated = state.data.meta?.updated_at || "—";
    els.benchDate.textContent = updated;
  }

  async function boot() {
    initTheme();
    bindCollapsiblePanels();
    bindInputs();
    try {
      await loadData();
      populateIndustryOptions();
      renderAll();
      showBudgetSliderHintIfNeeded();
    } catch (err) {
      const msg = `Ошибка загрузки данных: ${err.message || err}`;
      if (els.overlapMount) {
        els.overlapMount.innerHTML = `<section class="overlap-summary planner-card"><p class="disclaimer">${msg}</p></section>`;
      }
      console.error(err);
    }
  }

  boot();
})();
