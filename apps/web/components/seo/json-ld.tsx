/**
 * Ch.16 structured data — SEO Specialist AI lists "Schema Generation" as
 * a capability, but nothing anywhere actually emitted any JSON-LD before
 * this. `JSON.stringify` already escapes quotes safely; the one
 * JSON-LD-specific risk is a `</script>` substring breaking out of the
 * tag, which `<` escaping (Next.js's own documented approach) closes.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
