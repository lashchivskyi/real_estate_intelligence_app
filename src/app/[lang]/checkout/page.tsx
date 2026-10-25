import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { CHECKOUT_PACKAGES, getPackage, type CheckoutPackageId } from "@/config/packages";
import { apartmentInputSchema } from "@/domain/property/types";
import { getCityOrDefault } from "@/domain/location/registry";
import { formatMoney } from "@/i18n";
import { paramsToInput } from "@/lib/report-service";
import { getDictionary, isLang } from "@/i18n";
import { availability } from "@/server/payments";

export const metadata: Metadata = { robots: { index: false } };

export default async function CheckoutPage({ params, searchParams }: PageProps<"/[lang]/checkout">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const requested = getPackage(String(sp.package ?? "full"));
  const pkg = requested?.priceUah && (CHECKOUT_PACKAGES as readonly string[]).includes(requested.id) ? requested : getPackage("full")!;
  const options = CHECKOUT_PACKAGES.map((id) => ({ id, uah: getPackage(id)?.priceUah as number }));
  // Order for a specific property (coming from its report): show what it's for.
  const reportQuery = typeof sp.r === "string" ? sp.r : "";
  const prop = reportQuery ? apartmentInputSchema.safeParse(paramsToInput(Object.fromEntries(new URLSearchParams(reportQuery)))) : null;
  const objectLabel = prop?.success
    ? [prop.data.address, getCityOrDefault(prop.data.cityId).names[lang], `${prop.data.areaSqm} м²`, formatMoney(prop.data.askingPrice, getCityOrDefault(prop.data.cityId).currency, lang)].filter(Boolean).join(" · ")
    : null;
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <h1 className="display text-4xl sm:text-5xl">{dict.checkout.title}</h1>
      <p className="mt-3 max-w-2xl text-ink2">{dict.checkout.subtitle}</p>
      <div className="mt-10">
        <CheckoutView
          initial={pkg.id as CheckoutPackageId}
          options={options}
          providers={availability()}
          cancelled={sp.cancelled === "1"}
          reportQuery={reportQuery}
          objectLabel={objectLabel}
        />
      </div>
    </div>
  );
}
