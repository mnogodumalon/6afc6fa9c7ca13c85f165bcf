/**
 * Umfrage abschließen — 3-Schritt-Wizard.
 * Steps: 1) Offene Umfrage wählen → 2) Finalen Termin aus den Vorschlägen dieser Umfrage wählen → 3) Prüfen & Umfrage schließen.
 * Reads: umfragen, terminvorschlaege. Writes: umfragen (finaler_termin, status = geschlossen — updates the picked record).
 * Composes: IntentWizardShell, EntitySelectStep, SummaryStep, SuccessStep (flow hook useUmfrageAbschliessenFlow).
 */
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldDate, fieldLookup, fieldRef, fieldText } from '@/lib/journey';
import { useUmfrageAbschliessenFlow } from '@/lib/journey/flows/UmfrageAbschliessen';
import { tx } from '@/i18n';

function dateTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy HH:mm');
  } catch {
    return iso;
  }
}

export default function UmfrageAbschliessenPage() {
  const [step, setStep] = useState(1);
  const [umfrageId, setUmfrageId] = useState<string | null>(null);

  const flow = useUmfrageAbschliessenFlow({
    steps: { umfragen: 1, finaler_termin: 2 },
    items: {
      umfragen: r => ({
        id: r.id,
        title: fieldText(r, 'titel'),
        subtitle: fieldText(r, 'ort') || undefined,
        status: fieldLookup(r, 'status') ?? undefined,
      }),
      finaler_termin: r => {
        const von = dateTime(fieldDate(r, 'beginn'));
        const bis = dateTime(fieldDate(r, 'ende'));
        return { id: r.id, title: von, subtitle: bis ? tx`bis ${bis}` : undefined };
      },
    },
    where: {
      umfragen: r => fieldLookup(r, 'status')?.key === 'offen',
      finaler_termin: r => !umfrageId || fieldRef(r, 'umfrage') === umfrageId,
    },
  });

  const pickedId = flow.targets.umfragen?.record?.id ?? null;
  useEffect(() => {
    setUmfrageId(pickedId);
  }, [pickedId]);

  return (
    <IntentWizardShell
      title={tx('Umfrage abschließen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Finalen Termin festlegen und die Umfrage schließen.'),
        needs: [tx('Eine offene Umfrage mit Terminvorschlägen')],
      }}
    >
      <WizardStep label={tx('Umfrage')} description={tx('Welche offene Umfrage willst du abschließen?')}>
        <EntitySelectStep
          {...flow.picks.umfragen.select}
          {...flow.pick('umfragen')}
          avatar="none"
          searchPlaceholder={tx('Titel oder Ort …')}
          emptyText={tx('Es gibt keine offene Umfrage.')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Termin')}
        description={tx('Welcher Terminvorschlag wird der finale Termin?')}
        needs={['umfragen']}
      >
        <EntitySelectStep
          {...flow.picks.finaler_termin.select}
          {...flow.pick('finaler_termin')}
          avatar="none"
          create={false}
          emptyText={tx('Für diese Umfrage gibt es keine Terminvorschläge.')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Stimmt alles? Danach ist die Umfrage geschlossen.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Geschlossen') }]}
            whatHappensNext={tx('Der finale Termin wird in der Umfrage gespeichert und die Umfrage geschlossen.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          undo={flow.undo}
          actions={{ copy: false, print: false }}
          next={[
            { label: tx('Weitere Umfrage abschließen'), onClick: () => flow.reset() },
            { label: tx('Neue Umfrage anlegen'), href: '#/intents/umfrage-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Du kannst die Umfrage über „Rückgängig“ wieder öffnen.')}
        />
      )}
    </IntentWizardShell>
  );
}
