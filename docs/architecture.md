# Architecture

## Вибір стеку (після дослідження)

| Рішення | Вибір | Чому |
|---|---|---|
| Framework | **Next.js 16 (App Router), React 19, TypeScript strict** | SSR для SEO (landing, city pages), RSC для звітів, route handlers для API. |
| Стилі | **Tailwind CSS v4** + CSS variables (tokens) | Швидко, токени в одному місці. |
| Motion | **`motion` (framer-motion successor)** | Декларативні layout/scroll/spring-анімації для score reveal, risk expansion, compare. GSAP не потрібен — немає timeline-heavy сцен. |
| i18n | **Власний легкий шар**: `[lang]` сегмент + typed dictionaries + `proxy.ts` | Рекомендований у Next docs підхід. Менше залежностей, повна типобезпека ключів (`Dictionary` виводиться з `uk.ts`, `en.ts` має відповідати типу). |
| Карта | **MapLibre GL** + OpenFreeMap (MVP) | Open-source, без ключа, не залежить від Google. Провайдер — через `MapProvider` config. |
| DB/Auth/Storage | **Supabase (Postgres + RLS + Storage + Auth)** | Один інструмент для БД, приватних файлів (signed URLs), auth. Схема в `supabase/migrations`. Без нього MVP працює (stateless demo). |
| Валідація | **zod** | Єдина схема для форми, API й домену. |
| AI | Server-side only (Anthropic API), *поки не підключено*; контракт — `src/domain/ai` | AI = extraction/summarization, не source of truth. |
| НЕ додаємо | Redis, queues, Elasticsearch, microservices, Kotlin | Немає навантаження, що це виправдовує. Перегляд — після пілоту. |

## Шари

```
src/
  app/[lang]/…              ← UI-маршрути (RSC за замовчуванням)
  app/api/…                 ← route handlers (orders, analytics)
  components/               ← UI (ui/, report/, brief/, marketing/, map/)
  domain/                   ← чистий TypeScript, без React/Next (тестується окремо)
    provenance/             ← FACT | INFERENCE | ESTIMATE, DataSourceDescriptor
    location/               ← Country→Region→City→District→…  + CityAdapter + registry
    property/               ← canonical Property + PropertyTypeAdapter (residential/commercial/land)
    brief/                  ← Brief schema, кроки, адаптивна логіка
    valuation/              ← comps adjust, fair range, confidence
    decision/               ← price verdict, negotiation, overall verdict, scoring
    inspection/             ← методологія, чек-листи, issue model, repair estimate
    legal/                  ← legal checks model (GREEN/YELLOW/RED)
    investment/             ← сценарії Conservative/Base/Optimistic
    report/                 ← збірка PropertyIntelligenceReport з модулів
  config/                   ← packages, feature flags
  i18n/                     ← dictionaries, helpers
  lib/                      ← analytics, env, utils
data/ (в src/data/)         ← seed/demo-дані (чітко марковані `demo`)
supabase/migrations/        ← SQL
docs/
```

Правило залежностей: `domain/*` не імпортує `app/*` чи `components/*`. UI не знає про конкретні міста — лише про `CityAdapter`.

## Provenance модель

```ts
type DataKind = 'FACT' | 'INFERENCE' | 'ESTIMATE';
interface Provenanced<T> {
  kind: DataKind;
  value: T;               // transformed
  raw?: unknown;          // як отримали
  source: SourceRef;      // id у реєстрі джерел
  fetchedAt: string;      // ISO
  confidence: number;     // 0..1
  method?: { name: string; version: string };
}
```
Компілятор не дозволяє передати `ESTIMATE` туди, де потрібен `FACT` (branded `Fact<T>`/`Estimate<T>` alias-и). UI-компонент `<Provenance />` завжди показує бейдж типу.

## City Adapter

```ts
interface CityAdapter {
  id: string; countryCode: string; regionId: string;
  names: Record<Lang,string>; center: LngLat; timezone: string; currency: string;
  districts: District[];                        // конфіг, не код
  dataSources: DataSourceBinding[];             // які джерела доступні тут
  availableReports: ReportModuleId[];           // що ми можемо дати в цьому місті
  valuation: { benchmarkPricePerSqm: Money; comps: CompsProvider; askToSoldDiscount: Range };
  regulations: RegulationRef[];
  experts: ExpertDirectoryRef;
  inspection: { available: boolean; leadTimeDays: number };
}
```
Додати місто = додати файл `src/domain/location/cities/<id>.ts` + зареєструвати в `registry.ts`. Ужгород та Івано-Франківськ вже зареєстровані зі статусом `coming-soon` (без вигаданих цін: `benchmark: null`).

