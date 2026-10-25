import type { InspectionIssue, RepairEstimate } from "@/domain/inspection";
import type { LegalCheck } from "@/domain/legal";
import type { Property } from "@/domain/property/types";

/** Illustrative sample content for the demo report. NOT a real object, inspection or registry extract. */

export const SAMPLE_PROPERTY: Property = {
  id: "sample-1",
  class: "residential",
  subtype: "apartment",
  cityId: "lviv",
  districtId: "frankivskyi",
  address: "вул. Прикладна, 12 · Sample St. 12",
  market: "secondary",
  askingPrice: 97_000,
  currency: "USD",
  areaSqm: 62,
  rooms: 2,
  floor: 3,
  floorsTotal: 5,
  yearBuilt: 1968,
  condition: "cosmetic",
  buildingType: "soviet_brick",
};

export const COMPARE_PROPERTIES: Property[] = [
  { ...SAMPLE_PROPERTY, id: "A", address: "A · Frankivskyi" },
  {
    ...SAMPLE_PROPERTY,
    id: "B",
    address: "B · Sykhivskyi",
    districtId: "sykhivskyi",
    askingPrice: 91_500,
    areaSqm: 54,
    floor: 7,
    floorsTotal: 9,
    yearBuilt: 2012,
    condition: "good",
    buildingType: "modern",
  },
  {
    ...SAMPLE_PROPERTY,
    id: "C",
    address: "C · Halytskyi",
    districtId: "halytskyi",
    askingPrice: 69_000,
    areaSqm: 48,
    floor: 3,
    floorsTotal: 4,
    yearBuilt: 1905,
    condition: "needs_renovation",
    buildingType: "historic",
  },
];

const ASOF = "2026-10";
const repair = (
  low: number,
  high: number,
  uk: string,
  en: string,
  confidence: number,
): RepairEstimate => ({
  low,
  high,
  currency: "USD",
  assumption: { uk, en },
  sourceId: "repair-price-list",
  confidence,
  asOf: ASOF,
});

