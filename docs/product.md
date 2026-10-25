# Product — Vidomo

> Ми не продаємо нерухомість. Ми допомагаємо зрозуміти, чи варто її купувати.

## 1. Позиціонування

**Decision intelligence layer для покупця.** Не портал, не агентство, не оцінювач (appraiser).
Єдина вигода від угоди, яку ми отримуємо, — плата покупця за перевірку. Жодних комісій від продавця/забудовника,
жодних партнерських лідів — це наше головне trust-обмеження і одночасно відмінність від ринку, де майже кожен гравець
заробляє на тому, що об'єкт купили.

**Золоте правило:** фіча має допомогти уникнути поганої покупки або купити хороший об'єкт за правильну ціну. Інакше — не в пріоритеті.

## 2. Що показало дослідження аналогів

| Гравець | Що беремо | Що НЕ беремо |
|---|---|---|
| **Zillow (Zestimate)** | Valuation як діапазон + публічно оголошена похибка (медіанна абсолютна похибка ≈ 6–9% на ринках з щільними даними, значно гірше на «тонких» ринках). Показ «on-market vs off-market» точності. | Одне «точне» число на видному місці. |
| **Redfin** | Пояснення *чому* ціна така (comps на карті, тренд, конкуренція), «Redfin Estimate» + tour insights. | — |
| **HouseCanary / CoreLogic** | Forecast Standard Deviation (FSD) і confidence score як частина продукту; прозорі comparable adjustments. | Black-box ML без пояснень. |
| **RICS (Level 1/2/3, Condition Ratings 1–3)** | Світлофор стану елементів (1 — ок, 2 — треба стежити/ремонт, 3 — терміново/серйозно) та звіт, що розділяє *факт огляду* від *рекомендації*. Структура «елемент → стан → ризик → дія». | Юридичні висновки у технічному звіті. |
| **Nearmap / GIS-інтелект** | Шари ризику на карті (дах, затоплення, будівництво поруч) як окремі, датовані шари. | Залежність від одного провайдера. |
| **Сучасні inspection-платформи (HomeGauge, Spectora, ISN)** | Структурований шаблон огляду, фото-прив'язка до дефекту, severity, діапазон вартості ремонту. | — |
| **Україна: LUN, DIM.RIA, Opendatabot, YouControl, Riel.ua, Prozorro, Дія** | LUN — найсильніша нормалізована первинка + аналітика; DIM.RIA — найбільша база вторинки + публічні цінові сторінки; Opendatabot/YouControl — перевірка контрагентів/забудовників та реєстрів. Ми — шар *над* ними, а не їхня заміна. | Прямий скрапінг порталів. |

Ключові висновки, що вплинули на продукт:

1. **Конкуренти показують *ціну*, ніхто в Україні не показує *ризик + технічний стан + переговорну позицію* разом.** Це наш простір.
2. **Довіра будується на показі невизначеності** (діапазон, свіжість даних, чого бракує), а не на красивому числі.
3. **Найвища WTP — там, де ціна помилки велика і неочевидна**: приховані юридичні обтяження, стан інженерії, вологість/цвіль у старому фонді, самобуд/перепланування, ризики новобудови (забудовник, дозволи).
4. Онлайн-аналітика без фізичного огляду — лише «Digital Check». Фізичний огляд — основний диференціатор і основне джерело унікальних даних.

## 3. Персони (Lviv MVP)

1. **Сім'я-першопокупець** (бюджет $60–120k, 2–3 кімнати, школа/садок, вторинка або новобудова). Страх: «куплю проблеми».
2. **Інвестор-початківець** ($50–90k, студія/1к, оренда студентам/ВПО/IT). Страх: «переплачу, не здам».
3. **Покупець на відстані** (діаспора/ВПО, не може приїхати). Потребує «очі на місці» — найвища WTP за огляд.
4. *(Phase 2)* комерція — custom scope.

## 4. Customer journey

`Brief → Search/Selection → Intelligence → Inspection → Report → Decision`

Три входи (на головній — два):
- **«Перевірити об'єкт»** — URL / адреса / ручний ввід / PDF / фото → canonical Property.
- **«Допоможіть підібрати»** — progressive brief (по 1 питанню на екран, 7 кроків, адаптивні гілки).
- (прихований) вже є кілька варіантів → Compare.

## 5. Модулі Property Intelligence Report

| # | Модуль | Тип виходу | Правило |
|---|---|---|---|
| 1 | Market value | `ESTIMATE` діапазон + confidence | Ніколи не «appraisal». Мінімум N порівнянь, інакше `INSUFFICIENT DATA`. |
| 2 | Price verdict + negotiation | `INFERENCE` | Цифри лише з evidence; без comps — не показуємо. |
| 3 | Legal due diligence | `FACT` (з реєстрів) + GREEN/YELLOW/RED | Завжди «requires professional legal review». |
| 4 | Technical inspection | `FACT` (огляд) + `ESTIMATE` (ремонт) | Висновки, що потребують ліцензії, — тільки через ліцензованого спеціаліста. |
| 5 | Location intelligence | `FACT` (POI) + `INFERENCE` (час у дорозі) | Мультипровайдер (OSM / Google / municipal). |
| 6 | Lifestyle fit | `INFERENCE` | Score розкладається на причини з brief. |
| 7 | Investment | `ESTIMATE` ×3 сценарії | Conservative / Base / Optimistic. |
| 8 | Future risk | `FACT`+`INFERENCE` | Генплан, дозволи, ЄДЕССБ, дорожні проєкти. |
| 9 | Score | 7 explainable subscores | Без одного «магічного» числа. |
| 10 | Decision | Verdict + top‑3 + next actions | Зрозуміло без експертизи. |

