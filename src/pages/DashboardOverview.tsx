// layout-opt-out: none — composed via DashboardGrid. Hand-built survey cards: KanbanWidget rejected (only 2 stages; each card must carry per-record link/QR + vote summary which no card slot covers).
import { useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { IconPlus, IconMapPin, IconCircleCheck, IconTrophy, IconUsers, IconCalendarEvent, IconClipboardList, IconPencil } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor, countOf } from '@/config/plan';
import { extractRecordId } from '@/services/livingAppsService';
import { lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen } from '@/lib/polish';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { submissionsOf, topOne } from '@/lib/journey';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { RecordDoorLink } from '@/components/widgets/RecordDoorLink';
import { Button } from '@/components/ui/button';

type Filter = 'all' | 'open' | 'undecided' | 'new';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { umfragen, terminvorschlaege, antworten } = data;
  const clock = useClock();
  const [filter, setFilter] = useState<Filter>('all');

  // The overlay footer offers the survey's next step: set the final date / close (owned by the flow)
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'umfragen') return undefined;
      if (lookupKey(top.record.fields.status) === 'geschlossen') return undefined;
      const go = flowActionFor('umfragen', 'finaler_termin', top.record.record_id);
      return go ? { label: tx('Finalen Termin festlegen'), onClick: go } : undefined;
    },
  });

  const fmt = (iso: string | undefined | null, pattern: string) => {
    if (!iso) return '';
    try { return format(parseISO(iso), pattern, { locale: dateFnsLocale() }); } catch { return ''; }
  };

  const rows = useMemo(() => {
    const since = subDays(clock, 7).getTime();
    return umfragen.map(u => {
      const id = u.record_id;
      const termine = terminvorschlaege
        .filter(t => extractRecordId(t.fields.umfrage) === id)
        .sort((a, b) => (a.fields.beginn ?? '').localeCompare(b.fields.beginn ?? ''));
      const antw = antworten.filter(a => extractRecordId(a.fields.umfrage) === id);
      const subs = submissionsOf(antw, { names: ['teilnehmer_vorname', 'teilnehmer_nachname'] });
      const counts = (tid: string, key: string) =>
        antw.filter(a => extractRecordId(a.fields.terminvorschlag) === tid && lookupKey(a.fields.antwort) === key).length;
      const top = topOne(termine, [t => counts(t.record_id, 'ja'), t => counts(t.record_id, 'vielleicht')], t => t.fields.beginn);
      const newSubs = subs.filter(s => s.createdAt && Date.parse(s.createdAt) >= since);
      const finalId = extractRecordId(u.fields.finaler_termin);
      const finalTermin = finalId ? termine.find(t => t.record_id === finalId) : undefined;
      const closed = lookupKey(u.fields.status) === 'geschlossen';
      return {
        u, termine, subs, newSubs, closed, finalTermin, top,
        topYes: top ? counts(top.record_id, 'ja') : 0,
        undecided: !closed && !finalId,
      };
    }).sort((a, b) => Number(a.closed) - Number(b.closed) || (b.u.createdat ?? '').localeCompare(a.u.createdat ?? ''));
  }, [umfragen, terminvorschlaege, antworten, clock]);

  const openRows = rows.filter(r => !r.closed);
  const undecidedRows = rows.filter(r => r.undecided);
  const newRows = rows.filter(r => r.newSubs.length > 0);
  const newCount = newRows.reduce((n, r) => n + r.newSubs.length, 0);
  const readyRows = undecidedRows.filter(r => r.subs.length > 0);

  const visible = rows.filter(r =>
    filter === 'open' ? !r.closed
    : filter === 'undecided' ? r.undecided
    : filter === 'new' ? r.newSubs.length > 0
    : true);

  const toggle = (f: Filter) => setFilter(cur => (cur === f ? 'all' : f));

  const recentSubs = rows
    .flatMap(r => r.subs.map(s => ({ r, s })))
    .filter(x => x.s.createdAt)
    .sort((a, b) => (b.s.createdAt ?? '').localeCompare(a.s.createdAt ?? ''));

  const contextLine = (() => {
    if (rows.length === 0) return tx('Lege deine erste Umfrage an und teile den Link.');
    if (newRows.length > 0) {
      const who = namen(recentSubs.slice(0, 3).map(x => x.s.name.split(' ')[0]));
      return tx`${who} haben zuletzt abgestimmt — bei ${namen(newRows.map(r => r.u.fields.titel ?? ''))} gibt es Neues.`;
    }
    if (readyRows.length > 0) return tx`${namen(readyRows.map(r => r.u.fields.titel ?? ''))} wartet auf deinen finalen Termin.`;
    if (openRows.length > 0) return tx`${namen(openRows.map(r => r.u.fields.titel ?? ''))} läuft noch — teile den Link, um Antworten zu sammeln.`;
    return tx('Alle Umfragen sind abgeschlossen.');
  })();

  const create = crud.umfragen.canWrite ? (
    <Button onClick={() => crud.umfragen.openCreate({ status: 'offen' })} className="w-full sm:w-auto">
      <IconPlus size={16} className="shrink-0" />{tx('Neue Umfrage')}
    </Button>
  ) : null;

  const cards = visible.map(({ u, termine, subs, newSubs, closed, finalTermin, top, topYes }) => {
    const go = closed ? null : flowActionFor('umfragen', 'finaler_termin', u.record_id);
    return (
      <div key={u.record_id} className="rounded-xl border bg-card p-4 overflow-hidden flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={() => crud.umfragen.openDetail(u)} className="min-w-0 text-left">
            <div className="font-semibold truncate">{u.fields.titel}</div>
            {u.fields.ort && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <IconMapPin size={12} className="shrink-0" />{u.fields.ort}
              </div>
            )}
          </button>
          <span className={`text-xs font-medium shrink-0 ${closed ? 'text-muted-foreground' : 'text-emerald-600'}`}>
            {closed ? tx('Geschlossen') : tx('Offen')}
          </span>
        </div>
        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1"><IconCalendarEvent size={14} className="shrink-0" />{countOf('terminvorschlaege', termine.length, appLabel('terminvorschlaege'))}</span>
          <span className="flex items-center gap-1"><IconUsers size={14} className="shrink-0" />{countOf('antworten', subs.length, appLabel('antworten'))}</span>
          {newSubs.length > 0 && <span className="font-medium text-primary">{tx`${newSubs.length} neu`}</span>}
        </div>
        {finalTermin ? (
          <div className="text-sm flex items-center gap-1.5 min-w-0">
            <IconCircleCheck size={16} className="shrink-0 text-emerald-600" />
            <span className="truncate">{tx('Final')}: <b>{fmt(finalTermin.fields.beginn, 'EEE dd.MM. HH:mm')}</b></span>
          </div>
        ) : top ? (
          <div className="text-sm flex items-center gap-1.5 min-w-0">
            <IconTrophy size={16} className="shrink-0 text-amber-500" />
            <span className="truncate">{tx('Führend')}: <b>{fmt(top.fields.beginn, 'EEE dd.MM. HH:mm')}</b> · {tx`${topYes} Ja`}</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{tx('Noch keine Ja-Stimmen')}</div>
        )}
        <RecordDoorLink page="termin-abstimmen" recordId={u.record_id} />
        <div className="flex flex-wrap gap-2">
          {go && (
            <Button size="sm" onClick={go}>
              <IconCircleCheck size={14} className="shrink-0" />{tx('Termin festlegen')}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => crud.umfragen.openDetail(u)}>
            <IconClipboardList size={14} className="shrink-0" />{tx('Antworten ansehen')}
          </Button>
          {crud.umfragen.canWrite && (
            <Button size="sm" variant="ghost" onClick={() => crud.umfragen.openEdit(u)}>
              <IconPencil size={14} className="shrink-0" />{tx('Bearbeiten')}
            </Button>
          )}
        </div>
      </div>
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{contextLine}</p>
        </div>
        {create}
      </div>

      <DashboardGrid
        variant="wide"
        kpis={rows.length > 0 ? (
          <StatStrip>
            <StatStripItem title={tx('Offene Umfragen')} value={openRows.length}
              onClick={() => toggle('open')} active={filter === 'open'} />
            <StatStripItem title={tx('Ohne finalen Termin')} value={undecidedRows.length}
              tone={undecidedRows.length > 0 ? 'warning' : 'default'}
              onClick={() => toggle('undecided')} active={filter === 'undecided'} />
            <StatStripItem title={tx('Neue Antworten (7 Tage)')} value={newCount}
              tone={newCount > 0 ? 'primary' : 'default'}
              onClick={() => toggle('new')} active={filter === 'new'} />
          </StatStrip>
        ) : undefined}
        primary={
          rows.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center space-y-3">
              <IconClipboardList size={48} className="mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{tx('Noch keine Umfrage — lege Terminvorschläge an und teile den Link.')}</p>
              {create}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{tx('Keine Umfrage in dieser Auswahl.')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{cards}</div>
          )
        }
        aside={
          rows.length === 0 ? undefined : (
            <>
              <WorkList
                title={tx('Neue Antworten')}
                items={recentSubs.slice(0, 8).map(({ r, s }) => ({
                  id: r.u.record_id + ':' + s.key,
                  title: s.label,
                  secondLine: <span className="text-muted-foreground">{r.u.fields.titel} · {fmt(s.createdAt, 'dd.MM. HH:mm')}</span>,
                }))}
                onItemClick={id => {
                  const rec = umfragen.find(x => x.record_id === id.split(':')[0]);
                  if (rec) crud.umfragen.openDetail(rec);
                }}
                empty={{ text: tx('Noch keine Antworten — teile den Link deiner Umfrage.') }}
              />
              <WorkList
                title={tx('Bereit zum Festlegen')}
                items={readyRows.map(r => {
                  const go = flowActionFor('umfragen', 'finaler_termin', r.u.record_id);
                  return {
                    id: r.u.record_id,
                    title: r.u.fields.titel ?? '',
                    secondLine: <span className="text-muted-foreground">{countOf('antworten', r.subs.length, appLabel('antworten'))}</span>,
                    action: go ? { label: tx('Festlegen'), onClick: go } : undefined,
                  };
                })}
                onItemClick={id => {
                  const rec = umfragen.find(x => x.record_id === id);
                  if (rec) crud.umfragen.openDetail(rec);
                }}
                empty={{ text: tx('Nichts offen — alle Umfragen mit Antworten sind entschieden.') }}
              />
            </>
          )
        }
      />
      {crud.surfaces}
    </div>
  );
}
