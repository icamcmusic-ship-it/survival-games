import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameState, Tribute } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { FeedLine } from './EventFeed';
import { fearOf } from '../engine/fear';
import { heightLabel } from '../engine/physique';
import { prefsStore } from '../store/prefsStore';
import { HUNTING, PROFICIENCY, ROMANCE, SUSPICION } from '../data/balance';
import { resolveOf, hasBroken } from '../engine/resolve';
import { hasTruce, truceWith } from '../engine/parley';
import { bleedSeverity } from '../engine/wounds';
import { RelationshipGraph } from './RelationshipGraph';
import { Explainer } from './Explainer';
import { objectiveLabel } from '../engine/objectives';
import { traitInfo } from '../data/traitInfo';
import { MapPin, Users, X, Heart } from 'lucide-react';
import { craftOf, legacyOf } from '../data/districts';
import { conditionOf, displayName } from '../engine/items';
import { sponsorCost, sponsorableItems } from '../engine/playerSponsor';
import { gameActions, gameStore } from '../store/gameStore';
import { useStore } from '../store/createStore';
import { canSeeArena, disclosureFor } from '../ui/disclosure';
import { copyTributeStory, downloadTributeStory } from '../utils/tributeStory';

const PROFICIENCY_LABELS: Record<string, string> = {
    forage: 'Foraging', melee: 'Melee', ranged: 'Ranged', medicine: 'Medicine', tracking: 'Tracking',
};

/** A wound's rate, not merely its existence. */
const PACT_LABELS: Record<string, string> = {
    'to-the-end': 'To the end',
    'until-the-final-eight': 'Until the final eight',
    'no-pact': 'Nothing agreed',
};

const BLEED_LABELS: Record<number, string> = {
    1: 'bleeding (slight)', 2: 'bleeding (steady)', 3: 'bleeding (severe)',
};

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function VitalBar({ label, value, invert = false, explain }: { label: string; value: number; invert?: boolean; explain?: React.ReactNode }) {
    // For hunger/thirst/fatigue a high number is bad (severity = value). For
    // health/sanity/sponsor trust a high number is good, so severity runs the
    // other way — this was backwards before, which painted a tribute at full
    // health in danger-red.
    const severity = invert ? 100 - value : value;
    const color = severity >= 66 ? 'var(--cat-death)' : severity >= 33 ? 'var(--cat-training)' : 'var(--cat-alliance)';
    return (
        <div className="panel-flush p-2.5 space-y-1.5">
            <div className="flex justify-between items-baseline">
                {explain
                    ? <Explainer align="left" label={<span className="eyebrow">{label}</span>} title={label}>{explain}</Explainer>
                    : <span className="eyebrow">{label}</span>}
                <span className="font-mono text-[var(--ink)] text-sm">{value}%</span>
            </div>
            <div className="meter">
                <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
            </div>
        </div>
    );
}


/**
 * SIDE-03: the player, as a sponsor.
 *
 * The coin wallet had exactly one use — a wager placed before the gong and then
 * watched. This is the other side of it: the audience doing the one thing the
 * audience in the source material can actually do. Prices escalate with the day
 * and with every parachute the tribute has already had, so the third one is a
 * decision about the whole wallet rather than a shopping trip.
 */
