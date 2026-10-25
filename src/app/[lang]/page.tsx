import { notFound } from "next/navigation";
import { DecisionStory, type StoryData } from "@/components/marketing/decision-story";
import { Hero } from "@/components/marketing/hero";
import { CityPanel, Dossier, Faq, FinalCta, Honesty, KnowMore, PackagesTeaser } from "@/components/marketing/sections";
import { WorkCycle } from "@/components/marketing/work-cycle";
import { XraySection } from "@/components/marketing/xray-section";
import { isLang, getDictionary } from "@/i18n";
import { sampleReport } from "@/lib/report-service";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);

  // The story uses the real sample-report computation, not hand-typed numbers.
  const s = sampleReport();
  const v = s.valuation;
  const story: StoryData | null =
    v.status === "ok" && s.negotiation && s.issues && s.repairs
      ? {
          ask: s.property.askingPrice,
          areaSqm: s.property.areaSqm,
          rooms: s.property.rooms ?? 0,
          floor: `${s.property.floor}/${s.property.floorsTotal}`,
          year: s.property.yearBuilt ?? 0,
          fairLow: v.fairLow,
          fairHigh: v.fairHigh,
          fairMid: v.fairMid,
          comps: v.used.length,
          confidencePct: Math.round(v.confidence.overall * 100),
          issues: [...s.issues]
            .filter((i) => i.severity !== "green")
            .sort((a, b) => (a.severity === "red" ? -1 : b.severity === "red" ? 1 : 0))
            .slice(0, 4)
            .map((i) => ({ sev: i.severity, title: i.title, low: i.repair?.low, high: i.repair?.high })),
          repairsLow: s.repairs.low,
          repairsHigh: s.repairs.high,
          legal: s.legal.map((l) => ({ id: l.id, status: l.status })),
          opening: s.negotiation.opening,
          walkAway: s.negotiation.walkAway,
          currency: v.currency,
        }
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: dict.meta.siteName, description: dict.meta.description, slogan: dict.brand.tagline },
      {
        "@type": "FAQPage",
        mainEntity: dict.home.faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero />
      <KnowMore />
      <WorkCycle />
      {story && <DecisionStory data={story} />}
      <XraySection />
      <Dossier />
      <Honesty />
      <CityPanel />
      <PackagesTeaser />
      <Faq />
      <FinalCta />
    </>
  );
}