### Provenance (обов'язково)
Кожен важливий факт — `Provenanced<T>`: `kind (FACT|INFERENCE|ESTIMATE)`, `source`, `fetchedAt`, `confidence`, `raw`, `value`, `method/version`.
У UI тип завжди видно (бейдж) — користувач відрізняє «знайдено в реєстрі» від «ми оцінюємо».

## 6. Verdict-логіка (v0.1)

Verdict не зводиться до цінової оцінки. Він — результат **правил**:

- Є `RED` у legal → `DO NOT PROCEED WITHOUT FURTHER REVIEW`.
- Confidence цінової оцінки < 35% і немає огляду → `DO NOT PROCEED…` / `INSUFFICIENT DATA`.
- Є критичні технічні дефекти (RED) з сумарним ремонтом > 10% ціни → `HIGH RISK` або `NEGOTIATE`.
- Ціна ≥ верх діапазону +4% → `NEGOTIATE`.
- Ціна ≤ діапазон, risk низький → `GOOD BUY`.

Реалізація: `src/domain/decision/verdict.ts` — чисті функції + тести.

## 7. MVP (Lviv Residential Buyer Due Diligence)

**Принцип: manual-first, automate-after-usage.**

Що автоматизовано в MVP (бо дешево й повторюване):
- brief, property intake, нормалізація в canonical Property;
- first‑pass valuation (comps adjust) з явним confidence;
- шаблон технічного огляду, структура звіту, інтерактивний вебзвіт;
- аналітика воронки.

Що лишається ручним (service-assisted):
- витяг/читання реєстрів (оператор + юрист), вибірка comps «на очі», призначення інспектора,
  фінальне редагування звіту, переговорна консультація.

**Операційний цикл замовлення**: заявка → оператор перевіряє повноту → digital pass (годинник, не дні) → за згодою клієнта — призначення інспектора → огляд з чек-листом → редактура звіту → консультація 30 хв.

## 8. Пакети (гіпотези — не хардкод)

Це **гіпотези для перевірки**, не остаточний прайс. Конфігурація — `src/config/packages.ts`, цифри там позначені `hypothesis: true`.

| Пакет | Для кого | Склад |
|---|---|---|
| **Digital Check** | вже є об'єкт, дедлайн, віддалений покупець | valuation, price verdict, location, red-flag checklist, питання до продавця |
| **Full Buyer Due Diligence** | готовий купувати | Digital + документи/реєстри (з юристом) + виїзний технічний огляд + PDF |
| **Buyer Advisory** | шукає, не має об'єкта | brief + shortlist + compare + огляди + підтримка на переговорах |
| **Commercial DD** | комерція/інвестиції | custom scope |

**Дослідження WTP (перші 6 тижнів):**
1. 15–20 інтерв'ю з нещодавніми покупцями у Львові (що пішло не так, скільки «коштувала» помилка).
2. Van Westendorp на 4 цінових точках для Digital Check і Full DD.
3. Fake-door у воронці: клік «Замовити огляд» з показом ціни → вимірюємо `inspection_requested / report_viewed`.
4. Anchor: порівняння з вартістю юриста (зазвичай фіксована плата + % від угоди), оцінювача, рієлтора (1–3% комісії).

## 9. Метрики

Воронка: `brief_started → brief_completed → property_added → report_requested → report_viewed → comparison_created → inspection_requested → consultation_requested → purchase_completed`.

North Star: **% клієнтів, які змінили рішення або ціну завдяки звіту** (відмовились від поганого об'єкта або знизили ціну). Збирається в post-purchase опитуванні + `negotiated_discount_pct`.

## 10. Не-цілі (поки що)

- Не маркетплейс, не CRM для агентів.
- Не повна автоматична AVM для всієї України.
- Не юридичний висновок, не сертифікована оцінка.
- Не нативні застосунки, не мікросервіси, не Kotlin backend.

## 11. Milestones

| M | Результат | Статус |
|---|---|---|
| M0 | Research + docs | ✅ |
| M1 | Foundation: i18n uk/en, design system, domain layers, CityAdapter / PropertyTypeAdapter | ✅ |
| M2 | Landing, adaptive Brief (+district matching), Property intake | ✅ |
| M3 | Valuation v0 (comps + explainable confidence), verdict rules, interactive report, compare + best fit, inspection methodology page | ✅ — **on synthetic demo comps** |
| M4 | Supabase schema, lead/brief API, analytics sink, print-to-PDF | ✅ schema + API (storage needs env); PDF = print stylesheet |
| M5 | Live data layer: DIM.RIA comps/rent (key), OSM location intel per address, NBU FX, source statuses in report | ✅ code (DIM.RIA needs key; public OSM endpoints unreliable → self-host) |
| M5b | Payments: monobank (UAH, Apple/Google Pay) + Stripe (USD) hosted checkout, webhooks, verified result page | ✅ code (needs merchant accounts) |
| M5c | Brand Vidomo, 3D logo, Three.js hero, scroll story; 8 cities in 3 oblasts | ✅ |
| M5d | Registry operator flow, calibration on real deals, 200+ manual comps | ⏭ next |
| M6 | Inspector mobile PWA (photos, offline), server-side PDF, auth + document upload with signed URLs | ⏭ |
| M7 | Pilot: 10 paid Digital Checks + 5 Full DD, calibrate valuation, WTP tests | ⏭ |
| M8 | Expand beyond 3 oblasts (CityAdapter config only) | ⏭ |
