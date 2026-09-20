import React, { useState } from 'react';
import { Hint } from '../components/Hint';
import { GameState, Tribute } from '../models/types';
import { RunProfileCard } from '../components/RunProfileCard';
import { heightLabel } from '../engine/physique';
import { prefsStore } from '../store/prefsStore';
import { useStore } from '../store/createStore';
import { Shuffle, FastForward } from 'lucide-react';
import { REAPING_CROWDS } from '../data/pregames';
import { LEGACY_EFFECTS, craftOf, legacyOf } from '../data/districts';
import { Explainer } from '../components/Explainer';
import { GamesProfile, calendarOf, ordinal, profileHeadline } from '../engine/gamesProfile';
import { standingLine } from '../engine/continuity';
import { INTERVIEW_PERSONAS } from '../data/personas';
import { InterviewPersona } from '../models/types';
import { isVeteran } from '../engine/veterans';

export function ReapingScreen({ tributes, arenaName, seed, profile, gameState, onReroll, onConfirm, onCoach }: {
    tributes: Tribute[],
    arenaName: string,
    seed: string,
    profile?: GamesProfile,
    /** §2.10: the whole run, for the profile card. */
    gameState?: GameState,
    onReroll: () => void,
    onConfirm: () => void,
    /** §6.10: pin one tribute's training and interview strategy. */
    onCoach?: (tributeId: string, coaching: { trainingStrategy?: 'showcase' | 'conceal' | 'balanced'; interviewStrategy?: InterviewPersona }) => void,
}) {
    const units = useStore(prefsStore, p => p.units);
    const coaching = gameState?.playerCoaching;
    const [coachId, setCoachId] = useState<string>(coaching?.tributeId ?? '');
    // Audit 4 §1.2: `veteransSeated` holds ids (names, in a legacy save).
    // `isVeteran` is the one predicate that reads both.
    const seatedVeterans = gameState?.veteransSeated ?? [];
    const veteranCount = tributes.filter(t => isVeteran(seatedVeterans, t)).length;
    const continuity = gameState?.continuity;
    const byDistrict = new Map<number, Tribute[]>();
    tributes.forEach(t => {
        if (!byDistrict.has(t.district)) byDistrict.set(t.district, []);
        byDistrict.get(t.district)!.push(t);
    });

    const volunteers = tributes.filter(t => t.volunteered);

    return (
        <div className="max-w-4xl mx-auto space-y-7">
            <div className="masthead dot-texture">
                <span className="masthead-ghost" aria-hidden="true">02</span>
                <span className="masthead-eyebrow">
                    02 — {profile ? `${ordinal(profile.gamesNumber)} Games · ` : ''}{arenaName} · seed {seed}
                </span>
                <h2 className="masthead-title text-5xl md:text-6xl">The Reaping</h2>
                <p className="masthead-sub text-sm">
                    {tributes.length} names have been drawn across {byDistrict.size} squares, and{' '}
                    {volunteers.length === 0
                        ? 'not one of them was volunteered for'
                        : `${volunteers.length} of them were answered by a volunteer`}. Only the public record is
                    released today — district, gender, age, height and build. The Gamemakers publish training
                    scores next; Caesar draws out the rest on the interview couch; everything else they will
                    have to show you in the arena.
                </p>
            </div>

            {/* §2.10: the run's identity in one place, before a single line of
                chronicle has been written. The player used to piece this
                together from scattered log lines, and two of these settings
                (the multipliers and the district count) had no surface at all. */}
            {gameState && <RunProfileCard gameState={gameState} />}

            {profile && (
                <div className="panel p-4 space-y-2 animate-riseIn">
                    <div className="eyebrow" style={{ color: 'var(--red)' }}>Capitol announcement</div>
                    <p className="text-sm text-[var(--ink)] font-semibold">
                        {profileHeadline(profile)}
                    </p>
                    <p className="text-label leading-relaxed text-[var(--color-ink-500)]">
                        {profile.temperament.blurb}
                    </p>
                    {profile.castShape && profile.castShape.id !== 'ordinary' && (
                        <p className="text-label leading-relaxed text-[var(--color-ink-500)]">
                            <strong className="text-[var(--ink)]">The draw is {profile.castShape.name}.</strong>{' '}
                            {profile.castShape.blurb}
                        </p>
                    )}
                    {/* The whole schedule, not just the headline: a run has 2-4
                        scheduled beats and the player is entitled to know how
                        many are coming, if not exactly what they will do. */}
                    <div className="space-y-1 pt-1">
                        {calendarOf(profile).map(w => (
                            <p key={`${w.day}-${w.kind}`} className="text-label leading-relaxed text-[var(--color-ink-500)]">
                                <span className="font-mono text-micro text-[var(--red)] mr-1.5">
                                    {w.day === 0 ? 'STANDING' : `DAY ${w.day}`}
                                </span>
                                {w.announcement}
                            </p>
                        ))}
                    </div>
                    <p className="text-mini text-[var(--color-ink-500)] italic">
                        Every Games is rolled from the seed — the temperament, the shape of the draw, and
                        each scheduled provision with the day it lands. Two runs on the same seed are the
                        same Games; two runs on different seeds are not.
                    </p>
                </div>
            )}

            {/* §9.3: what the last few Games left behind. Resolved by the
                engine at the reaping and, until now, printed only into the
                feed nobody reads before the arena opens. */}
            {continuity && (continuity.grudgeLine || Object.keys(continuity.standings).length > 0 || veteranCount > 0) && (
                <div className="panel p-4 space-y-2 animate-riseIn" style={{ borderColor: 'var(--gold)', borderWidth: 3 }}>
                    <div className="eyebrow" style={{ color: 'var(--gold)' }}>Your Panem remembers</div>
                    {continuity.grudgeLine && (
                        <p className="text-label leading-relaxed text-[var(--ink)]">
                            <strong>Grudge {continuity.grudge}/3.</strong> {continuity.grudgeLine}
                        </p>
                    )}
                    {Object.entries(continuity.standings).map(([d, standing]) => (
                        <p key={d} className="text-label leading-relaxed text-[var(--color-ink-500)]">
                            <span className="chip mr-1.5">{standing}</span>{standingLine(Number(d), standing)}
                        </p>
                    ))}
                    {veteranCount > 0 && (
                        <p className="text-label leading-relaxed text-[var(--color-ink-500)]">
                            <span className="chip chip-gold mr-1.5">Grudge match</span>
                            {tributes.filter(t => isVeteran(seatedVeterans, t)).map(t => `${t.name} (D${t.district})`).join(' and ')} have stood on the podium before, and are reaped again.
                        </p>
                    )}
                </div>
            )}

            {/* §6.10: coaching. The store action and both engine read sites
                existed; no control ever reached them. */}
            {onCoach && (
                <div className="panel p-4 space-y-2 animate-riseIn">
                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                        <span className="eyebrow">Coach one tribute</span>
                        <span className="text-mini text-[var(--color-ink-500)]">Pin how they train and the angle they take on the couch. Everyone else decides for themselves.</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <label className="text-mini text-[var(--color-ink-500)]">
                            Tribute{' '}
                            <select className="field text-xs w-auto" value={coachId} onChange={e => { setCoachId(e.target.value); if (e.target.value) onCoach(e.target.value, { trainingStrategy: coaching?.trainingStrategy, interviewStrategy: coaching?.interviewStrategy }); }}>
                                <option value="">— nobody —</option>
                                {[...tributes].sort((a, b) => a.district - b.district).map(t => (
                                    <option key={t.id} value={t.id}>D{t.district} · {t.name}</option>
                                ))}
                            </select>
                        </label>
                        <label className="text-mini text-[var(--color-ink-500)]">
                            Training{' '}
                            <select className="field text-xs w-auto" disabled={!coachId} value={coaching?.tributeId === coachId ? (coaching?.trainingStrategy ?? '') : ''}
                                onChange={e => onCoach(coachId, { trainingStrategy: (e.target.value || undefined) as 'showcase' | 'conceal' | 'balanced' | undefined, interviewStrategy: coaching?.interviewStrategy })}>
                                <option value="">their own call</option>
                                <option value="showcase">Showcase — score high, be watched</option>
                                <option value="conceal">Conceal — score low, be underestimated</option>
                                <option value="balanced">Balanced</option>
                            </select>
                        </label>
                        <label className="text-mini text-[var(--color-ink-500)]">
                            Interview{' '}
                            <select className="field text-xs w-auto" disabled={!coachId} value={coaching?.tributeId === coachId ? (coaching?.interviewStrategy ?? '') : ''}
                                onChange={e => onCoach(coachId, { trainingStrategy: coaching?.trainingStrategy, interviewStrategy: (e.target.value || undefined) as InterviewPersona | undefined })}>
                                <option value="">their own angle</option>
                                {INTERVIEW_PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </label>
                    </div>
                </div>
            )}

            <div className="flex justify-center gap-2">
                <Hint text="Draw a different cast from a new sub-seed">
                    <button onClick={onReroll} className="btn">
                        <Shuffle className="w-4 h-4" /> Reroll cast
                    </button>
                </Hint>
                <button onClick={onConfirm} className="btn btn-primary">
                    Confirm tributes <FastForward className="w-4 h-4" />
                </button>
            </div>

            {/* Audit 3 §2.7: the reaping square is the first screen of a run and
                the cast is its whole content — twelve to sixteen district panels,
                each holding a pair. Rendered as bare divs it read as one long
                undifferentiated list; as a labelled list of labelled groups it
                reads as the roster it is. */}
            <ul
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0"
                aria-label={`The reaped, by district — ${tributes.length} tributes across ${byDistrict.size} districts`}
            >
                {Array.from(byDistrict.entries()).sort((a, b) => a[0] - b[0]).map(([district, pair]) => (
                    <li key={district} className="panel p-4 space-y-2.5 animate-riseIn" aria-label={`District ${district}`}>
                        <div className="flex items-baseline justify-between gap-2">
                            <h3 className="panel-title text-[var(--red)]">District {district}</h3>
                            <Explainer
                                align="left"
                                label={<span className="chip">{legacyOf(district).industry}</span>}
                                title={`District ${district}: ${legacyOf(district).industry}`}
                            >
                                {craftOf(district).blurb}. Their record in the Games buys{' '}
                                {LEGACY_EFFECTS[legacyOf(district).tier].blurb}.
                            </Explainer>
                        </div>
                        {REAPING_CROWDS[district] && (
                            <p className="text-mini leading-relaxed text-[var(--color-ink-500)] italic">
                                {REAPING_CROWDS[district]}
                            </p>
                        )}
                        {pair.map(t => (
                            <div key={t.id} className="panel-flush p-3 flex justify-between items-center gap-3">
                                <div className="min-w-0">
                                    <div className="font-black text-[var(--ink)] truncate">
                                        {t.name}
                                        {isVeteran(seatedVeterans, t) && (
                                            <span className="ml-1.5 chip chip-gold" role="group" aria-label="A past victor from your Hall of Fame, reaped again." title="A past victor from your Hall of Fame, reaped again.">Victor</span>
                                        )}
                                        {t.fanFavourite && (
                                            <span className="ml-1.5 text-[var(--gold)]" role="group" aria-label="A Capitol favourite before the Games have even begun." title="A Capitol favourite before the Games have even begun.">★</span>
                                        )}
                                    </div>
                                    <div className="eyebrow mt-0.5">
                                        {t.gender}
                                        {t.volunteered && (
                                            <span className="ml-1.5 text-[var(--gold)]">· Volunteer</span>
                                        )}
                                    </div>
                                    {t.reapingNote && (
                                        <p className="text-mini leading-relaxed text-[var(--color-ink-500)] mt-1">
                                            {t.reapingNote}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right text-mini text-[var(--color-ink-500)] font-mono font-semibold leading-relaxed flex-none">
                                    <div>Age {t.age}</div>
                                    <div>{heightLabel(t.heightCm, units)}</div>
                                    <div>{t.build}</div>
                                </div>
                            </div>
                        ))}
                    </li>
                ))}
            </ul>
        </div>
    );
}
