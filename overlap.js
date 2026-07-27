/**
 * Расчёт уникального охвата и пересечения аудиторий на нескольких площадках.
 *
 * База — вероятностная модель независимых событий (формула Сейнсбери):
 *   Unique = TAM × [1 − Π(1 − Ri/TAM)]
 *
 * Поправка на корреляцию: площадки Рунета конкурируют за общее активное
 * ядро, а не за случайную выборку из всего гео. Поэтому в формуле пересечения
 * используем «эффективную ёмкость» = TAM × correlationFactor (factor < 1 →
 * пересечение растёт до реалистичного уровня; factor = 1 → чистая модель
 * независимости из ТЗ).
 *
 * Жёсткий потолок — полный TAM рынка: уникальный и показываемый суммарный
 * охват не могут превышать ёмкость гео/индустрии. Корреляция не снижает
 * потолок одиночного канала ниже TAM.
 *
 * UMD: работает и как <script> в браузере (window.ECOverlap), и в Node
 * (module.exports) — чтобы один и тот же код гонять из юнит-тестов.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ECOverlap = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_CORRELATION = 0.6;

  /**
   * @param {number} tam Ёмкость рынка (Total Addressable Market)
   * @param {Array<{id?: string, reach: number}>} platforms Активные площадки
   * @param {{correlationFactor?: number}} [options]
   * @returns {{grossReach:number,totalUnique:number,overlapAbsolute:number,overlapPercentage:number}}
   */
  function calculateAudienceOverlap(tam, platforms, options) {
    const correlationFactor =
      options && Number.isFinite(options.correlationFactor)
        ? options.correlationFactor
        : DEFAULT_CORRELATION;

    if (!(tam > 0) || !Array.isArray(platforms) || platforms.length === 0) {
      return { grossReach: 0, totalUnique: 0, overlapAbsolute: 0, overlapPercentage: 0 };
    }

    const cappedReaches = platforms.map((p) => {
      const raw = Math.max(0, Number(p && p.reach) || 0);
      return Math.min(raw, tam);
    });

    const activeReaches = cappedReaches.filter((r) => r > 0);
    if (!activeReaches.length) {
      return { grossReach: 0, totalUnique: 0, overlapAbsolute: 0, overlapPercentage: 0 };
    }

    const grossSum = activeReaches.reduce((s, r) => s + r, 0);
    const maxPlatformReach = Math.max(...activeReaches);

    // Один канал: пересечения нет, корреляция не применяется.
    if (activeReaches.length === 1) {
      const reach = Math.round(maxPlatformReach);
      return { grossReach: reach, totalUnique: reach, overlapAbsolute: 0, overlapPercentage: 0 };
    }

    const effectiveTam = Math.max(1, tam * correlationFactor);
    let nonExposureProbability = 1;

    for (const reach of activeReaches) {
      const pReach = Math.min(reach, effectiveTam);
      nonExposureProbability *= 1 - pReach / effectiveTam;
    }

    const formulaUnique = effectiveTam * (1 - nonExposureProbability);
    const totalUnique = Math.min(
      tam,
      Math.round(Math.max(formulaUnique, maxPlatformReach))
    );
    const grossReach = Math.min(tam, Math.round(grossSum));
    const overlapAbsolute = Math.max(0, grossReach - totalUnique);
    const overlapPercentage = grossReach > 0 ? (overlapAbsolute / grossReach) * 100 : 0;

    return {
      grossReach,
      totalUnique,
      overlapAbsolute,
      overlapPercentage: Number(overlapPercentage.toFixed(2)),
    };
  }

  return { calculateAudienceOverlap, DEFAULT_CORRELATION };
});