function SponsorPanel({ tribute, gameState }: { tribute: Tribute; gameState: GameState }) {
    const coins = useStore(gameStore, s => s.coins);
    const [message, setMessage] = React.useState<string | null>(null);

    const inArena = gameState.phase === 'day' || gameState.phase === 'night' || gameState.phase === 'feast';
    if (tribute.status !== 'alive') return null;

    const offers = sponsorableItems()
        .map(item => ({ item, cost: sponsorCost(gameState, tribute, item) }))
        .sort((a, b) => a.cost - b.cost);

    return (
        <section>
            <div className="flex items-baseline justify-between gap-2 mb-2">
                <h4 className="panel-title">Send a parachute</h4>
                <span className="text-[11px] font-mono text-[var(--color-ink-500)]">{coins} coins</span>
            </div>
            {!inArena ? (
                <p className="text-sm text-[var(--color-ink-500)]">
                    Nothing can be sent until the tributes are in the arena.
                </p>
            ) : (
                <>
                    <p className="text-[11px] text-[var(--color-ink-500)] mb-2">
                        Prices rise with every day of the Games and with every parachute {tribute.name} has
                        already received — from you, from the crowd, or from their mentor
                        {tribute.mentorLegacy ? `, ${tribute.mentorLegacy}` : ''}.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                        {offers.map(({ item, cost }) => {
                            const affordable = coins >= cost;
                            return (
                                <button
                                    key={item.id}
                                    disabled={!affordable}
                                    onClick={() => setMessage(gameActions.sponsorTribute(tribute.id, item.id).message)}
                                    className="panel-flush p-2 flex justify-between items-center gap-2 text-left disabled:opacity-40"
                                    title={affordable ? `Send ${item.name} to ${tribute.name}` : `You cannot afford this`}
                                >
                                    <span className="text-sm text-[var(--ink)] truncate">{item.name}</span>
                                    <span className="text-[11px] font-mono flex-none" style={{ color: affordable ? 'var(--gold)' : 'var(--color-ink-500)' }}>
                                        {cost}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
            {message && <p className="text-sm mt-2 text-[var(--gold)]">{message}</p>}
        </section>
    );
}

export function TributeModal({ tribute, gameState, onClose, onShowInChronicle }: {
    tribute: Tribute;
    gameState: GameState;
    onClose: () => void;
    /** U-3: jump the chronicle to this tribute's story (their death sits on top). */
    onShowInChronicle?: () => void;
}) {
    const units = useStore(prefsStore, p => p.units);
    const arenaSealed = !!gameState.arenaHidden && !canSeeArena(disclosureFor(gameState.phase));
    const panelRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        previouslyFocused.current = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        (focusable?.[0] ?? panel)?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key !== 'Tab' || !panel) return;
            const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
            if (nodes.length === 0) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            previouslyFocused.current?.focus();
        };
    }, [onClose]);

    const [storyCopied, setStoryCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
    const archetype = ARCHETYPES[tribute.archetype];
    const injuries = Object.entries(tribute.injuries).filter(([, v]) => v).map(([k]) => k);
    const sworn = new Set(tribute.memory?.vengeance ?? []);
    const relationships = Object.entries(tribute.relationships)
        .map(([id, val]) => ({
            other: gameState.tributes.find(t => t.id === id),
            // Decay leaves fractional values in the graph; the reader wants a number.
            value: Math.round(val as number),
            sworn: sworn.has(id),
            // The streak is only stored on one side of each pair, so read both.
            streak: Math.max(
                tribute.memory?.contactStreak?.[id] ?? 0,
                gameState.tributes.find(o => o.id === id)?.memory?.contactStreak?.[tribute.id] ?? 0,
            ),
        }))
        .filter(r => !!r.other)
        .sort((a, b) => b.value - a.value);
    // UX-05: every event already records who was in it, so a tribute's whole
    // story is one filter away.
    const personalLog = useMemo(
        () => gameState.log.filter(l => l.tributesInvolved.includes(tribute.id)),
        [gameState.log, tribute.id]
    );
    const proficiencies = Object.entries(tribute.proficiencies ?? {})
        .filter(([, level]) => (level ?? 0) > 0)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as Array<[string, number]>;
    const feared = gameState.tributes
        .map(o => ({ other: o, value: fearOf(tribute, o.id) }))
        .filter(f => f.other.id !== tribute.id && f.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    const alliance = tribute.allianceId ? gameState.alliances?.[tribute.allianceId] : undefined;
    const allyNames = gameState.tributes
        .filter(o => o.status === 'alive' && o.id !== tribute.id && o.allianceId === tribute.allianceId)
        .map(o => o.name);
    const leaderName = gameState.tributes.find(o => o.id === alliance?.leaderId)?.name ?? '—';
    // Only pairs who have actually fought more than once read as a feud.
    const feuds = Object.entries(tribute.memory?.rivals ?? {})
        .map(([id, record]) => ({ other: gameState.tributes.find(t => t.id === id)!, record }))
        .filter(f => !!f.other && f.record.fights >= 2)
        .sort((a, b) => b.record.fights - a.record.fights)
        .slice(0, 5);
    const knownZones = Object.entries(tribute.memory?.zones ?? {})
        .map(([name, slot]) => ({ name, ...slot }))
        .filter(z => z.threat > 0.15 || z.rivals > 0)
        .sort((a, b) => b.threat - a.threat)
        .slice(0, 4);

    // --- Standings: the social state the engine has always ticked and the
    // sheet never showed. Every list here is hidden entirely when empty, so a
    // tribute who has agreed nothing and owes nobody reads as exactly that.
    const nameOf = (id: string) => gameState.tributes.find(o => o.id === id)?.name;
    const cycle = gameState.cycle ?? 0;

    const truces = Object.keys(tribute.truces ?? {})
        .filter(id => hasTruce(gameState, tribute, id) && !!nameOf(id))
        .map(id => ({ id, name: nameOf(id)!, cyclesLeft: (truceWith(tribute, id) ?? cycle) - cycle }))
        .sort((a, b) => b.cyclesLeft - a.cyclesLeft);

    const protectees = (tribute.protectorBonds ?? [])
        .map(id => ({ id, other: gameState.tributes.find(o => o.id === id) }))
        .filter(p => !!p.other);

    // Both directions of the ledger: a debt is only a story if you can see who
    // is holding it over whom.
    const owes = Object.entries(tribute.debts ?? {})
        .map(([id, amount]) => ({ id, name: nameOf(id), amount }))
        .filter(d => !!d.name && d.amount > 0)
        .sort((a, b) => b.amount - a.amount);
    const owed = gameState.tributes
        .map(o => ({ id: o.id, name: o.name, amount: o.debts?.[tribute.id] ?? 0 }))
        .filter(d => d.id !== tribute.id && d.amount > 0)
        .sort((a, b) => b.amount - a.amount);

    const suspicions = Object.entries(tribute.memory?.suspicion ?? {})
        .map(([id, value]) => ({ id, name: nameOf(id), value }))
        .filter(s => !!s.name && s.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    // §3.1: what the arena itself taught their body.
    const drift = Object.entries(tribute.attributeDrift ?? {})
        .filter(([, gain]) => (gain ?? 0) > 0) as Array<[string, number]>;

    const momentum = tribute.momentum ?? 0;
    const rattled = tribute.rattled ?? 0;
    const resolve = Math.round(resolveOf(tribute));

    // NOTE: `tribute.displayedRegard` is deliberately NOT rendered here.
    // It is the performed-romance mechanic — one tribute playing a bond for the
    // cameras while the other means it. The engine hides it from the arena and
    // from the Capitol alike; the chronicle narrates it exactly once, at
    // declaration. Putting it on the tribute sheet would spoil the only twist
    // the mechanic exists to create.

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`${tribute.name} profile`}
        >
            <div ref={panelRef} tabIndex={-1} className="panel p-6 max-w-lg w-full max-h-[88vh] overflow-y-auto custom-scrollbar animate-riseIn" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-5 gap-4">
                    <div className="min-w-0">
                        <h3 className="display-title text-2xl">{tribute.name}</h3>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="chip">District {tribute.district}</span>
                            <Explainer
                                align="left"
                                label={<span className="chip chip-accent">{archetype.name}</span>}
                                title={`${archetype.name} archetype`}
                            >
                                {archetype.description}
                                <span className="block mt-1.5 font-mono text-[10px] text-[var(--color-ink-500)]">
                                    Aggression {archetype.aggression >= 0 ? '+' : ''}{archetype.aggression.toFixed(2)} ·
                                    Caution {archetype.caution >= 0 ? '+' : ''}{archetype.caution.toFixed(2)} ·
                                    Loyalty {archetype.allianceAffinity.toFixed(2)} ·
                                    Treachery {archetype.treachery.toFixed(2)}
                                </span>
                                <span className="block mt-1.5">
                                    These weights bias every stance choice, alliance decision and retreat roll they make.
                                </span>
                            </Explainer>
                            {tribute.isCareer && <span className="chip chip-gold">Career</span>}
                            {tribute.volunteered && (
                                <Explainer
                                    align="left"
                                    label={<span className="chip chip-gold">Volunteer</span>}
                                    title="Volunteered"
                                >
                                    {tribute.reapingNote}
                                </Explainer>
                            )}
                            <Explainer
                                align="left"
                                label={<span className="chip">{legacyOf(tribute.district).industry}</span>}
                                title={`District ${tribute.district}: ${legacyOf(tribute.district).industry}`}
                            >
                                {craftOf(tribute.district).blurb}.
                                <span className="block mt-1.5">
                                    Twelve years of a district's trade is not decoration: it seeds the skills this
                                    tribute walks in with, and it decides which weapons feel like something they
                                    have held before.
                                </span>
                            </Explainer>
                            {tribute.fanFavourite && <span className="chip chip-gold" title="The Capitol had a favourite before the gong ever sounded.">Fan favourite</span>}
                            {tribute.interviewStrategy && <span className="chip" title="The persona they held on Caesar's couch — which may not be the one they walked out with.">{tribute.interviewStrategy}</span>}
                            {tribute.trainingStrategy && tribute.trainingStrategy !== 'balanced' && (
                                <Explainer
                                    align="left"
                                    label={<span className="chip">{tribute.trainingStrategy === 'conceal' ? 'Hid their hand' : 'Played to the gallery'}</span>}
                                    title="Training strategy"
                                >
                                    {tribute.trainingStrategy === 'conceal'
                                        ? 'They spent three days on the training floor doing nothing they could not have done at home. It costs them sponsors and a low score, and it keeps them off everybody else\'s list.'
                                        : 'They worked the floor where the gallery could see them. It buys sponsor trust and a higher score, and it paints a target.'}
                                </Explainer>
                            )}
                            {tribute.stylist && (
                                <Explainer
                                    align="left"
                                    label={<span className="chip">{tribute.stylist}</span>}
                                    title="Stylist"
                                >
                                    {tribute.stylist} dressed them for the chariot parade
                                    {tribute.chariotAngle ? ` — ${tribute.chariotAngle}` : ''}. What the Capitol
                                    saw on the City Circle is most of what it thinks about them now, and sponsor
                                    trust is read by the parachute stream all run.
                                </Explainer>
                            )}
                            <Explainer
                                align="left"
                                label={<span className="chip">{tribute.stance}</span>}
                                title="Stance"
                            >
                                Stance is not chosen by you or by them — it is scored every cycle from health,
                                whether they are armed, how badly they are hurt, their archetype, and a threat
                                assessment of everyone standing in the same sector. A challenger stance has to
                                clearly beat the incumbent to take over, so it will not flip back and forth.
                                <span className="block mt-1.5">
                                    <strong>Aggressive</strong> sweeps the sector for a fight and hunts.{' '}
                                    <strong>Defensive</strong> forages and rests.{' '}
                                    <strong>Evasive</strong> hides, and heals if left alone.
                                </span>
                            </Explainer>
                            {tribute.trainingScore > 0 && (
                                <Explainer
                                    align="left"
                                    label={<span className="chip">Training {tribute.trainingScore}</span>}
                                    title="Training score"
                                >
                                    Scores of 1-8 are earned on merit from the training stations. Every point above 8
                                    is a separate, much rarer roll, which is why a 10 is genuinely frightening.
                                    A score of 9 or more intimidates the rest of the cast: it costs them sanity,
                                    sours them on this tribute, and leaves a lasting fear of them specifically.
                                </Explainer>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2.5 text-sm text-[var(--color-ink-400)]">
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {arenaSealed ? '❓ Sealed' : tribute.zone}</span>
                            {tribute.status === 'alive' && (
                                <Explainer
                                    align="left"
                                    label={<span className="text-[var(--red)] font-semibold">{objectiveLabel(gameState, tribute)}</span>}
                                    title="Current intention"
                                >
                                    Tributes hold an objective across cycles rather than re-deciding every turn.
                                    It is chosen from what they need, who they are, and what they remember —
                                    and it is only re-evaluated when it expires or stops making sense
                                    (their quarry dies, they arrive, the ground goes out of bounds).
                                    Movement then routes toward it along the sector graph.
                                </Explainer>
                            )}
                            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-[var(--cat-death)]" /> {tribute.kills} kills</span>
                            {tribute.allianceId && (
                                <span className="flex items-center gap-1 text-[var(--cat-alliance)]"><Users className="w-3.5 h-3.5" /> In an alliance</span>
                            )}
                        </div>
                        <p className="text-xs text-[var(--color-ink-500)] mt-2">
                            {tribute.age} years old · {heightLabel(tribute.heightCm, units)} · {tribute.build} build
                            {tribute.platePosition !== undefined && (
                                <> · plate {tribute.platePosition < 0.34 ? 'close to the horn' : tribute.platePosition < 0.67 ? 'mid-ring' : 'on the far edge of the ring'}</>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="btn btn-sm btn-ghost flex-none" aria-label="Close">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {tribute.status === 'dead' && (
                    <div className="panel-flush p-3 mb-5 text-sm text-[var(--cat-death)]">
                        Died on day {tribute.dayOfDeath ?? '—'} · {tribute.causeOfDeath ?? 'Eliminated'}
                        {onShowInChronicle && (
                            <button
                                type="button"
                                className="btn btn-sm btn-ghost ml-2"
                                onClick={onShowInChronicle}
                                title="Filter the chronicle to this tribute — their final moment is at the top"
                            >
                                Show in chronicle
                            </button>
                        )}
                    </div>
                )}

                <div className="space-y-5">
                    <section>
                        <h4 className="panel-title mb-2">Condition</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <VitalBar label="Health" value={tribute.health} invert />
                            <VitalBar
                                label="Sanity"
                                value={tribute.vitals.sanity}
                                invert
                                explain={
                                    <>
                                        A pressure gauge, not a countdown. It drains faster when they are alone, at
                                        night, hungry, or standing somewhere they remember people dying — and it
                                        recovers with rest, food, safety and company. Below 30 they may lose a turn
                                        to a breakdown.
                                    </>
                                }
                            />
                            <VitalBar
                                label="Resolve"
                                value={resolve}
                                invert
                                explain={
                                    <>
                                        Whether they still want to win — not whether they are holding together.
                                        Allies, a score to settle, momentum and the crowd's attention hold it up;
                                        grief, isolation, wounds, hunger and the field closing in pull it down. It
                                        moves slowly on purpose: this is the arc of a run, not a mood.
                                        <span className="block mt-1.5">
                                            At the bottom a tribute stops playing — they walk into the open, or they
                                            sit down and stop making plans, or they go looking for nightlock.
                                        </span>
                                    </>
                                }
                            />
                            <VitalBar label="Hunger" value={tribute.vitals.hunger} />
                            <VitalBar label="Thirst" value={tribute.vitals.thirst} />
                            <VitalBar label="Fatigue" value={tribute.vitals.fatigue} />
                            <VitalBar
                                label="Sponsor trust"
                                value={tribute.sponsorTrust}
                                invert
                                explain={
                                    <>
                                        How willing the Capitol's backers are to spend on this tribute. It starts from
                                        their district's Games record and their charisma, and it drifts back toward
                                        that baseline every cycle — so a single good day does not buy a parachute for
                                        the rest of the run. Trust plus excitement must clear a threshold before a
                                        gift is even considered, and each gift a tribute receives makes the next one
                                        markedly rarer.
                                    </>
                                }
                            />
                        </div>
                        {(momentum > 0 || rattled > 0 || hasBroken(tribute)) && tribute.status === 'alive' && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {hasBroken(tribute) && (
                                    <Explainer
                                        align="left"
                                        label={<span className="chip" style={{ color: 'var(--cat-death)' }}>Has stopped playing</span>}
                                        title="Broken"
                                    >
                                        Their resolve has bottomed out. They are liable to break cover, sit down and
                                        stop making plans, or take the nightlock if they can find any.
                                    </Explainer>
                                )}
                                {momentum > 0 && (
                                    <Explainer
                                        align="left"
                                        label={<span className="chip chip-gold">Momentum {momentum}/{HUNTING.momentumMax}</span>}
                                        title="Momentum"
                                    >
                                        Bloodlust. A kill leaves a tribute keyed up — briefly harder to fight and far
                                        less willing to break off — and it also props their resolve up. It bleeds off
                                        every cycle, so it rewards pressing an advantage rather than having scored one.
                                    </Explainer>
                                )}
                                {rattled > 0 && (
                                    <Explainer
                                        align="left"
                                        label={<span className="chip chip-accent">Rattled {rattled}/{HUNTING.rattledMax}</span>}
                                        title="Rattled"
                                    >
                                        Momentum's mirror. Fleeing a fight, walking into a trap or losing somebody
                                        leaves a mark that outlasts the moment: they hit softer and run sooner. It
                                        decays a point a cycle.
                                    </Explainer>
                                )}
                            </div>
                        )}
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">Traits</h4>
                        <div className="flex flex-wrap gap-1">
                            {tribute.traits.length === 0
                                ? <span className="text-sm text-[var(--color-ink-400)]">None recorded</span>
                                : tribute.traits.map(t => (
                                    <Explainer
                                        key={t}
                                        align="left"
                                        label={<span className="chip">{t}</span>}
                                        title={t}
                                    >
                                        {traitInfo(t)}
                                    </Explainer>
                                ))}
                        </div>
                        {(tribute.quirks?.length ?? 0) > 0 && (
                            <p className="text-sm text-[var(--color-ink-400)] mt-2 italic">
                                The cameras have noticed: {tribute.quirks!.join('; ')}.
                            </p>
                        )}
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">Injuries</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {injuries.length === 0
                                ? <span className="text-sm text-[var(--cat-alliance)]">Unharmed</span>
                                : injuries.map(k => (
                                    <span key={k} className="chip chip-accent">
                                        {/* Bleeding is the one injury with a rate, not just a state —
                                            a trickle and an artery are very different problems. */}
                                        {k === 'bleeding' ? `${BLEED_LABELS[bleedSeverity(tribute)] ?? 'bleeding'}` : k}
                                    </span>
                                ))}
                        </div>
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">Proficiencies</h4>
                        {proficiencies.length === 0 ? (
                            <span className="text-sm text-[var(--color-ink-400)]">Has not practised anything yet</span>
                        ) : (
                            <div className="space-y-1.5">
                                {proficiencies.map(([skill, level]) => (
                                    <div key={skill} className="flex items-center gap-2 text-sm">
                                        <span className="text-[var(--color-ink-200)] w-24 flex-none">{PROFICIENCY_LABELS[skill] ?? skill}</span>
                                        <div className="meter flex-1">
                                            <span style={{ width: `${(level / PROFICIENCY.max) * 100}%`, background: 'var(--cat-training)' }} />
                                        </div>
                                        <span className="font-mono text-xs text-[var(--color-ink-400)] w-10 text-right flex-none">
                                            {level.toFixed(1)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {drift.length > 0 && (
                            <p className="text-[11px] text-[var(--color-ink-500)] mt-2">
                                Sharpened by the arena itself:{' '}
                                {drift.map(([attr, gain]) => `+${gain.toFixed(1)} ${attr}`).join(' · ')}
                            </p>
                        )}
                    </section>

                    {alliance && allyNames.length > 0 && (
                        <section>
                            <h4 className="panel-title mb-2">Their alliance</h4>
                            <div className="panel-flush p-3 space-y-1.5 text-sm">
                                <div className="flex justify-between gap-2">
                                    <span className="text-[var(--color-ink-500)]">Leader</span>
                                    <span className="text-[var(--color-ink-200)] font-bold">
                                        {leaderName}{leaderName === tribute.name ? ' (them)' : ''}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className="text-[var(--color-ink-500)]">Standing with</span>
                                    <span className="text-[var(--color-ink-200)] text-right">{allyNames.join(', ')}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className="text-[var(--color-ink-500)]">Pact</span>
                                    <Explainer
                                        label={<span className="text-[var(--color-ink-200)] font-bold">{PACT_LABELS[alliance.pact]}</span>}
                                        title="Alliance pact"
                                    >
                                        What the group agreed out loud when it formed. A pact to split at the final
                                        eight is a scheduled betrayal — everyone can see it coming, which is what
                                        makes it land when it arrives.
                                    </Explainer>
                                </div>
                                {alliance.campZone && (
                                    <div className="flex justify-between gap-2">
                                        <span className="text-[var(--color-ink-500)]">Camp</span>
                                        <span className="text-[var(--color-ink-200)]">{alliance.campZone}</span>
                                    </div>
                                )}
                                <div className="flex justify-between gap-2">
                                    <span className="text-[var(--color-ink-500)]">Shared stash</span>
                                    <span className="text-[var(--color-ink-200)] text-right">
                                        {alliance.sharedCache.length === 0
                                            ? 'Empty'
                                            : alliance.sharedCache.map(i => i.name).join(', ')}
                                    </span>
                                </div>
                            </div>
                        </section>
                    )}

                    {(truces.length > 0 || protectees.length > 0 || owes.length > 0 || owed.length > 0 || suspicions.length > 0) && (
                        <section>
                            <h4 className="panel-title mb-2">Standings</h4>
                            <div className="space-y-3">
                                {truces.length > 0 && (
                                    <div>
                                        <Explainer
                                            align="left"
                                            label={<span className="eyebrow">Truces</span>}
                                            title="Truce"
                                        >
                                            An explicit, expiring non-aggression pact — not an alliance. Two tributes
                                            who both liked their odds elsewhere agreed not to fight, and are still
                                            honouring it. It lapses on its own, and it can be broken.
                                        </Explainer>
                                        <div className="space-y-1 mt-1">
                                            {truces.map(tr => (
                                                <div key={tr.id} className="flex justify-between items-center text-sm gap-2">
                                                    <span className="truncate text-[var(--color-ink-200)]">{tr.name}</span>
                                                    <span className="font-mono text-[10px] flex-none text-[var(--cat-alliance)]">
                                                        {tr.cyclesLeft} cycle{tr.cyclesLeft === 1 ? '' : 's'} left
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {protectees.length > 0 && (
                                    <div>
                                        <Explainer
                                            align="left"
                                            label={<span className="eyebrow">Under their protection</span>}
                                            title="Protector bond"
                                        >
                                            Somebody older or stronger appointed themselves this tribute's keeper.
                                            It reshapes what they try to do — they guard rather than hunt, and they
                                            will hand over food they need — and the Capitol's blocs notice.
                                        </Explainer>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {protectees.map(p => (
                                                <span
                                                    key={p.id}
                                                    className={`chip ${p.other!.status === 'dead' ? 'line-through' : ''}`}
                                                >
                                                    {p.other!.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(owes.length > 0 || owed.length > 0) && (
                                    <div>
                                        <Explainer
                                            align="left"
                                            label={<span className="eyebrow">Debts</span>}
                                            title="Debt"
                                        >
                                            What being saved costs. Somebody who took a real risk for this tribute —
                                            shared a fight, gave up supplies they needed, patched them up — is owed,
                                            and the debt makes turning on them markedly harder. It decays slowly, and
                                            it can be settled.
                                        </Explainer>
                                        <div className="space-y-1 mt-1">
                                            {owes.map(d => (
                                                <div key={`owes-${d.id}`} className="flex justify-between items-center text-sm gap-2">
                                                    <span className="truncate text-[var(--color-ink-200)]">Owes {d.name}</span>
                                                    <span className="font-mono text-[10px] flex-none text-[var(--cat-training)]">
                                                        {Math.round(d.amount)}
                                                    </span>
                                                </div>
                                            ))}
                                            {owed.map(d => (
                                                <div key={`owed-${d.id}`} className="flex justify-between items-center text-sm gap-2">
                                                    <span className="truncate text-[var(--color-ink-400)]">{d.name} owes them</span>
                                                    <span className="font-mono text-[10px] flex-none text-[var(--cat-alliance)]">
                                                        {Math.round(d.amount)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {suspicions.length > 0 && (
                                    <div>
                                        <Explainer
                                            align="left"
                                            label={<span className="eyebrow">Who they are watching</span>}
                                            title="Suspicion"
                                        >
                                            How much this tribute distrusts a specific ally, 0–{SUSPICION.max}. It is
                                            raised by witnessed betrayals and by broken alliance terms, it decays if
                                            nothing else happens, and it eats into trust. Past {SUSPICION.departThreshold} they
                                            will walk out of the alliance before anything is even done to them.
                                        </Explainer>
                                        <div className="space-y-1 mt-1">
                                            {suspicions.map(s => (
                                                <div key={s.id} className="flex justify-between items-center text-sm gap-2">
                                                    <span className="truncate text-[var(--color-ink-200)]">{s.name}</span>
                                                    <span className="font-mono text-xs flex-none text-[var(--cat-death)]">
                                                        {s.value >= SUSPICION.departThreshold ? 'marked' : s.value >= 30 ? 'suspicious' : 'watchful'} · {Math.round(s.value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {feuds.length > 0 && (
                        <section>
                            <h4 className="panel-title mb-2">Feuds</h4>
                            <div className="space-y-1">
                                {feuds.map(({ other, record }) => (
                                    <div key={other.id} className="flex justify-between items-center text-sm gap-2">
                                        <span className={`truncate ${other.status === 'dead' ? 'text-[var(--color-ink-500)] line-through' : 'text-[var(--color-ink-200)]'}`}>
                                            {other.name}
                                        </span>
                                        <span className="font-mono text-[10px] flex-none text-[var(--color-ink-400)]">
                                            {record.fights} fight{record.fights === 1 ? '' : 's'} ·
                                            {' '}{record.woundsDealt}–{record.woundsTaken} wounds
                                            {record.timesFled > 0 && ` · fled ${record.timesFled}×`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {feared.length > 0 && (
                        <section>
                            <h4 className="panel-title mb-2">Who frightens them</h4>
                            <div className="space-y-1">
                                {feared.map(({ other, value }) => (
                                    <div key={other!.id} className="flex justify-between items-center text-sm gap-2">
                                        <span className={`truncate ${other!.status === 'dead' ? 'text-[var(--color-ink-500)] line-through' : 'text-[var(--color-ink-200)]'}`}>
                                            {other!.name}
                                        </span>
                                        <span className="font-mono text-xs flex-none text-[var(--cat-death)]">
                                            {value >= 60 ? 'terrified' : value >= 30 ? 'wary' : 'uneasy'} · {value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <h4 className="panel-title mb-2">Inventory ({tribute.inventory.length})</h4>
                        <div className="space-y-1.5">
                            {tribute.inventory.length === 0 ? (
                                <span className="text-sm text-[var(--color-ink-400)]">Carrying nothing</span>
                            ) : tribute.inventory.map((item, i) => (
                                <div key={`${item.id}-${i}`} className="panel-flush p-2 flex justify-between items-center gap-2">
                                    <span className="text-sm text-[var(--ink)] truncate">
                                        {displayName(item)}
                                        {item.stack !== undefined && item.stack > 1 && (
                                            <span className="text-[var(--color-ink-500)]"> ×{item.stack}</span>
                                        )}
                                        {item.poison && <span className="ml-1 text-[var(--cat-death)]" title="Coated with poison.">☠</span>}
                                    </span>
                                    <span className="flex items-center gap-2 flex-none">
                                        {item.durability !== undefined && (
                                            <span
                                                className="text-[10px] font-mono"
                                                style={{ color: conditionOf(item) < 0.35 ? 'var(--red)' : 'var(--color-ink-500)' }}
                                                title="Condition. A worn weapon hits softer, not just closer to breaking."
                                            >
                                                {Math.round(conditionOf(item) * 100)}%
                                            </span>
                                        )}
                                        <span className="chip">{item.type}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <SponsorPanel tribute={tribute} gameState={gameState} />

                    <section>
                        <h4 className="panel-title mb-2">Social graph</h4>
                        <RelationshipGraph tribute={tribute} gameState={gameState} />
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">Relationships</h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {relationships.length === 0 ? (
                                <span className="text-sm text-[var(--color-ink-400)]">Has not met anyone yet</span>
                            ) : relationships.map(({ other, value, sworn, streak }) => (
                                <div key={other!.id} className="flex justify-between items-center text-sm gap-2">
                                    <span className={`truncate ${other!.status === 'dead' ? 'text-[var(--color-ink-500)] line-through' : 'text-[var(--color-ink-200)]'}`}>
                                        {other!.name}
                                    </span>
                                    {streak >= ROMANCE.sustainedCycles && other!.status === 'alive' && (
                                        <span
                                            className="font-mono text-[10px] flex-none text-[var(--color-ink-500)] ml-auto"
                                            title={`They have kept each other's company ${streak} cycles running — sustained contact, not one shared scene.`}
                                        >
                                            {streak}c together
                                        </span>
                                    )}
                                    <span
                                        className="font-mono text-xs flex-none"
                                        style={{ color: value > 0 ? 'var(--cat-alliance)' : value < 0 ? 'var(--cat-death)' : 'var(--color-ink-500)' }}
                                        title={sworn ? `${tribute.name} has sworn to kill ${other!.name}` : undefined}
                                    >
                                        {sworn ? '⚔ ' : ''}{value > 0 ? `+${value}` : value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                            <h4 className="panel-title">Their chronicle ({personalLog.length})</h4>
                            {/* §9.3: their whole story — fears, debts, feuds, what
                                ended them — as one shareable Markdown narrative. */}
                            <span className="flex gap-1.5">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-ghost"
                                    onClick={async () => {
                                        const ok = await copyTributeStory(gameState, tribute);
                                        setStoryCopied(ok ? 'ok' : 'fail');
                                        setTimeout(() => setStoryCopied('idle'), 2500);
                                    }}
                                >
                                    {storyCopied === 'ok' ? 'Story copied' : storyCopied === 'fail' ? 'Copy failed' : 'Copy their story'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => downloadTributeStory(gameState, tribute)}
                                >
                                    Download
                                </button>
                            </span>
                        </div>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                            {personalLog.length === 0 ? (
                                <span className="text-sm text-[var(--color-ink-400)]">Nothing recorded about them yet</span>
                            ) : (
                                [...personalLog].reverse().map(l => <FeedLine key={l.id} log={l} animate={false} cast={gameState.tributes} />)
                            )}
                        </div>
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">What they know</h4>
                        {knownZones.length === 0 ? (
                            <span className="text-sm text-[var(--color-ink-400)]">Nothing worth remembering yet</span>
                        ) : (
                            <div className="space-y-1">
                                {knownZones.map(z => (
                                    <div key={z.name} className="flex justify-between items-center text-sm gap-2">
                                        <span className="truncate text-[var(--color-ink-200)]">{z.name}</span>
                                        <span className="font-mono text-xs flex-none text-[var(--color-ink-400)]">
                                            {z.threat > 0.15 && <span style={{ color: 'var(--cat-death)' }}>danger {z.threat.toFixed(1)}</span>}
                                            {z.threat > 0.15 && z.rivals > 0 && ' · '}
                                            {z.rivals > 0 && `${z.rivals} seen`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