export const SAMPLE_ISSUES: InspectionIssue[] = [
  {
    id: "i1",
    sectionId: "electrical",
    severity: "red",
    title: { uk: "Електрощит і проводка потребують заміни", en: "Electrical panel and wiring need replacement" },
    explanation: {
      uk: "Алюмінієва проводка 1968 року, щит без УЗО, автомати різних поколінь. Ризик перегріву й пожежі при сучасному навантаженні (бойлер, пральна, духовка).",
      en: "1968 aluminium wiring, panel without RCD, mixed-generation breakers. Overheating and fire risk under modern loads (boiler, washer, oven).",
    },
    urgency: "immediate",
    repair: repair(1800, 3200, "Новий щит з УЗО + заміна проводки у кухні та санвузлі; решта кімнат — за потреби.", "New panel with RCD + rewiring kitchen and bathroom; other rooms optional.", 0.55),
    specialist: "electrician",
    negotiation: "high",
    photos: [],
  },
  {
    id: "i2",
    sectionId: "moisture",
    severity: "yellow",
    title: { uk: "Конденсат і цвіль в куті північної стіни", en: "Condensation and mold in north-wall corner" },
    explanation: {
      uk: "Вологість 22% біля вікна проти 9% по кімнаті; ознаки містка холоду. Потрібне утеплення відкосів/стіни та вентиляція.",
      en: "22% moisture reading near the window vs 9% room average; signs of a thermal bridge. Needs insulation of reveals/wall and ventilation.",
    },
    urgency: "within_year",
    repair: repair(400, 1100, "Обробка від цвілі, утеплення відкосів, припливні клапани.", "Mold treatment, reveal insulation, trickle vents.", 0.5),
    specialist: "inspector",
    negotiation: "medium",
    photos: [],
  },
  {
    id: "i3",
    sectionId: "plumbing",
    severity: "yellow",
    title: { uk: "Сталеві стояки та низький тиск", en: "Steel risers and low water pressure" },
    explanation: {
      uk: "Стояки сталеві, місцями корозія; тиск на кухні нижче норми. Стояки — зона загального майна: узгодити з ОСББ/управителем.",
      en: "Steel risers with local corrosion; below-normal pressure at the kitchen. Risers are common property: coordinate with the HOA/manager.",
    },
    urgency: "within_year",
    repair: repair(600, 1500, "Заміна підводки в квартирі; стояки — окремо, за рішенням ОСББ.", "Replace in-flat branches; risers separately, by HOA decision.", 0.45),
    specialist: "plumber",
    negotiation: "medium",
    photos: [],
  },
  {
    id: "i4",
    sectionId: "windows",
    severity: "yellow",
    title: { uk: "Зношене ущільнення двох вікон", en: "Worn sealing on two windows" },
    explanation: {
      uk: "Продування по периметру, втрата герметичності склопакетів. Теплові втрати взимку.",
      en: "Perimeter drafts and failed double-glazing seals. Winter heat loss.",
    },
    urgency: "monitor",
    repair: repair(700, 1400, "Заміна 2 вікон стандартного розміру.", "Replace 2 standard-size windows.", 0.6),
    specialist: "inspector",
    negotiation: "low",
    photos: [],
  },
  {
    id: "i5",
    sectionId: "structure",
    severity: "green",
    title: { uk: "Активних тріщин не виявлено", en: "No active cracks found" },
    explanation: {
      uk: "Лише поверхневі тріщини штукатурки; ознак деформацій перекриттів немає. Висновок про несучі конструкції — тільки за інженером.",
      en: "Surface plaster cracks only; no slab deformation observed. Conclusions about load-bearing structure belong to an engineer.",
    },
    urgency: "monitor",
    repair: null,
    specialist: "engineer",
    negotiation: "none",
    photos: [],
  },
  {
    id: "i6",
    sectionId: "common",
    severity: "yellow",
    title: { uk: "Сліди протікання даху у під'їзді", en: "Roof-leak traces in the stairwell" },
    explanation: {
      uk: "Підтікання на верхніх сходових площадках. Квартира на 3-му поверсі, але стан даху впливає на майбутні внески ОСББ.",
      en: "Water traces on the upper landings. Flat is on floor 3, but roof condition affects future HOA contributions.",
    },
    urgency: "within_year",
    repair: null,
    specialist: "inspector",
    negotiation: "low",
    photos: [],
  },
  {
    id: "i7",
    sectionId: "renovation",
    severity: "green",
    title: { uk: "Якість косметичного ремонту прийнятна", en: "Cosmetic renovation quality acceptable" },
    explanation: {
      uk: "Геометрія стін і підлоги в межах допуску, плитка без пустот. Приховані роботи не оцінювались.",
      en: "Wall and floor geometry within tolerance, tile without voids. Concealed work not assessed.",
    },
    urgency: "monitor",
    repair: null,
    specialist: "inspector",
    negotiation: "none",
    photos: [],
  },
];

const SRC = "drrp";
const note = (uk: string, en: string) => ({ uk, en });
export const SAMPLE_LEGAL: LegalCheck[] = [
  { id: "ownership", status: "green", kind: "FACT", sourceId: SRC, requiresProfessionalReview: true, note: note("Один власник, підстава — договір купівлі-продажу.", "Single owner, title by sale contract.") },
  { id: "encumbrances", status: "green", kind: "FACT", sourceId: SRC, requiresProfessionalReview: true },
  { id: "mortgage", status: "green", kind: "FACT", sourceId: SRC, requiresProfessionalReview: true },
  { id: "restrictions", status: "green", kind: "FACT", sourceId: SRC, requiresProfessionalReview: true },
  { id: "redevelopment", status: "yellow", kind: "INFERENCE", sourceId: "inspection", requiresProfessionalReview: true, note: note("Планування на місці не збігається з технічним паспортом (кухня/лоджія). Потрібна перевірка легалізації.", "On-site layout differs from the technical passport (kitchen/loggia). Legalization must be verified.") },
  { id: "land_plot", status: "green", kind: "FACT", sourceId: "land-cadastre", requiresProfessionalReview: true },
];
