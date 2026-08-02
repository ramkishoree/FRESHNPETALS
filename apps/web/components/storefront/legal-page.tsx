/**
 * Privacy and Terms are the only content pages left on the site, and the
 * `static_pages` CMS table that used to back them was dropped along with
 * the rest of the admin CMS. Their copy now lives in the two page files
 * that render through here — editing it is a code change, which is the
 * accepted trade for removing the CMS.
 */
export function LegalPage({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <div className="container-brand max-w-3xl space-y-4 py-10">
      <h1 className="text-h2 text-foreground font-bold">{title}</h1>
      {paragraphs.map((text, index) => (
        <p key={index} className="text-body text-foreground whitespace-pre-line">
          {text}
        </p>
      ))}
    </div>
  );
}
