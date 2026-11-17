/**
 * Umfrage anlegen — 3-Schritt-Wizard.
 * Steps: 1) Titel, Beschreibung, Ort → 2) Terminvorschläge erfassen → 3) Prüfen & anlegen.
 * Reads: —. Writes: umfragen (status offen), terminvorschlaege (eine pro Eintrag, mit der Umfrage verknüpft).
 * Composes: IntentWizardShell, Bound, ListEntries, StepNav, SummaryStep, SuccessStep, PublicPageQr.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { Bound } from '@/components/blocks/Bound';
import { ListEntries } from '@/components/blocks/ListEntries';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { PublicPageQr, usePublicPageLink } from '@/components/widgets/PublicPageQr';
import { useUmfrageAnlegenFlow } from '@/lib/journey/flows/UmfrageAnlegen';
import { optionsOf } from '@/lib/journey';
import { tx } from '@/i18n';

function ShareBox({ recordId }: { recordId: string }) {
  const { link } = usePublicPageLink('umfragen', recordId);
  if (!link) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-3 overflow-hidden rounded-2xl bg-card p-4 shadow-lg">
      <PublicPageQr entity="umfragen" recordId={recordId} size={180} />
      <p className="min-w-0 break-all text-center text-xs text-muted-foreground">{tx('Oder öffne:')} {link}</p>
    </div>
  );
}

export default function UmfrageAnlegenPage() {
  const [step, setStep] = useState(1);
  const flow = useUmfrageAnlegenFlow({
    steps: { titel: 1, beschreibung: 1, ort: 1, beginn: 2, ende: 2 },
  });
  const offenLabel = optionsOf('umfragen', 'status').find(o => o.key === 'offen')?.label ?? 'offen';

  return (
    <IntentWizardShell
      title={tx('Umfrage anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Lege eine Umfrage an und schlage gleich mehrere Termine vor.'),
        needs: [tx('Titel der Umfrage'), tx('Mögliche Termine mit Beginn und Ende')],
      }}
    >
      <WizardStep label={tx('Umfrage')} description={tx('Worum geht es und wo findet es statt?')}>
        <div className="space-y-4">
          <Bound form={flow.forms.umfragen} name="titel" />
          <Bound form={flow.forms.umfragen} name="beschreibung" />
          <Bound form={flow.forms.umfragen} name="ort" />
          <StepNav hideBack onNext={() => flow.validateStep(1)} nextStepLabel={tx('Terminvorschläge')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Terminvorschläge')} description={tx('Trage alle Termine ein, aus denen die Teilnehmenden wählen können.')}>
        <div className="space-y-4">
          <ListEntries list={flow.lists.terminvorschlaege}>
            <Bound form={flow.forms.terminvorschlaege} name="beginn" />
            <Bound form={flow.forms.terminvorschlaege} name="ende" />
          </ListEntries>
          <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: offenLabel }]}
            whatHappensNext={tx('Die Umfrage ist danach offen und bekommt ihren Link und QR-Code zum Teilen.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          facts={[
            { label: tx('Titel'), value: String(flow.submit.result.primary.fields.titel ?? '') },
            { label: tx('Status'), value: offenLabel },
          ]}
          whatHappensNext={tx('Teile den Link oder QR-Code, damit alle ihre Antworten abgeben können.')}
          next={[
            { label: tx('Finalen Termin festlegen'), href: '#/intents/umfrage-abschliessen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        >
          <ShareBox recordId={flow.submit.result.primary.id} />
        </SuccessStep>
      )}
    </IntentWizardShell>
  );
}
