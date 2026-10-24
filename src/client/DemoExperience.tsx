import { useMemo, useState } from 'react';
import { applyEvent } from '../core/reducer';
import { evaluateSnapshot } from '../core/evaluator';
import { emptySnapshot, type Candidate, type DecisionSnapshot, type Fact, type Participant, type RoomEvent } from '../core/model';
import './styles.css';

type Language = 'es' | 'en';
type Phase = 'welcome' | 'room';
const base = import.meta.env.BASE_URL;

function makeInitialSnapshot(): DecisionSnapshot {
  let snapshot = emptySnapshot('aporia-sample-room', 'El after del meetup');
  const participants: Participant[] = [
    { id: 'jo', displayName: 'Jo' },
    { id: 'nati', displayName: 'Nati' },
    { id: 'cami', displayName: 'Cami' },
  ];
  const candidates: Candidate[] = [
    { id: 'plan-a', title: 'Plan A · La salida que nos encuentra', weekday: 6, startMinute: 1230, endMinute: 1320, priceCents: 1800000, currency: 'ARS', area: 'Villa Crespo', source: { kind: 'manual', ref: 'demo-fixture' } },
    { id: 'plan-b', title: 'Plan B · Viernes más temprano', weekday: 5, startMinute: 1260, endMinute: 1380, priceCents: 1500000, currency: 'ARS', area: 'Palermo', source: { kind: 'manual', ref: 'demo-fixture' } },
  ];
  let revision = 0;
  const append = (type: string, payload: unknown) => {
    const event: RoomEvent = { id: `demo-event-${revision + 1}`, roomId: snapshot.roomId, revision: revision + 1, actorId: 'demo', type, payload, createdAt: '2026-10-24T20:00:00.000Z' };
    snapshot = applyEvent(snapshot, event);
    revision += 1;
  };
  participants.forEach(participant => append('participant.added', participant));
  const facts: Fact[] = [
    { id: 'fact-jo-time', kind: 'availability', participantId: 'jo', value: { weekday: 6, startMinute: 1200, endMinute: 1380 }, sourceProposalId: 'demo', confirmedBy: 'jo', confirmedAt: '2026-10-24T20:00:00.000Z' },
    { id: 'fact-nati-budget', kind: 'budget_max', participantId: 'nati', value: { maxCents: 2200000, currency: 'ARS' }, sourceProposalId: 'demo', confirmedBy: 'nati', confirmedAt: '2026-10-24T20:00:00.000Z' },
    { id: 'fact-cami-area', kind: 'area_preference', participantId: 'cami', value: { area: 'Villa Crespo' }, sourceProposalId: 'demo', confirmedBy: 'cami', confirmedAt: '2026-10-24T20:00:00.000Z' },
  ];
  facts.forEach(fact => append('fact.confirmed', fact));
  candidates.forEach(candidate => append('candidate.added', candidate));
  snapshot.evaluation = evaluateSnapshot(snapshot);
  return snapshot;
}

