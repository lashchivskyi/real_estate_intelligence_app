import type { SectionId } from "@/domain/inspection";
import type { Lang } from "@/domain/location/types";

type VisualCopy = { focus: string; solution: string };
export const inspectionVisuals: Record<Lang, Record<SectionId, VisualCopy>> = {
  uk: {
    electrical: { focus: "Виділена зона — щит і проводка: старі з’єднання можуть перегріватися під навантаженням.", solution: "Приклад рішення: заміна пошкоджених ліній і щита із захисним відключенням. Обсяг визначає електрик після вимірювань." },
    moisture: { focus: "Виділена зона — холодна ділянка біля вікна: тут може накопичуватися волога й утворюватися цвіль.", solution: "Приклад рішення: усунути джерело вологи, утеплити холодну ділянку й забезпечити вентиляцію. Самого фарбування недостатньо." },
    plumbing: { focus: "Виділена зона — зношена труба та з’єднання: корозія може зменшувати напір і спричиняти протікання.", solution: "Приклад рішення: заміна зношеної ділянки та перевірка герметичності. Роботи зі спільним стояком узгоджують з управителем." },
    windows: { focus: "Виділена зона — периметр стулки: через зношений ущільнювач проходить холодне повітря.", solution: "Приклад рішення: нове ущільнення й регулювання стулки; за пошкодження склопакета може знадобитися заміна вікна." },
    structure: { focus: "Виділена зона — поверхня стіни. Поверхневі тріщини оздоблення та стан несучої конструкції оцінюють окремо.", solution: "Подальша дія: інженер визначає характер тріщин і потребу в спостереженні або ремонті." },
    common: { focus: "Виділена зона — покрівля над сходовою кліткою: вода може потрапляти всередину через негерметичні стики.", solution: "Приклад рішення: знайти й відновити негерметичну ділянку покрівлі. Роботи та спільні внески узгоджують з управителем." },
    renovation: { focus: "Виділена зона — оздоблення стіни й підлоги. Перевіряють рівність, зчеплення плитки та видимі дефекти.", solution: "Подальша дія: перевірити зчеплення й геометрію; ремонтувати лише підтверджені дефекти. Приховані роботи потребують окремого огляду." },
    heating: { focus: "Виділена зона — опалювальний прилад і повітрообмін: нерівномірний нагрів може знижувати комфорт.", solution: "Приклад рішення: обслуговування й балансування опалення, перевірка вентиляції профільним спеціалістом." },
    energy: { focus: "Виділена зона — резервне живлення: оцінюють, які прилади зможуть працювати під час відключення.", solution: "Приклад рішення: підібрати потужність і ємність резерву під потрібні прилади. Підключення та захист перевіряє електрик." },
  },
  en: {
    electrical: { focus: "Highlighted area: panel and wiring. Ageing connections may overheat under load.", solution: "Example remedy: replace damaged circuits and fit a panel with residual-current protection. An electrician determines the scope after testing." },
    moisture: { focus: "Highlighted area: a cold surface near the window where moisture and mould may develop.", solution: "Example remedy: remove the moisture source, insulate the cold area and improve ventilation. Painting alone is insufficient." },
    plumbing: { focus: "Highlighted area: worn pipe and connection. Corrosion may reduce water pressure and cause leaks.", solution: "Example remedy: replace the worn section and test for leaks. Coordinate shared riser work with the building manager." },
    windows: { focus: "Highlighted area: window perimeter. A worn seal lets cold air into the room.", solution: "Example remedy: renew seals and adjust the sash. Failed glazing may require window replacement." },
    structure: { focus: "Highlighted area: wall surface. Cosmetic cracks and the load-bearing structure require separate assessment.", solution: "Next step: an engineer determines the nature of cracks and whether monitoring or repairs are needed." },
    common: { focus: "Highlighted area: roof above the stairwell. Water may enter through unsealed joints.", solution: "Example remedy: locate and repair the leaking roof area. Coordinate shared work and contributions with the manager." },
    renovation: { focus: "Highlighted area: wall and floor finishes. Checks cover level surfaces, tile adhesion and visible defects.", solution: "Next step: check adhesion and alignment; repair confirmed defects. Concealed work needs a separate inspection." },
    heating: { focus: "Highlighted area: radiator and airflow. Uneven heating may reduce comfort.", solution: "Example remedy: have a specialist service and balance the heating and check ventilation." },
    energy: { focus: "Highlighted area: backup power. Check which appliances can operate during an outage.", solution: "Example remedy: size backup capacity for the required appliances. An electrician checks connections and protection." },
  },
};
