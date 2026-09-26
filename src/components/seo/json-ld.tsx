/**
 * Shared JSON-LD (structured data) renderer.
 *
 * `<` and `&` are escaped so no user-supplied string can close the script
 * element early or start an entity — XSS-safe by construction.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c").replace(/&/g, "\\u0026"),
      }}
    />
  );
}
