import { useEffect, useMemo, useState } from 'react';
import type { DecisionSnapshot, ExtractionProposal } from '../core/model';

const base = import.meta.env.BASE_URL;
const api = (path: string) => `${base.replace(/\/$/, '')}${path}`;
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Session { roomId: string; participantId: string; token: string; }

function readSession(roomId: string): Session | null {
  try { const value = localStorage.getItem(`aporia:${roomId}`); return value ? JSON.parse(value) as Session : null; } catch { return null; }
}

async function request<T>(path: string, options: RequestInit = {}, session?: Session): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');
  if (session) headers.set('x-aporia-session', session.token);
  const response = await fetch(api(path), { ...options, headers });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

export function App() {
  const [roomId, setRoomId] = useState(() => new URLSearchParams(location.search).get('room'));
  const [session, setSession] = useState<Session | null>(() => roomId ? readSession(roomId) : null);
  const [snapshot, setSnapshot] = useState<DecisionSnapshot | null>(null);
  const [proposal, setProposal] = useState<ExtractionProposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    request<{ snapshot: DecisionSnapshot }>(`/api/rooms/${roomId}`).then((data) => setSnapshot(data.snapshot)).catch((reason: Error) => setError(reason.message));
  }, [roomId]);

  const navigateToRoom = (nextRoomId: string, nextSession: Session) => {
    history.pushState({}, '', `${base}?room=${encodeURIComponent(nextRoomId)}`);
    localStorage.setItem(`aporia:${nextRoomId}`, JSON.stringify(nextSession));
    setRoomId(nextRoomId); setSession(nextSession); setError(null);
  };

  if (!roomId || !snapshot) return <Landing error={error} onCreated={navigateToRoom} />;
  if (!session) return <JoinRoom roomId={roomId} onJoined={(nextSession) => { localStorage.setItem(`aporia:${roomId}`, JSON.stringify(nextSession)); setSession(nextSession); }} error={error} />;
  return <Room snapshot={snapshot} session={session} proposal={proposal} setProposal={setProposal} setSnapshot={setSnapshot} setError={setError} error={error} />;
}

function JoinRoom({ roomId, onJoined, error }: { roomId: string; onJoined: (session: Session) => void; error: string | null }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const join = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { const result = await request<{ roomId: string; participantId: string; sessionToken: string }>(`/api/rooms/${roomId}/participants`, { method: 'POST', body: JSON.stringify({ displayName: name }) }); onJoined({ roomId, participantId: result.participantId, token: result.sessionToken }); } catch (reason) { alert(reason instanceof Error ? reason.message : 'Could not join room'); } finally { setBusy(false); } };
  return <main className="landing"><div className="eyebrow">APORIA · SHARED ROOM</div><h1>Bring what you know.</h1><p className="lede">Choose a name to add your availability, preferences, or a plan to this room.</p><form onSubmit={join} className="create-form"><label>Your name<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Mario" /></label><button disabled={busy}>{busy ? 'Joining…' : 'Join the room'}</button></form>{error && <p className="error" role="alert">{error}</p>}</main>;
}

function Landing({ error, onCreated }: { error: string | null; onCreated: (roomId: string, session: Session) => void }) {
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { const result = await request<{ roomId: string; participantId: string; sessionToken: string; snapshot: DecisionSnapshot }>('/api/rooms', { method: 'POST', body: JSON.stringify({ title, displayName: name }) }); onCreated(result.roomId, { roomId: result.roomId, participantId: result.participantId, token: result.sessionToken }); }
    catch (reason) { /* The real error is surfaced below, never replaced with fake data. */ alert(reason instanceof Error ? reason.message : 'Could not create room'); }
    finally { setBusy(false); }
  };
  return <main className="landing"><div className="eyebrow">APORIA · NERDEARLA 2026</div><h1>Turn everyone’s messy plans into one that actually works.</h1><p className="lede">Drop in what you know. Confirm what APORIA finds. See the plans that fit everyone.</p><form onSubmit={create} className="create-form"><label>What are you figuring out?<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Dinner after Nerdearla" /></label><label>Your name<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Anna" /></label><button disabled={busy}>{busy ? 'Creating…' : 'Create a room'}</button></form>{error && <p className="error" role="alert">{error}</p>}</main>;
}