const copy = {
  es: {
    eyebrow: 'RECORRIDO DE MUESTRA · SIN GEMINI EN VIVO', title: 'La próxima juntada no debería perderse en el chat.', lede: 'Mirá cómo APORIA convierte mensajes sueltos en un plan que el grupo puede revisar.', start: 'Entrar a la sala de muestra', back: 'Volver a APORIA', recording: 'Abrir el flujo real para grabar', sample: 'Escenario ficticio. Todo este recorrido sucede en tu navegador; no consulta Gemini ni guarda una sala real.',
    room: 'El after del meetup', code: 'Número de muestra', observer: 'Estás mirando como observadora', chat: 'Lo que aparece en el grupo', m1: 'Jo: el sábado salgo del meetup a las 20.', m2: 'Nati: me sumo si no se va mucho de presupuesto.', m3: 'Cami: por Villa Crespo me queda cómodo.', people: 'Ya están en la sala', join: 'Sumarme como participante', name: 'Cómo querés aparecer', placeholder: 'Tu nombre', joined: 'Ya estás en el grupo', contribution: 'Lo que ya tenías', contributionText: 'Una captura con disponibilidad y una preferencia alimentaria.', useImage: 'Ver captura de ejemplo', imageAlt: 'Captura ficticia de un mensaje: el sábado puedo después de las 20. Soy vegetariana.', sampleImage: 'APORTE DE MUESTRA', simulate: 'Ver lectura de ejemplo', simulated: 'Lectura preparada para esta demo · no es una respuesta de Gemini', claim1: 'El sábado, después de las 20', claim2: 'Restricción alimentaria: vegetariana', confirm: 'Confirmar mi aporte', confirmed: 'Aporte sumado al plan del grupo', facts: 'Lo que ya sabemos', dietary: 'Vegetariana · dato informativo', plans: 'Opciones para el grupo', fits: 'ENCaja con lo confirmado', doesnt: 'No coincide con el horario confirmado', explanation: 'Sábado · 20:30–22:00 · ARS 18.000 · Villa Crespo', result: 'Hay una opción que contempla lo que el grupo confirmó.', finish: 'Cerrar recorrido', finished: 'Una sala para este encuentro. La próxima empieza con una sala nueva.', restart: 'Volver a empezar', demoTag: 'MUESTRA LOCAL', step1: 'Mirar', step2: 'Sumarse', step3: 'Revisar', step4: 'Elegir', expand: 'Cada persona trae una parte de la historia. APORIA ayuda a ponerlas en común.',
  },
  en: {
    eyebrow: 'SAMPLE WALKTHROUGH · NO LIVE GEMINI', title: 'The next get-together shouldn’t get lost in the chat.', lede: 'See how APORIA turns scattered messages into a plan the group can review.', start: 'Enter the sample room', back: 'Back to APORIA', recording: 'Open the live flow to record', sample: 'Fictional scenario. This walkthrough runs in your browser; it does not call Gemini or save a real room.',
    room: 'The meetup after-party', code: 'Sample meeting number', observer: 'You are looking around as an observer', chat: 'What the group is saying', m1: 'Jo: I’m leaving the meetup at 8 on Saturday.', m2: 'Nati: I’m in if it stays within budget.', m3: 'Cami: Villa Crespo works well for me.', people: 'Already in the room', join: 'Join as a participant', name: 'What name should the group see?', placeholder: 'Your name', joined: 'You are in the group', contribution: 'What you already have', contributionText: 'A screenshot with availability and a food preference.', useImage: 'View sample screenshot', imageAlt: 'Fictional message screenshot: I can do Saturday after 8. I’m vegetarian.', sampleImage: 'SAMPLE CONTRIBUTION', simulate: 'Show sample interpretation', simulated: 'Prepared for this demo · not a Gemini response', claim1: 'Saturday, after 8 pm', claim2: 'Dietary note: vegetarian', confirm: 'Confirm my contribution', confirmed: 'Contribution added to the group plan', facts: 'What we know so far', dietary: 'Vegetarian · informational note', plans: 'Options for the group', fits: 'FITS CONFIRMED DETAILS', doesnt: 'Does not match the confirmed time', explanation: 'Saturday · 8:30–10:00 pm · ARS 18,000 · Villa Crespo', result: 'One option accounts for what the group confirmed.', finish: 'Close walkthrough', finished: 'One room for this get-together. The next one starts fresh.', restart: 'Start over', demoTag: 'LOCAL SAMPLE', step1: 'Look around', step2: 'Join', step3: 'Review', step4: 'Choose', expand: 'Everyone brings a piece of the story. APORIA helps put them together.',
  },
} as const;

