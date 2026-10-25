import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { CityProvider, I18nProvider } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LANGS, getDictionary, isLang } from "@/i18n";
import { nbuRate } from "@/server/sources/nbu";
import { ContactDock } from "@/components/contact-dock";

const sans = Inter_Tight({ subsets: ["latin", "cyrillic"], variable: "--font-sans-ui", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin", "cyrillic"], variable: "--font-serif-display", display: "swap", weight: ["400", "500", "600"] });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono-data", display: "swap" });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
};

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = await getDictionary(lang);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: { default: dict.meta.title, template: `%s · ${dict.meta.siteName}` },
    description: dict.meta.description,
    alternates: { languages: { uk: "/uk", en: "/en" } },
    openGraph: { title: dict.meta.title, description: dict.meta.description, type: "website", locale: lang === "uk" ? "uk_UA" : "en_GB" },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);
  // Official NBU rates for the currency selector (cached 6 h; the page still renders if NBU is down).
  const [usd, eur] = await Promise.all([nbuRate("USD"), nbuRate("EUR")]);
  const rates = { ...(usd ? { USD: usd.rate } : {}), ...(eur ? { EUR: eur.rate } : {}) };
  return (
    <html lang={lang} className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <I18nProvider lang={lang} dict={dict} rates={rates}>
          <CityProvider>
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter lang={lang} dict={dict} />
            <ContactDock />
          </CityProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
