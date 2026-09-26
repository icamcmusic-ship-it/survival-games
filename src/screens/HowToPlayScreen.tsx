import React, { useState } from 'react';
import { ARCHETYPES } from '../data/archetypes';
import { STANCE_PROFILES, STANCES } from '../data/stances';
import { TRAIT_DEFS, ROLLABLE_TRAITS } from '../data/traits';
import { QUIRKS } from '../data/quirks';
import { LAW_LABELS } from '../data/arenaBriefing';
import { ARENAS } from '../data/constants';
import { ArenaLawId } from '../models/types';

/**
 * §(requests 4): what the words mean, and how the simulation decides.
 *
 * A tribute sheet shows an archetype, a stance, traits, proficiencies and a
 * quirk, and nothing anywhere said which of those the player chose, which the
 * reaping rolled, which the arena changes, or which of them is actually
 * driving a decision. This is that page: one section per layer, in the order
 * the engine resolves them, with the real counts read from the data tables so
 * it cannot drift from the game it is describing.
 */

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children?: React.ReactNode }) {
    return (
        <section id={id} className="panel p-5 space-y-3" aria-labelledby={`${id}-h`}>
            <h3 id={`${id}-h`} className="display-title text-lg">{title}</h3>
            <p className="text-sm text-[var(--color-ink-300)] leading-relaxed">{lead}</p>
            {children}
        </section>
    );
}

/** A definition row: the term, what sets it, and whether it can change mid-run. */
function Layer({ term, sets, changes, drives }: { term: string; sets: string; changes: string; drives: string }) {
    return (
        <tr className="border-t border-[var(--color-ink-800)] align-top">
            <th scope="row" className="text-left py-2 pr-3 font-black text-[var(--ink)] whitespace-nowrap">{term}</th>
            <td className="py-2 pr-3 text-[var(--color-ink-300)]">{sets}</td>
            <td className="py-2 pr-3 text-[var(--color-ink-300)]">{changes}</td>
            <td className="py-2 text-[var(--color-ink-300)]">{drives}</td>
        </tr>
    );
}