function Room({ snapshot, session, proposal, setProposal, setSnapshot, setError, error }: { snapshot: DecisionSnapshot; session: Session | null; proposal: ExtractionProposal | null; setProposal: (value: ExtractionProposal | null) => void; setSnapshot: (value: DecisionSnapshot) => void; setError: (value: string | null) => void; error: string | null }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState({ title: '', weekday: '6', start: '20:00', end: '22:00', price: '', area: '' });
  const results = useMemo(() => new Map(snapshot.evaluation?.candidateResults.map((item) => [item.candidateId, item]) ?? []), [snapshot.evaluation]);
  const submitText = async (event: React.FormEvent) => { event.preventDefault(); if (!session) return setError('This room session is missing. Join again to contribute.'); setBusy(true); setError(null); try { const result = await request<{ proposal: ExtractionProposal }>(`/api/rooms/${snapshot.roomId}/proposals`, { method: 'POST', body: JSON.stringify({ content: text }) }, session); setProposal(result.proposal); setText(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Extraction failed'); } finally { setBusy(false); } };
  const confirm = async (claimId: string, participantId: string | null) => { if (!session || !proposal) return; setBusy(true); setError(null); try { const result = await request<{ snapshot: DecisionSnapshot }>(`/api/rooms/${snapshot.roomId}/proposals/${proposal.id}/confirm`, { method: 'POST', body: JSON.stringify({ claimId, participantId, expectedRevision: snapshot.revision }) }, session); setSnapshot(result.snapshot); setProposal(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Confirmation failed'); } finally { setBusy(false); } };
  const addCandidate = async (event: React.FormEvent) => { event.preventDefault(); if (!session) return; setBusy(true); try { const result = await request<{ snapshot: DecisionSnapshot }>(`/api/rooms/${snapshot.roomId}/candidates`, { method: 'POST', body: JSON.stringify({ title: candidate.title, weekday: Number(candidate.weekday), startMinute: toMinutes(candidate.start), endMinute: toMinutes(candidate.end), priceCents: candidate.price ? Number(candidate.price) * 100 : null, currency: 'ARS', area: candidate.area || null, expectedRevision: snapshot.revision }) }, session); setSnapshot(result.snapshot); setCandidate({ title: '', weekday: '6', start: '20:00', end: '22:00', price: '', area: '' }); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Candidate failed'); } finally { setBusy(false); } };
  return <main className="room"><header className="room-header"><div><div className="eyebrow">APORIA · SHARED ROOM</div><h1>{snapshot.title}</h1></div><span className="revision">Revision {snapshot.revision}</span></header><section className="room-intro"><h2>What are we figuring out?</h2><p>Share the messy version. APORIA will show a proposal before anything becomes part of the room.</p></section><div className="room-grid"><section className="panel contribute"><h2>Drop what you know</h2><form onSubmit={submitText}><textarea required maxLength={12000} value={text} onChange={(event) => setText(event.target.value)} placeholder="I can do Saturday after 8, but Thursday would need to be near Caballito…" /><button disabled={busy}>{busy ? 'Asking Gemini…' : 'Extract constraints'}</button></form>{proposal && <Proposal proposal={proposal} participants={snapshot.participants} onConfirm={confirm} disabled={busy} />}</section><section className="panel"><h2>What we know</h2><div className="people">{snapshot.participants.map((participant) => <div className="person" key={participant.id}><span className="avatar">{participant.displayName.slice(0, 1).toUpperCase()}</span><strong>{participant.displayName}</strong><small>{snapshot.facts.filter((fact) => fact.participantId === participant.id).length} confirmed facts</small></div>)}</div>{snapshot.facts.length === 0 && <p className="muted">Nothing confirmed yet. The first step is to review an extraction.</p>}</section><section className="panel candidates"><h2>Possible plans</h2>{snapshot.candidates.length === 0 ? <p className="muted">Add a real candidate to evaluate it. APORIA will not invent a place or a result.</p> : snapshot.evaluation?.rankedCandidateIds.map((id) => { const item = snapshot.candidates.find((candidateItem) => candidateItem.id === id)!; const result = results.get(id)!; return <article className={`candidate ${result.feasible ? 'feasible' : 'not-feasible'}`} key={id}><div><strong>{item.title}</strong><span>{days[item.weekday]} · {formatMinutes(item.startMinute)}–{formatMinutes(item.endMinute)}{item.area ? ` · ${item.area}` : ''}</span></div><b>{result.feasible ? 'Works' : 'Doesn’t work yet'}</b><p>{result.feasible ? result.satisfied.join(' · ') || 'No hard constraints contradicted.' : [...result.hardViolations, ...result.unknowns].join(' · ')}</p></article>; })}</section><section className="panel add-candidate"><h2>Add a candidate</h2><p className="muted">Use a real option from the group. Candidate discovery comes after this level.</p><form onSubmit={addCandidate}><input required value={candidate.title} onChange={(event) => setCandidate({ ...candidate, title: event.target.value })} placeholder="Place or plan name" /><div className="form-row"><select value={candidate.weekday} onChange={(event) => setCandidate({ ...candidate, weekday: event.target.value })}>{days.map((day, index) => <option value={index} key={day}>{day}</option>)}</select><input type="time" required value={candidate.start} onChange={(event) => setCandidate({ ...candidate, start: event.target.value })} /><input type="time" required value={candidate.end} onChange={(event) => setCandidate({ ...candidate, end: event.target.value })} /></div><div className="form-row"><input inputMode="numeric" value={candidate.price} onChange={(event) => setCandidate({ ...candidate, price: event.target.value })} placeholder="Price ARS" /><input value={candidate.area} onChange={(event) => setCandidate({ ...candidate, area: event.target.value })} placeholder="Area (optional)" /></div><button disabled={busy}>Evaluate candidate</button></form></section></div>{error && <p className="error" role="alert">{error}</p>}<footer>Room link: <code>{location.href}</code> · <a href="https://github.com/annatchijova/aporia">Verify architecture</a></footer></main>;
}

function Proposal({ proposal, participants, onConfirm, disabled }: { proposal: ExtractionProposal; participants: DecisionSnapshot['participants']; onConfirm: (claimId: string, participantId: string | null) => void; disabled: boolean }) {
  return <div className="proposal"><div className="proposal-label">I think I found · {proposal.provider.name}/{proposal.provider.model}</div>{proposal.warnings.map((warning) => <p className="warning" key={warning}>{warning}</p>)}{proposal.claims.length === 0 && <p className="muted">No structured claim was found. Nothing can be confirmed.</p>}{proposal.claims.map((claim) => <div className="claim" key={claim.id}><div><strong>{claim.kind.replace('_', ' ')}</strong><span>{describeClaim(claim)}</span><small>From: “{claim.sourceText || 'source not returned'}” · certainty: {claim.confidence}</small>{claim.ambiguity.map((item) => <em key={item}>{item}</em>)}</div><div className="claim-actions"><select aria-label="Participant for claim" defaultValue={claim.participantId ?? ''}><option value="">Choose person</option>{participants.map((person) => <option value={person.id} key={person.id}>{person.displayName}</option>)}</select><button disabled={disabled} onClick={(event) => { const select = event.currentTarget.parentElement?.querySelector('select'); onConfirm(claim.id, select?.value || claim.participantId); }}>Confirm</button></div></div>)}</div>;
}

function describeClaim(claim: ExtractionProposal['claims'][number]): string { if (claim.kind === 'availability') { const value = claim.value as { weekday: number; startMinute: number; endMinute: number }; return `${days[value.weekday]} ${formatMinutes(value.startMinute)}–${formatMinutes(value.endMinute)}`; } if (claim.kind === 'budget_max') return `up to ${(claim.value as { maxCents: number }).maxCents / 100} ${(claim.value as { currency: string }).currency}`; if (claim.kind === 'area_preference') return (claim.value as { area: string }).area; return (claim.value as { text: string }).text; }
function toMinutes(value: string): number { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }
function formatMinutes(value: number): string { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