Геолокація: клієнт → `navigator.geolocation` (тільки за дією користувача) → `nearestCity(lat,lng)` (haversine по `center`) → пропозиція «Схоже, ви у Львові — підлаштувати?». Завжди ручний вибір, зберігається в cookie `city`.

## Property Type Adapter

```ts
interface PropertyTypeAdapter<TAttrs> {
  id: PropertyClass; attrsSchema: ZodType<TAttrs>;
  inspectionChecklist: ChecklistSection[];
  valuationRules: { adjustments: AdjustmentRule<TAttrs>[]; minComps: number };
  reportSections: ReportModuleId[];
}
```
MVP: `residential.apartment` повністю; `house`, `commercial`, `land` — зареєстровані зі схемою та чек-листом (структура), valuation = `INSUFFICIENT DATA` до появи даних.

## Valuation v0 (Comparable Market Analysis)

1. Відбір comps: той самий city/class, площа ±35%, кімнати ±1, радіус/район-вага, свіжість ≤ 180 днів.
2. Кожен comp → **adjusted €/м²**: поправки на поверх, вік будинку, стан, район (мультиплікатори в adapter config, документовані та версіоновані).
3. Зважена медіана (вага = схожість × свіжість). Діапазон = [P25, P75] зваженого розподілу, розширений на `askToSold` discount.
4. **Confidence** = f(кількість comps, дисперсія, свіжість, покриття атрибутів, відстань) — розкладається на компоненти і показується.
5. Нижче `minComps` → `INSUFFICIENT DATA` (не «0»).

Це «не appraisal». Цифри налаштувань — у конфігу з поміткою `calibration: 'uncalibrated'` доти, доки не зіставлені з реальними кейсами.

## Decision layer

- `priceVerdict(ask, fairRange, confidence)` → `UNDERPRICED | FAIR | SLIGHTLY_OVERPRICED | OVERPRICED | INSUFFICIENT_DATA`.
- `negotiation(ask, fairRange, repairs)` → лише при достатній evidence.
- `scores` — 7 subscores, кожен `{value 0..100 | null, drivers: [{label, delta, kind}], missing: []}`; `null` = «недостатньо даних» (не 0).
- `overallVerdict` — rule-based (див. product.md), повертає також `reasons[]`.
- `decisionConfidence` = мінімум-зважене від покриття модулів: чим більше модулів `unknown`, тим нижче.

## Дані та БД (Supabase/Postgres)

Домени → таблиці: `profiles`, `briefs`, `locations` (self-ref tree), `properties`, `property_sources`, `market_comps`, `valuations`, `legal_checks`, `inspections`, `inspection_issues`, `documents`, `reports`, `recommendations`, `experts`, `leads`, `orders` (billing), `audit_log`, `consents`.
RLS: власник бачить лише свої рядки; експерт — лише призначені inspections; service role — лише на сервері.
Файли: private bucket, доступ лише signed URLs (TTL 5 хв), шифрування at rest (Supabase), allowlist MIME, ліміт розміру.

## Security / Privacy