export function HowToPlayScreen() {
    const [openArchetypes, setOpenArchetypes] = useState(false);
    const [openTraits, setOpenTraits] = useState(false);

    const archetypes = Object.values(ARCHETYPES);
    const earnedTraits = Object.keys(TRAIT_DEFS).filter(n => TRAIT_DEFS[n].earned);
    const conditionalStances = STANCES.filter(s => STANCE_PROFILES[s].conditional);
    const lawIds = Object.keys(LAW_LABELS) as ArenaLawId[];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="masthead dot-texture">
                <span className="masthead-ghost" aria-hidden="true">00</span>
                <span className="masthead-eyebrow">00 — How To Play</span>
                <h2 className="masthead-title text-4xl md:text-5xl">The Rules Of The Thing</h2>
                <p className="masthead-sub font-semibold text-sm mt-2">
                    You do not control a tribute. You set the conditions, and then you watch what the conditions do.
                </p>
            </div>

            <Section
                id="what-this-is"
                title="What this is"
                lead="A simulation, not a game with inputs. You choose the arena, the size of the field and the dials the
                      Capitol would have chosen, you may coach one tribute and place wagers, and then twenty-four people
                      make their own decisions for as long as they last. Everything on the screen afterwards is a record
                      of what they actually did — the chronicle is the primary artefact, and every other screen is a
                      different view onto it."
            >
                <ol className="text-sm text-[var(--color-ink-300)] space-y-1.5 list-decimal ml-5">
                    <li><b>Set up.</b> Arena, district count, and the pacing dials. A Games temperament, a cast shape and — rarely — a Quarter Quell are rolled from your seed.</li>
                    <li><b>The reaping.</b> Twenty-four names. You may re-reap, and you may pin one tribute to coach.</li>
                    <li><b>The pre-Games.</b> The square, the train, the parade, three days on the training floor, the scores, the interviews. Each is its own page in the chronicle.</li>
                    <li><b>The arena.</b> A bloodbath, then alternating days and nights until one tribute is left — or nobody is.</li>
                    <li><b>The record.</b> Achievements, the Hall of Fame, and a Panem that remembers across runs.</li>
                </ol>
            </Section>

            <Section
                id="layers"
                title="Stance, archetype, trait, proficiency, quirk"
                lead="These are the five layers of a tribute, and they are constantly mistaken for each other. The
                      difference that matters is what sets them and how often they change."
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-micro font-mono uppercase tracking-wider text-[var(--color-ink-500)]">
                                <th scope="col" className="text-left py-1 pr-3">Layer</th>
                                <th scope="col" className="text-left py-1 pr-3">Where it comes from</th>
                                <th scope="col" className="text-left py-1 pr-3">How often it changes</th>
                                <th scope="col" className="text-left py-1">What it actually does</th>
                            </tr>
                        </thead>
                        <tbody>
                            <Layer
                                term="Archetype"
                                sets={`Rolled at the reaping from district and cast shape. ${archetypes.length} of them.`}
                                changes="Never. It is who this person is."
                                drives="Weights every decision: how readily they fight, ally, betray or run; which stances they lean into; who they go after; and a once-per-run set piece of their own."
                            />
                            <Layer
                                term="Trait"
                                sets={`${ROLLABLE_TRAITS.length} rolled at the reaping; ${earnedTraits.length} more can only be earned in the arena.`}
                                changes="Earned, shed or transformed by what happens."
                                drives="A row of numbers against named hooks — hunger drain, ambush, retreat, betrayal resistance and forty-odd others. Traits are the arithmetic; the archetype is the disposition."
                            />
                            <Layer
                                term="Proficiency"
                                sets="Starts low, and grows only by doing the thing."
                                changes="Constantly, in small steps."
                                drives="Melee, ranged, forage, tracking, medicine, persuasion, climbing, swimming, crafting, stealth and intimidation. A tribute who forages every day gets better at foraging."
                            />
                            <Layer
                                term="Stance"
                                sets={`Chosen by the tribute, every cycle, from ${STANCES.length} options.`}
                                changes="Cycle to cycle — but with hysteresis, so it does not thrash."
                                drives="What they are doing right now: pressing, holding, hiding, hunting one person, dug in, tending an ally, walking a perimeter. The single most load-bearing thing on the sheet."
                            />
                            <Layer
                                term="Quirk"
                                sets={`One or two, at the reaping, from ${QUIRKS.length}.`}
                                changes="Never."
                                drives="A habit the cameras find — and a small modifier row, so the habit is also mechanical. This is what makes two tributes with the same archetype and traits read as different people."
                            />
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">
                    The short version: <b>archetype</b> is character, <b>traits</b> are the numbers, <b>proficiencies</b>
                    {' '}are practice, <b>stance</b> is right now, and <b>quirks</b> are the camera.
                </p>
            </Section>

            <Section
                id="stances"
                title={`The ${STANCES.length} stances`}
                lead={`Three are always available. The other ${conditionalStances.length} are conditional: a tribute can only
                       take them when the situation allows, which is why a Fortified tribute means something specific
                       happened rather than that they felt cautious.`}
            >
                <ul className="space-y-1.5 text-sm list-none m-0 p-0">
                    {STANCES.map(id => {
                        const s = STANCE_PROFILES[id];
                        return (
                            <li key={id} className="flex flex-wrap gap-x-2 items-baseline">
                                <span className="font-black text-[var(--ink)]">{s.label}</span>
                                <span className="chip chip-sm">{s.family}</span>
                                {s.conditional && <span className="chip chip-sm" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>conditional</span>}
                                <span className="text-[var(--color-ink-300)] text-xs">{s.blurb}</span>
                            </li>
                        );
                    })}
                </ul>
            </Section>

            <Section
                id="archetypes"
                title={`The ${archetypes.length} archetypes`}
                lead="Rolled from district and the year's cast shape. Careers come out of 1, 2 and 4; the outer districts
                      produce different people, and a cast shape can tilt the whole field."
            >
                <button className="btn btn-sm" onClick={() => setOpenArchetypes(v => !v)} aria-expanded={openArchetypes}>
                    {openArchetypes ? 'Hide the table' : 'Show all of them'}
                </button>
                {openArchetypes && (
                    <ul className="space-y-2 text-sm list-none m-0 p-0">
                        {archetypes.map(a => (
                            <li key={a.id}>
                                <span className="font-black text-[var(--ink)]">{a.name}</span>
                                {a.tagline && <span className="text-[var(--color-ink-500)] italic text-xs ml-2">“{a.tagline}”</span>}
                                <p className="text-xs text-[var(--color-ink-300)] m-0 mt-0.5">{a.description}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section
                id="traits"
                title={`Traits: ${ROLLABLE_TRAITS.length} reaped, ${earnedTraits.length} earned`}
                lead="A reaped trait is dealt to you. An earned trait is something the arena did to you, and several of
                      them replace a trait you walked in with — a Pacifist who keeps killing does not stay a Pacifist."
            >
                <button className="btn btn-sm" onClick={() => setOpenTraits(v => !v)} aria-expanded={openTraits}>
                    {openTraits ? 'Hide the list' : 'Show all of them'}
                </button>
                {openTraits && (
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                        {Object.entries(TRAIT_DEFS).map(([name, def]) => (
                            <div key={name}>
                                <span className="font-black text-[var(--ink)]">{name}</span>
                                {def.earned && <span className="chip chip-sm ml-1" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>earned</span>}
                                <p className="text-[var(--color-ink-400)] m-0">{def.info}</p>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            <Section
                id="arena"
                title="The arena, and its laws"
                lead={`${ARENAS.length} hand-built arenas plus a generator, each with its own zone graph, climate, mutts
                       and event pack. Most also carry one or more standing laws — a rule that holds for the whole run —
                       and a signature: a thing the arena does to people, on its own schedule.`}
            >
                <ul className="space-y-1 text-xs list-none m-0 p-0">
                    {lawIds.map(id => (
                        <li key={id}>
                            <span className="font-black text-[var(--ink)]">{LAW_LABELS[id].name}</span>
                            <span className="chip chip-sm ml-1.5">{LAW_LABELS[id].kind}</span>
                            <span className="text-[var(--color-ink-400)] ml-1.5">{LAW_LABELS[id].detail}</span>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section
                id="methodology"
                title="Methodology — how a decision is actually made"
                lead="Nothing in here is a coin flip dressed up as a story. Each cycle, for every living tribute, the
                      engine runs the same sequence, and the chronicle is written from what it decided."
            >
                <ol className="text-sm text-[var(--color-ink-300)] space-y-1.5 list-decimal ml-5">
                    <li><b>Read the board.</b> Who is in this sector, how they compare, what is remembered about this ground, how frightened this tribute is and of whom.</li>
                    <li><b>Score every stance.</b> Archetype, traits, health, kit, allies, the ground itself and the size of the field each contribute. Conditional stances are dropped unless their precondition holds.</li>
                    <li><b>Hold or switch.</b> A challenger has to clearly beat the incumbent, and each stance has a minimum hold, so nobody flips every cycle.</li>
                    <li><b>Pick an intention.</b> Survive, reach somewhere, hunt somebody, flee, protect, hold ground, stalk or wait — weighted by archetype and by what just happened.</li>
                    <li><b>Move, or work the ground.</b> Destinations are scored on danger, resources, memory and the objective. Staying put is a real option and is chosen about half the time.</li>
                    <li><b>Resolve.</b> Encounters, combat, the arena's own event pack, mutts, weather, hunger, thirst, wounds, infection and sanity, in that order.</li>
                    <li><b>Write it down.</b> Every one of those steps that produced something a broadcast would show becomes a line in the chronicle, with a timestamp and a category.</li>
                </ol>
                <p className="text-xs text-[var(--color-ink-500)] leading-relaxed">
                    Everything is seeded. The same seed, arena and settings replay the same Games line for line, in any
                    browser — which is what makes a shared link worth sharing.
                </p>
            </Section>

            <Section
                id="reading"
                title="Reading the chronicle"
                lead="One page per phase, in order. The left column is the arena clock, then the category, then the
                      sector, then what happened."
            >
                <ul className="text-sm text-[var(--color-ink-300)] space-y-1 list-disc ml-5">
                    <li><b>Density</b> — Headlines is the skeleton of the Games; Scenes adds the fighting and the weather; Everything is the full tape.</li>
                    <li><b>Categories</b> can be muted individually, and the number keys toggle whole groups.</li>
                    <li><b>Following</b> a tribute filters the record to their story, which is the best way to read a run a second time.</li>
                    <li><b>Red</b> is a death or a kill, and there is exactly one red line per death.</li>
                </ul>
            </Section>
        </div>
    );
}