export function DemoExperience() {
  const [language, setLanguage] = useState<Language>(() => { try { return localStorage.getItem('aporia:language') === 'en' ? 'en' : 'es'; } catch { return 'es'; } });
  const [phase, setPhase] = useState<Phase>('welcome');
  const [name, setName] = useState('Mica');
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState(makeInitialSnapshot);
  const [imageVisible, setImageVisible] = useState(false);
  const [readingVisible, setReadingVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [closed, setClosed] = useState(false);
  const text = copy[language];
  const results = useMemo(() => new Map(snapshot.evaluation?.candidateResults.map(result => [result.candidateId, result]) ?? []), [snapshot.evaluation]);
  const next = (type: string, payload: unknown, actorId = 'demo') => setSnapshot(current => applyEvent(current, { id: `demo-event-${current.revision + 1}`, roomId: current.roomId, revision: current.revision + 1, actorId, type, payload, createdAt: '2026-10-24T20:00:00.000Z' }));
  const join = () => {
    const id = 'demo-visitor';
    next('participant.added', { id, displayName: name.trim() || 'Mica' }, id);
    setParticipantId(id);
  };
  const confirmSample = () => {
    if (!participantId || confirmed) return;
    next('fact.confirmed', { id: 'fact-demo-availability', kind: 'availability', participantId, value: { weekday: 6, startMinute: 1200, endMinute: 1410 }, sourceProposalId: 'sample-extraction', confirmedBy: participantId, confirmedAt: '2026-10-24T20:00:00.000Z' }, participantId);
    next('fact.confirmed', { id: 'fact-demo-dietary', kind: 'dietary_note', participantId, value: { text: 'Vegetariana' }, sourceProposalId: 'sample-extraction', confirmedBy: participantId, confirmedAt: '2026-10-24T20:00:00.000Z' }, participantId);
    setConfirmed(true);
  };
  const restart = () => { setSnapshot(makeInitialSnapshot()); setPhase('welcome'); setParticipantId(null); setImageVisible(false); setReadingVisible(false); setConfirmed(false); setClosed(false); setName('Mica'); };

  if (phase === 'welcome') return <main className="demo-shell">
    <header className="demo-topbar"><a href={base} className="demo-wordmark" aria-label="APORIA">APORIA<span>✳</span></a><div className="demo-controls"><span className="demo-pill">{text.demoTag}</span><label className="sr-only" htmlFor="demo-language">Language</label><select id="demo-language" value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="es">Español</option><option value="en">English</option></select></div></header>
    <section className="demo-hero"><div className="demo-hero-copy"><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p className="demo-lede">{text.lede}</p><button type="button" onClick={() => setPhase('room')}>{text.start}<span aria-hidden="true"> →</span></button><p className="demo-sample-note">{text.sample}</p></div><div className="demo-hero-art" aria-hidden="true"><div className="demo-orbit orbit-one"/><div className="demo-orbit orbit-two"/><span className="demo-art-letter">A</span><span className="demo-art-spark">✳</span></div></section>
    <footer className="demo-footer"><span>{text.expand}</span><div className="demo-footer-links"><a href={base+"?mode=recording"}>{text.recording}</a><a href={base}>{text.back}</a></div></footer>
  </main>;

  const participants = snapshot.participants;
  const candidateResults = snapshot.candidates.map(candidate => ({ candidate, result: results.get(candidate.id) }));
  return <main className="demo-shell demo-room-shell">
    <header className="demo-topbar"><a href={base} className="demo-wordmark">APORIA<span>✳</span></a><div className="demo-controls"><span className="demo-pill">{text.demoTag}</span><label className="sr-only" htmlFor="demo-language-room">Language</label><select id="demo-language-room" value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="es">Español</option><option value="en">English</option></select></div></header>
    <div className="demo-room-heading"><div><p className="eyebrow">{text.room}</p><h1>{snapshot.title}</h1></div><div className="demo-meeting-code"><small>{text.code}</small><strong>2040 1010</strong></div></div>
    <ol className="demo-stepper" aria-label="Demo walkthrough"><li className="complete">1 · {text.step1}</li><li className={participantId ? 'complete' : ''}>2 · {text.step2}</li><li className={confirmed ? 'complete' : ''}>3 · {text.step3}</li><li className={confirmed ? 'complete' : ''}>4 · {text.step4}</li></ol>
    <p className="demo-observer-note">{participantId ? text.joined : text.observer}</p>
    <div className="demo-grid">
      <section className="demo-panel demo-chat"><div className="demo-panel-heading"><div><p className="eyebrow">APORIA · SALA COMPARTIDA</p><h2>{text.chat}</h2></div><span className="demo-live-dot" aria-label="Room sample"/></div><div className="demo-messages"><p><strong>Jo</strong><span>{text.m1.replace(/^Jo: /, '')}</span></p><p><strong>Nati</strong><span>{text.m2.replace(/^Nati: /, '')}</span></p><p><strong>Cami</strong><span>{text.m3.replace(/^Cami: /, '')}</span></p></div><h3>{text.people}</h3><div className="demo-people">{participants.map(person => <span className="demo-person" key={person.id}><i>{person.displayName.slice(0,1)}</i>{person.displayName}</span>)}</div>{!participantId && <div className="demo-join"><label htmlFor="demo-name">{text.name}</label><div><input id="demo-name" value={name} maxLength={50} onChange={event => setName(event.target.value)} placeholder={text.placeholder}/><button type="button" onClick={join}>{text.join}</button></div></div>}</section>
      <section className="demo-panel demo-contribution"><p className="eyebrow">{text.contribution}</p><h2>{text.expand}</h2><p>{text.contributionText}</p><button type="button" className="demo-secondary" onClick={() => setImageVisible(true)} disabled={!participantId || confirmed}>{text.useImage}</button>{imageVisible && <div className="demo-image-card"><div className="demo-image-label">{text.sampleImage}</div><img src={base + 'demo/availability-sample.png'} alt={text.imageAlt}/><button type="button" onClick={() => setReadingVisible(true)} disabled={!participantId}>{text.simulate}</button></div>}{readingVisible && <div className="demo-reading"><span className="demo-simulated-label">{text.simulated}</span><p>✓ {text.claim1}</p><p>✓ {text.claim2}</p><button type="button" onClick={confirmSample} disabled={confirmed}>{confirmed ? text.confirmed : text.confirm}</button></div>}{!participantId&&<p className="demo-hint">{text.observer}</p>}</section>
      <section className="demo-panel demo-known"><p className="eyebrow">{text.facts}</p><h2>{text.facts}</h2><ul>{snapshot.facts.filter(fact => fact.kind !== 'dietary_note').map(fact => <li key={fact.id}><strong>{snapshot.participants.find(person => person.id === fact.participantId)?.displayName}</strong><span>{fact.kind === 'availability' ? 'Sábado · 20:00–23:00' : fact.kind === 'budget_max' ? 'Hasta ARS 22.000' : (fact.value as { area: string }).area}</span></li>)}</ul>{confirmed&&<div className="demo-confirmed"><strong>{name}</strong><span>{text.claim1}</span></div>}{confirmed&&<p className="demo-dietary-note">{text.dietary}</p>}</section>
      <section className="demo-panel demo-plans"><p className="eyebrow">{text.plans}</p><h2>{text.plans}</h2>{candidateResults.map(({candidate,result})=><article className={'demo-plan '+(result?.feasible?'is-feasible':'')} key={candidate.id}><div><span className="demo-plan-status">{result?.feasible?text.fits:text.doesnt}</span><h3>{candidate.title}</h3><p>{candidate===snapshot.candidates[0]?text.explanation:'Viernes · 21:00–23:00 · ARS 15.000 · Palermo'}</p></div><span className="demo-plan-check" aria-hidden="true">{result?.feasible?'✓':'·'}</span></article>)}{confirmed&&<p className="demo-result">{text.result}</p>}{confirmed&&!closed&&<button type="button" className="demo-close" onClick={()=>setClosed(true)}>{text.finish}</button>}{closed&&<div className="demo-finished"><strong>{text.finished}</strong><button type="button" className="demo-secondary" onClick={restart}>{text.restart}</button></div>}</section>
    </div>
    <footer className="demo-footer"><span>{text.sample}</span><div className="demo-footer-links"><a href={base+"?mode=recording"}>{text.recording}</a><a href={base}>{text.back}</a></div></footer>
  </main>;
}