- Мінімум даних на вході (email/телефон необов'язково до замовлення).
- Секрети тільки server-side (`process.env`, жодних `NEXT_PUBLIC_` для ключів).
- Audit log для доступу до реєстрових даних і документів.
- GDPR-ready: таблиця `consents`, каскадне видалення (`on delete cascade`) від `profiles`; endpoints export/delete (`/api/me/*`) — **не реалізовані**, у roadmap (M6).
- Документи клієнта **не** використовуються для training; прапорець `ai_processing_consent` обов'язковий перед AI-обробкою.
- Заголовки безпеки (X-Frame-Options, nosniff, Referrer-Policy, HSTS, Permissions-Policy) у `next.config.ts`. CSP — TODO (потребує allowlist для OpenFreeMap/шрифтів).
- Rate limiting на `/api/orders` (in-memory для MVP; змінити при horizontal scale).

## AI-шар (контракт)

Дозволено: extraction (PDF → поля з `source: document, page`), summary, anomaly flags, питання до продавця, пояснення.
Заборонено: вигадувати реєстрові дані; прибирати невизначеність; юридичні висновки; видавати оцінку за appraisal.
Реалізація: structured outputs (JSON schema) → результат кладеться як `INFERENCE` з `method: {name: 'llm-extract', version}` та людським review-флагом.

## Аналітика

`track(event, props)` — тонкий шар; sink за замовчуванням: `console` у dev і `POST /api/analytics` (структуровані логи; whitelist подій через zod). Підключення PostHog/Plausible — змінна env + адаптер, без зміни викликів. Події — з product.md. PII не передаємо у props.

## SEO / CRO

SSR-контент за локаллю, `hreflang` alternates, `sitemap.ts`, `robots.ts`, JSON-LD (`Organization`, `Service`, `FAQPage`), OG-зображення. CRO: один первинний CTA/екран, два входи на hero, розкриття деталей за запитом, демо-звіт як proof.

## Тестування

- Unit (vitest) для `domain/*`: valuation, verdict, scoring, geo, provenance, i18n parity (uk/en мають однакові ключі).
- `tsc --noEmit`, `next build`, ESLint у CI.
- Ручний QA: перегляд ключових сторінок на 390/1280px, uk/en, light/dark, print. Playwright e2e — після пілоту.

## Відомі обмеження реалізації (v0.1)

- MapLibre worker віддається як статичний файл (`public/vendor/maplibre`, копіюється `postinstall`), бо Turbopack не бандлить worker.
- Rate-limit `/api/orders` — in-memory (одна інстанція).
- Позиція об'єкта на карті — центр району (геокодування адреси ще не підключене).
- Сторінка `/report` обчислюється на сервері з query-параметрів (shareable, без БД); збереження звітів у `reports` — M6.

## v0.2 — живі дані, платежі, бренд

### Data layer (`src/server/`)
- `http.ts` — `getJson` з таймаутом, ідентифікуючим User-Agent, `next.revalidate`; ніколи не кидає — повертає `{ok:false,error}`.
- `sources/{nominatim,overpass,ria,nbu}.ts` — адаптери джерел; мапінг у доменні типи — чисті функції (`riaInfoToComp`, `indicatorsFromOsm`) з тестами.
- `live-report.ts` — оркестрація: geocode → (паралельно) OSM + DIM.RIA sale/rent + НБУ → `buildReport` (чистий). Статуси джерел потрапляють у звіт.
- Демо-звіт і порівняння лишаються синхронними й чистими (SSG / клієнт).

### Payments (`src/server/payments/`)
Інтерфейс `PaymentProvider { createCheckout, status }`, два hosted-провайдери:

| | monobank acquiring | Stripe Checkout |
|---|---|---|
| Для кого | українські картки, UAH | діаспора / іноземні картки, USD |
| Apple Pay / Google Pay | так, на сторінці інвойсу | так, на Checkout (увімкнути в Dashboard) |
| Ціна | USD з конфігу × курс НБУ, округлення до 10 грн | USD з конфігу |
| Вебхук | `X-Sign` — ECDSA підпис тіла; ключ `/api/merchant/pubkey` (кешується, повторний запит при збої) | `Stripe-Signature` — HMAC-SHA256, допуск 5 хв |
| Статус на сторінці результату | `GET /api/merchant/invoice/status` (invoiceId у httpOnly cookie) | `GET /v1/checkout/sessions/{id}` |

Чому так: monobank має найнижчий поріг входу для ФОП/ТОВ в Україні і нативно підтримує гаманці; Stripe не обслуговує українські юрособи → потрібна іноземна компанія (PL/EE/US), тому він — другий канал. Альтернативи, якщо monobank не підійде: LiqPay, WayForPay (обидва з Apple/Google Pay) — додаються ще одним адаптером. Ціна ніколи не приходить з клієнта; дані карток не торкаються наших серверів (SAQ-A). Схема: `supabase/migrations/0002_payments.sql`.

### Three.js
`three` без R3F; два компоненти (`three/city-scan.tsx`, `three/logo-3d.tsx`), lazy (`next/dynamic`, `ssr:false`), один InstancedMesh + один шейдер на ~1.5k будівель, пауза поза viewport/у фоновій вкладці, reduced-motion → статичний кадр, без WebGL — CSS-градієнт.

### Hydration-safe форматування
`formatMoney/formatNumber` — власні (Intl у Node і браузері дає різні пробіли/символи валют → React #418). Час у звітах — фіксований UTC-формат.

## v0.3 — адреси, найближча інфраструктура, валюти, контакти

- **Автодоповнення адрес**: `GET /api/geo/suggest?q=&city=` → `server/sources/geo.ts` (Geoapify, якщо є ключ → Photon). Клієнт: `components/map/address-autocomplete.tsx` (ARIA combobox, debounce 250 мс, скасування застарілих запитів). Обрана адреса передає точні координати у звіт (`lat`,`lng` у query) — без повторного геокодування.
- **Найближче**: `GET /api/geo/nearby?lat=&lng=` → по одному запиту на категорію (зупинка, продукти, аптека, школа, садок, медицина, парк), відстань по прямій + час пішки (ESTIMATE). Карта (`map/map-view.tsx`, MapLibre) показує об'єкт і маркери-іконки; наведення на рядок ↔ підсвітка маркера + пунктир від об'єкта.
- **Fallback щільності**: якщо Overpass недоступний, індикатори рахуються з найближчих місць; шум/паркінг/бізнес тоді = `null` («немає даних»), а не 0.
- **Карта: чому не Google**. Google Places дозволено показувати лише на Google-карті; наш стек — OSM-дані на MapLibre. Перехід можливий заміною провайдера + MapView.
- **Валюти**: основна — гривня. Курси НБУ (USD, EUR) підтягуються в layout (кеш 6 год) → `I18nProvider` → `money(v, from)` конвертує у вибрану валюту (₴/€/$ у хедері, вибір у localStorage). Сума до оплати завжди в гривні (`moneyExact`). Ціну в оголошенні можна ввести в USD/UAH/EUR — конвертується в валюту ринку міста.
- **Контакти**: `config/contact.ts` (`NEXT_PUBLIC_CONTACT_PHONE`, за замовчуванням тестовий номер з неіснуючим кодом 00), плаваюча панель телефон / WhatsApp (`wa.me`) / Viber (`viber://chat`), дубль у футері.

## v0.4 — документи, локація, огляд у 3D

- **Завантаження документів і фото** (`/api/uploads`, `components/check/document-drop.tsx`): drag & drop, до 10 файлів × 15 МБ (50 МБ разом), тип перевіряється за magic bytes (PDF/JPG/PNG/WEBP/HEIC), фото перед відправкою перекодовуються в браузері (EXIF/GPS видаляються). Файли йдуть у **приватний** бакет Supabase Storage `intake/<batch>/<uuid>.<ext>` (оригінальні назви не в шляхах), доступ співробітникам — підписані посилання на 5 хв (`server/storage.ts → signedUrl`). Окремі згоди: на обробку (обов'язкова) і на AI-витяг (опційна). `batch` прив'язується до заявки через `OrderPanel`. Без `SUPABASE_*` файли **не зберігаються** — UI це прямо каже.
- **LocationExplorer** (`components/map/location-explorer.tsx`): велика карта (до 560 px) + фільтр-стрічка з відстанню до найближчого в кожній категорії + згрупований список усіх знайдених місць з назвами (до 8 на категорію: зупинки, продукти, аптеки, школи, садки, медицина включно з приватними клініками, стоматологіями й лабораторіями, парки). Наведення ↔ підсвітка маркера + пунктир від об'єкта. Дублікати однієї точки (зупинка з двох боків вулиці) згортаються.
- **NumberInput** (`components/ui/number-input.tsx`): живе групування розрядів (`4 500 000`), курсор не стрибає, підказка масштабу (`≈ 4,5 млн`), у форму йде чисте число.
- **«Видиме vs виявлене» на Three.js** (`three/inspection-xray.tsx` + `inspection/xray-story.tsx`): кімната зі свіжим ремонтом у розрізі; крок за кроком сканер «просвічує» стіну/кут/короб/вікно й показує алюмінієву проводку, тепловізійну карту вологості за шафою, іржавий стояк із протіканням, місток холоду біля вікна. Для кожної знахідки — біль клієнта, кошторис, вага в переговорах; знизу — накопичувальна сума прихованих витрат. Автоплей лише у видимій області, керування кроками, reduced-motion.

## v1.0 — Операційна платформа: справи, ролі, модулі досьє

### Принцип: незалежні модулі замість одного «вироку»
Досьє складається з трьох **незалежних модулів**: `digital` (автоматично, завжди готовий), `legal` (юрист), `technical` (інспектор). Кожен має власний стан `not_ordered → awaiting_assignment → in_progress → done` (`domain/cases`).
- Вердикт (`domain/decision/overall.ts`): **факти спершу** (RED у юридичній частині або важкі технічні знахідки вирішують одразу) → якщо всі модулі готові — остаточний вердикт (GOOD_BUY / NEGOTIATE / HIGH_RISK / REVIEW_REQUIRED) → інакше **попередній** за цифровими даними (PROMISING / NEGOTIATE / CAUTION / INSUFFICIENT_DATA). Відсутні перевірки йдуть у `pending`, а не в ризики, і не знижують впевненість оцінки.
- Впевненість розділено: «впевненість оцінки» (того, що оцінено) і «досьє заповнено N/3».
- Чернетка огляду/юриста **не потрапляє** у звіт — тільки надісланий модуль (`buildReport` ігнорує незавершені).
- UI звіту: смуга модулів → вердикт → цифрові секції → блок «Перевірки для остаточного рішення» (незамовлені модулі — картка з цінністю, складом, впливом на рішення, ціною й CTA; готові — результати).

### Дані (Drizzle ORM + Postgres)
`src/server/db/schema.ts`: `users, sessions, properties, cases, inspections, inspection_issues, legal_reviews, legal_items, documents, leads, payments, events, audit_log`. Міграції — `drizzle/` (генерує `drizzle-kit generate`), застосовуються автоматично при першому зверненні. Локально — вбудований PGlite (`.data/pglite`), у production — `DATABASE_URL` (Supabase/Postgres) без змін коду.

Звʼязки: `properties 1─* cases`; `cases` → `client / manager / inspector / lawyer` (users); `cases 1─1 inspections 1─* inspection_issues`; `cases 1─1 legal_reviews`, `cases 1─* legal_items`; `cases 1─* documents, payments, leads, audit_log`. Статус справи **похідний** від модулів (`deriveStatus`), вручну — лише закрити/скасувати.

### Ролі й доступ (`domain/cases` → `can`, `canViewCase`)
| Роль | Бачить | Може |
|---|---|---|
| owner | все | дашборд, справи, команда, огляд і юр. форма будь-якої справи |
| manager | все | дашборд, справи (призначення, модулі, статус, нотатки), заявки |
| inspector | лише призначені справи | форма огляду: чек-лист (включно з «Енергія й безпека»), знахідки з кошторисом, надсилання |
| lawyer | лише призначені справи | юридична форма: статус кожної перевірки, примітка, дата витягу (FACT лише з датою) |
| client | лише свої справи | кабінет, досьє, дозамовлення модуля, завантаження документів |

Авторизація — у data-access шарі (`server/auth.ts → requireUser`, `loadCaseFor`), не в proxy. Сесії: випадковий токен у httpOnly cookie, у БД лише SHA-256; паролі — scrypt. Перший запуск: `/[lang]/setup` створює власника (доступно лише поки власника немає); працівників створює власник у «Команда».

### Потоки
- Анонімний звіт → «Зберегти в кабінет» (логін/реєстрація) → справа `digital`.
- Звіт → «Замовити» модуль / Full DD → checkout → **справа створюється завжди** з об'єктом зі звіту; якщо онлайн-оплату не підключено — заявка з номером справи для менеджера.
- Форма «Поставити питання» зі звіту → lead + справа з об'єктом.
- Клієнт реєструється з тим самим email → усі його справи прив'язуються автоматично.
- Менеджер призначає інспектора/юриста → у них з'являється завдання з **референсом об'єкта** (параметри, бриф клієнта, на що звернути увагу, документи, карта, контакт).
- Надіслані модулі одразу оновлюють досьє клієнта; статус справи — автоматично.
- Документи: локальне приватне сховище або Supabase; видача лише через `/api/files/[id]` з перевіркою доступу й аудитом.
- Аналітика подій зберігається в `events` → воронка на дашборді власника.

### Район з адреси
`/api/geo/district`: зворотне геокодування (Nominatim: borough / city_district / suburb) → зіставлення з районами міста (`domain/location/district.ts`), фолбек — найближчий центр району ≤2,5 км. Форма показує «Визначено автоматично — можна змінити».
