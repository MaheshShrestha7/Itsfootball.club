/** Server-rendered schema.org JSON-LD. The data includes text typed in by club admins (club names,
 *  article titles), so "<" is escaped to <: nothing inside can close the <script> element and
 *  inject markup, while JSON parsers still read the original character. */
export default function JsonLd({ data }: { data: object | null }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
