import type { NegotiationImpact, SectionId, Severity } from "@/domain/inspection";
import type { Lang } from "@/domain/location/types";

/**
 * The most common defects our inspections find behind a fresh cosmetic renovation (secondary market,
 * Soviet-era brick/panel stock). Illustrative content for the 3D "visible vs detected" story.
 * Repair ranges: internal uncalibrated price list, USD, labour + materials, one 18–20 m² room.
 */
export interface XrayFinding {
  id: "electrics" | "plaster" | "moisture" | "crack" | "window" | "ventilation" | "plumbing" | "floor";
  section: SectionId;
  severity: Exclude<Severity, "green">;
  title: Record<Lang, string>;
  how: Record<Lang, string>;
  pain: Record<Lang, string>;
  repair: { low: number; high: number };
  negotiation: NegotiationImpact;
  licensed?: boolean;
}

export const XRAY_FINDINGS: XrayFinding[] = [
  {
    id: "electrics",
    section: "electrical",
    severity: "red",
    title: { uk: "Алюмінієва проводка, щит без УЗО", en: "Aluminium wiring, panel without RCD" },
    how: { uk: "Відкриваємо щит, міряємо опір ізоляції, тепловізором шукаємо гарячі контакти.", en: "We open the panel, measure insulation resistance and look for hot contacts with a thermal camera." },
    pain: {
      uk: "Під новими шпалерами — проводка 1968 року. Бойлер + пральна + духовка = перегрів. Після покупки доведеться штробити свіжий ремонт за ваш кошт.",
      en: "1968 wiring behind new wallpaper. Boiler + washer + oven = overheating. After buying you'll be chasing the fresh walls open at your own cost.",
    },
    repair: { low: 1800, high: 3200 },
    negotiation: "high",
  },
  {
    id: "plaster",
    section: "renovation",
    severity: "yellow",
    title: { uk: "Відшарування штукатурки під фарбою", en: "Plaster delaminating under the paint" },
    how: { uk: "Простукування стін: глухий звук = порожнина. Позначаємо межі й площу.", en: "Tap test across the walls: a hollow sound means a void. We mark the area." },
    pain: {
      uk: "Пофарбовано поверх старої штукатурки, що вже відійшла від стіни. Повісите телевізор чи полиці — шматок впаде разом із ними.",
      en: "Painted over old plaster that has already come away from the wall. Hang a TV or shelves and a chunk comes down with them.",
    },
    repair: { low: 300, high: 900 },
    negotiation: "medium",
  },
  {
    id: "moisture",
    section: "moisture",
    severity: "yellow",
    title: { uk: "Вологість 22% і цвіль за шафою", en: "22% humidity and mould behind the wardrobe" },
    how: { uk: "Вологомір і тепловізор у холодних кутах, за меблями й біля вікон.", en: "Moisture meter and thermal camera in cold corners, behind furniture and near windows." },
    pain: {
      uk: "Перша зима: запах, чорні плями, алергія в дітей. Шафу в цей кут поставили не випадково.",
      en: "First winter: smell, black spots, kids' allergies. The wardrobe wasn't put in that corner by accident.",
    },
    repair: { low: 400, high: 1100 },
    negotiation: "medium",
  },
  {
    id: "crack",
    section: "structure",
    severity: "yellow",
    title: { uk: "Тріщина в стіні під шаром шпаклівки", en: "Wall crack hidden under filler" },
    how: { uk: "Огляд під боковим світлом, маяки/щупи на тріщину; висновок щодо несучих — тільки інженер.", en: "Raking light inspection and crack gauges; conclusions on load-bearing walls only by an engineer." },
    pain: {
      uk: "Тріщину зашпаклювали, але вона «працює» — за рік проступить знову. Якщо це осідання будинку, ремонт виходить за межі квартири.",
      en: "The crack was filled but it's still moving — it will show again within a year. If the building is settling, the fix goes beyond your flat.",
    },
    repair: { low: 200, high: 600 },
    negotiation: "medium",
    licensed: true,
  },
  {
    id: "window",
    section: "windows",
    severity: "yellow",
    title: { uk: "Місток холоду на відкосі вікна", en: "Cold bridge at the window reveal" },
    how: { uk: "Тепловізор при різниці температур, перевірка ущільнювачів і монтажного шва.", en: "Thermal camera with a temperature difference, seal and installation-joint check." },
    pain: {
      uk: "Тепловізор показує −3 °C на відкосі: конденсат, промерзання, вищі рахунки за опалення, ніж обіцяли.",
      en: "The thermal camera shows −3 °C on the reveal: condensation, freezing, higher heating bills than promised.",
    },
    repair: { low: 700, high: 1400 },
    negotiation: "low",
  },
  {
    id: "ventilation",
    section: "heating",
    severity: "yellow",
    title: { uk: "Вентиляція не тягне", en: "Ventilation has no draught" },
    how: { uk: "Анемометр або тест із димом біля решітки; перевірка, чи шахту не замуровано сусідами.", en: "Anemometer or smoke test at the grille; check that neighbours haven't blocked the shaft." },
    pain: {
      uk: "Без тяги волога з кухні й ванної лишається в квартирі — саме звідси цвіль і запітнілі вікна. Шахта спільна: лагодити доведеться через ОСББ.",
      en: "With no draught, moisture from the kitchen and bathroom stays inside — that's where the mould and fogged windows come from. The shaft is shared: fixing it goes through the HOA.",
    },
    repair: { low: 150, high: 500 },
    negotiation: "low",
  },
  {
    id: "plumbing",
    section: "plumbing",
    severity: "yellow",
    title: { uk: "Іржавий стояк у гіпсокартонному коробі", en: "Rusty riser inside the drywall box" },
    how: { uk: "Відкриваємо ревізійні люки, оглядаємо стояки й з'єднання, міряємо тиск.", en: "We open access hatches, inspect risers and joints, measure pressure." },
    pain: {
      uk: "Стояк підтікає за коробом. Затопите сусідів знизу — рахунок за їхній ремонт прийде вам.",
      en: "The riser leaks behind the box. Flood the neighbours below and their repair bill comes to you.",
    },
    repair: { low: 600, high: 1500 },
    negotiation: "medium",
  },
  {
    id: "floor",
    section: "renovation",
    severity: "yellow",
    title: { uk: "Перепад підлоги 2,4 см", en: "2.4 cm floor level difference" },
    how: { uk: "Лазерний нівелір по сітці точок у кожній кімнаті.", en: "Laser level over a grid of points in every room." },
    pain: {
      uk: "Ламінат поклали на нерівну основу: шафи хитаються, двері треба підрізати, через рік почнуться скрип і розходження швів.",
      en: "Laminate was laid on an uneven base: wardrobes wobble, doors need trimming, and within a year it creaks and the joints open.",
    },
    repair: { low: 900, high: 2200 },
    negotiation: "medium",
  },
];
