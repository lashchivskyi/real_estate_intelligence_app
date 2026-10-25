// Geocodes city / neighbourhood names with Nominatim so adapter coordinates come from a source, not guesses.
// Usage: node scripts/geocode-places.mjs "Пасічна, Івано-Франківськ" "Трускавець"
// Respects the Nominatim usage policy: 1 request/second, identifying User-Agent.
const UA = process.env.GEOCODER_USER_AGENT ?? "Vidomo/0.2 (dev geocoding)";
for (const q of process.argv.slice(2)) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=ua&format=jsonv2&limit=1&accept-language=uk`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const [hit] = await res.json();
  console.log(JSON.stringify({ q, center: hit ? [+(+hit.lon).toFixed(4), +(+hit.lat).toFixed(4)] : null, type: hit?.addresstype, name: hit?.display_name }));
  await new Promise((r) => setTimeout(r, 1100));
}
