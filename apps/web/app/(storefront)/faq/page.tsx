import { EmptyState } from '@/components/states/empty-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Ch.6 FAQ — global FAQs (entity_type/entity_id null). Native <details>/<summary> rather than adding a full Accordion primitive for one page. */
export default async function FaqPage() {
  const supabase = await createSupabaseServerClient();
  const { data: faqs } = await supabase
    .from('faqs')
    .select('id, question, answer')
    .eq('published', true)
    .is('entity_type', null)
    .order('sort_order', { ascending: true });

  return (
    <div className="container-brand max-w-3xl space-y-6 py-10">
      <h1 className="text-h2 text-foreground font-bold">Frequently asked questions</h1>

      {(faqs ?? []).length === 0 ? (
        <EmptyState title="No FAQs published yet" />
      ) : (
        <div className="divide-border divide-y">
          {(faqs ?? []).map((faq) => (
            <details key={faq.id} className="group py-4">
              <summary className="text-body text-foreground cursor-pointer font-medium marker:content-none">
                {faq.question}
              </summary>
              <p className="text-body text-muted-foreground mt-2">{faq.answer}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
