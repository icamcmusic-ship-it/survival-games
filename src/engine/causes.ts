import { DamageRecord, DeathCauseCode } from '../models/types';

/**
 * AUDIT-9 (audit §"robustness"): cause codes, so telemetry stops reading English.
 *
 * The audit's closing recommendation was to "introduce structured event types
 * and cause codes, then render prose from them. Several measurements currently
 * depend on matching English text; that makes writing changes capable of
 * breaking telemetry."
 *
 * The problem is real and measured. Across 200 runs the engine produces **373
 * distinct cause-of-death strings** — "Bled out from a wound Cashmere opened",
 * "Buried in the collapse of The Bone Hoppers", "Torn apart by Pan Scuttlers"
 * — and six separate files each re-implement their own regexes over them:
 * `achievements.ts` greps for `nightlock`, `collapsing border|border closed`,
 * `drown|tide|undertow|rip ?tide` and `^Killed by`; `metrics.ts` buckets deaths
 * by string prefix; `soak.ts` tests `/Died of sepsis/`; `notables.ts` matches
 * `nightlock|rather than keep playing`. Every one of those is a separate copy
 * of the same classification, and every one can rot independently the moment a
 * line is reworded. `soak.ts` already carries a comment about two probes that
 * read zero for several commits because their strings had been edited out.
 *
 * So: one code per death, and one place that decides it.
 *
 *   - `DamageRecord.code` is the code set *at the site*, which is the real fix
 *     — the site knows what it is doing and does not have to be guessed at.
 *   - `classifyCause` is the fallback for the sites that have not been
 *     annotated, and it is the *only* classifier in the codebase. Six copies
 *     that can disagree become one that can be checked.
 *   - `scripts/check-cause-codes.ts` runs the engine and fails if any cause
 *     string the simulation actually produces falls out of the taxonomy. That
 *     is what makes rewording safe: change the words, and either the code
 *     still resolves or the build says so by name. Silence stops being an
 *     option.
 *
 * The prose is untouched. A chronicle still reads the way it read; the
 * measurements simply stop depending on it.
 */

/** Ordered most-specific first: the first matching rule wins. */
const RULES: Array<[DeathCauseCode, RegExp]> = [
    // --- deliberate endings, before anything they would otherwise look like ---
    ['nightlock', /nightlock/i],
    ['self-inflicted', /rather than keep playing|went out to the caller/i],

    // AUDIT-12 E14: shapes that carry a zone name. Zone names say "Frozen",
    // "Ash", "Fire" — so these match first, before the body rules can read
    // the place as the cause.
    ['fall', /^fell in .+ when .+ went|^dragged down in .+ by what they would not let go of/i],
    ['border', /^crushed as .+ closed$/i],

    // --- another tribute ---
    ['tribute', /^Killed by |confusion of a group fight/i],
    // A wound somebody opened is a tribute-attributed bleed; untreated wounds
    // and a failed rescue are not. Both are bleeding.
    ['bleeding', /^Bled out/i],

    // --- the body, in the order the injury layer escalates ---
    ['sepsis', /sepsis/i],
    ['infection', /infected wound|infested/i],
    ['poison', /poison|knew better than to eat|the second thing after the first|stung down by the bloom/i],
    ['dehydration', /dehydration/i],
    ['starvation', /starvation/i],
    ['shock', /went into shock/i],
    ['exhaustion', /exhaustion|did not wake/i],
    ['hypothermia', /froze|exposure|hypotherm/i],
    ['heatstroke', /heatstroke/i],
    ['burns', /burn|caught in the fire|burned on the bog|rendered on the floor/i],
    ['asphyxiation', /choked|suffocated|smoke/i],

    // --- the arena ---
    // AUDIT-12 E14: "Crushed as X closed" is the border closing over a chokepoint —
    // matched here, before `collapse` and its roof-and-wall wording.
    ['border', /border|force field|closed$|as .+ closed/i],
    ['mutt', /torn apart by|stampede|devoured by/i],
    ['drowning', /drown|into the sump|flooding|went under/i],
    ['collapse', /buried in the collapse|brought down by the roof|calving|shifting wall/i],
    ['fall', /^fell |could not make the climb|ground gave way|down an open shaft|down with the (bench|terrace)|^fell in .+ when .+ went/i],
    ['trap', /deadfall|their own snare|abandoned pit/i],
    ['machinery', /machinery|taken by the ride|pressure pod|steel-jawed/i],
    ['gamemaker', /gamemaker|caught by the clock|defying the|off the plate before the gong/i],
];

/**
 * AUDIT-13 W5: the arena-sourced wording that used to reach the `hazard`
 * catch-all. 134 authored lethal entries (652 distinct strings with the
 * universal pool) resolved there, so the death table could not tell a falling
 * serac from a lightning strike from a boar.
 *
 * Consulted only after every rule above has failed *and* only for arena-kind
 * damage: "Crushed" in a tribute's obituary is still the tribute, and nothing
 * already coded moves. That makes this strictly a split of the old `hazard`
 * bucket, never a re-reading of anything else.
 */
const HAZARD_RULES: Array<[DeathCauseCode, RegExp]> = [
    // AUDIT-14 W4: the named leftovers that still ended on `hazard`.
    ['asphyxiation', /in the flue|in the chimney|flue\b/i],
    ['machinery', /by the pumps|the pumps|winch|turbine|mangle|press house/i],
    ['crush', /on gull rock|under gull rock|lost a hand/i],
    ['electrocution', /electrocut|lightning|live (wire|rail)|substation|^struck$|arc(ed)? (flash|through)|third rail/i],
    ['exposure-pressure', /pressure|decompress|vacuum|air-?lock|the bends|nitrogen|cold shock|depth/i],
    ['sound', /resonan|deafen|the note|shriek|the (bells?|organ)\b|bell-?toll|sound|scream(ed|ing)? (them|until)|deep organ/i],
    ['animal', /mauled|gored|bitten|trampled by|stampede|snake|adder|viper|\bbear\b|\bboar\b|\bherd\b|shark|vultures?|\bowls\b|\bbats\b|harriers|wasps?|hornets?|jellyfish|stonefish|\beels?\b|crocodile|big cat|\blions?\b|tiger|wolves|wolf\b|swarm/i],
    ['crush', /crush|trampled|pinned|squeezed|between (the )?(ice )?plates|under (a|the) (serac|wheel|big top|snow load|counterweight)|falling (bell|limb|pine|serac|snag|cable car|big top|star|trunk)|fallen (star|giant)|collapsing cap|failing support|blast door|rafting ice|moving ice|wedged/i],
    // Existing codes the prose names in words the main rules never learned.
    ['burns', /scald|cooked|boiled|steam/i],
    ['mutt', /jabberjay|tracker jacker/i],
    ['fall', /^fell$|walked off an edge|rope parted|off (a|the) (ledge|edge|lip|cliff)/i],
    ['trap', /own trap|arena's own trap|rigged/i],
    ['hypothermia', /whiteout|blizzard|frostbit/i],
    ['infection', /fever|old wound|wound they would not/i],
    ['exhaustion', /heart gave out|body simply stopped|died in their sleep|seizure/i],
    ['poison', /allergic|standing water|too much of the cure|stung to death/i],
    ['starvation', /starved/i],
    ['asphyxiation', /\bgas\b|fumes|overcome|smothered|buried alive/i],
    ['drowning', /(taken|swept|pulled) (by|under|off|out)( by)? the (tide|wave|surge|rip|king tide|storm surge|great wave|rogue wave)|swallowed by|taken under|swept (away|off|out)/i],
    ['collapse', /\bburied\b|avalanche|collapse|(rock|scree|mud|snow)[ -]?slide|landslip|cave-?in/i],
    ['dehydration', /thirst/i],
    ['impact', /struck by|blown (off|from|out)|thrown (from|when|off)|knocked (off|out)|flying (timber|debris|glass)|ricochet|hail|explo|detonat|blast|shatter|shards|flayed|shot\b|eruption|when the .+ (burst|went|woke)|swung|scheduled blast|dump went/i],
    /*
     * AUDIT-14 W4: the ~330 arena-pack obituaries that still reached the
     * catch-all. Grouped by what the words actually describe; the order runs
     * from the most specific wording to the least, and the last rule is the
     * arena's makers themselves, never `hazard`.
     */
    ['asphyxiation', /suffocat|scrubbers|strangl|garrot|breathed|\bash\b|ventilation|\bchoke\b|lungs|sealed on|locked (in|into)/i],
    ['animal', /condors|ravens|\btroop\b|cat house|aviary|aquarium|feeding time|constricted|eaten alive|borer|leeches|locusts|gulls|petrels|choughs/i],
    ['mutt', /hounds|\bdogs\b|stalkers|ticks|worm|the (warden|dredger|ferryman|barker|others|bramble|topiary|unseen|deep listener|standing char|thing|understory)|taken (from below|from above|from under|by something)|wrapped|\bweb\b|silk|whatever was in|thornvine|vines|mycelium|cordyceps|sump wader|hook line|hooks/i],
    ['drowning', /tide|tidal|water table|shallows|reservoir|\bpool\b|river|millpond|\bwell\b|\bsink\b|open water|ice edge|under the ice|went through|into the water|channel|brine|\bmud\b|thaw|drifted|adrift|with the island|flooded/i],
    ['heatstroke', /heat|no shade|salt-cured|outcrop/i],
    ['dehydration', /last water|dried oasis|water that was not|waited for a parachute/i],
    ['infection', /\brot|wound|infected|fouled|fruited|spores|digested/i],
    ['shock', /fright|mind|whispers|\bhum\b|voices|sleep from waking|never heard/i],
    ['machinery', /\bline\b|escapement|ore cart|loose cart|rendering|sawmill|sprinklers|emergency lights|sector line/i],
    ['impact', /impaled|cut down|shredded|hit the far end|charge|brained|ambush|put against|scree|ice slide|picket wire|crown break|lighthouse|beam|\bbench\b|signal post|rebar|breaking cover|weapon broke/i],
    ['fall', /^fell\b|broke|over the edge|off (an|a|the)|pushed off|went down with|carried down|caldera|drain grate|tripped|slick|\bnest\b|shaken out|driven off|into a wall|stump/i],
    ['exposure', /radiation|lost|walked|wander|stepped|followed|led astray|mirage|shimmer|passage|bearing|ran out of|dusk|\bdark\b|fog|blind|circles|stopped|went on until|never (got out|left)|left in|room|new door|thread|turn they|hour|stranded|squall|exhausted|watch|dug in|carrying too much|\bopen\b|flats|glass sea|dust|cordon/i],
    ['trap', /root cage/i],
    ['poison', /urchin/i],
    ['burns', /lit up/i],
    ['collapse', /did not come out/i],
    ['mutt', /run down|tracked|hunted|given away|called out|found (in|by|under|them)/i],
    ['gamemaker', /killed|died|taken|cornered|caught|answered|bargain|wished|word|register|kept|moral|plot|ending|offered|period|session|bow|names|wrong camp|fire|parachute|went into|carpet|reception|hedge|walls|centre|gate/i],
];

/**
 * AUDIT-13 W5: an explicit `code: 'hazard'` is the same catch-all written down.
 * ~780 authored entries across the arena packs carry it verbatim; rather than
 * hand-edit every one of them (and conflict with every other pass touching
 * those files), the one place damage lands refines it through the same table.
 * Anything the table cannot place stays `hazard`.
 */
export function refineHazardCode(code: DeathCauseCode | undefined, cause: string | undefined): DeathCauseCode | undefined {
    if (code !== 'hazard') return code;
    for (const [c, pattern] of HAZARD_RULES) {
        if (pattern.test(cause ?? '')) return c;
    }
    return code;
}

/**
 * The code for a cause string, falling back on the damage `kind` where the
 * prose says nothing specific. Never returns `unknown` for a kind that names
 * a source, because "some tribute did it" is itself a classification.
 */
export function classifyCause(cause: string | undefined, kind?: DamageRecord['kind']): DeathCauseCode {
    const text = cause ?? '';
    for (const [code, pattern] of RULES) {
        if (pattern.test(text)) return code;
    }
    // Nothing in the wording matched. The damage record's broad bucket is a
    // weaker answer than a code but a much better one than nothing, and it is
    // structured rather than written.
    switch (kind) {
        case 'tribute': return 'tribute';
        case 'mutt': return 'mutt';
        case 'gamemaker': return 'gamemaker';
        case 'climate': return 'exposure';
        case 'hazard':
        case 'arena':
            for (const [code, pattern] of HAZARD_RULES) {
                if (pattern.test(text)) return code;
            }
            return 'hazard';
        case 'status': return 'status';
        default: return 'unknown';
    }
}

/**
 * The code a death should carry: whatever the site declared, else classified.
 *
 * Every reader goes through this rather than through a regex of its own, so
 * there is exactly one answer to "what killed them" in the codebase.
 */
export function deathCodeOf(t: { causeCode?: DeathCauseCode; causeOfDeath?: string; lastDamage?: DamageRecord }): DeathCauseCode {
    if (t.causeCode) return t.causeCode;
    if (t.lastDamage?.code) return t.lastDamage.code;
    return classifyCause(t.causeOfDeath ?? t.lastDamage?.cause, t.lastDamage?.kind);
}

/** Codes that mean another tribute did it, for the several readers that ask. */
export function isTributeDealt(code: DeathCauseCode): boolean {
    return code === 'tribute';
}

/**
 * The broad family a code belongs to, for the readers that bucket rather than
 * discriminate — the metrics death table, mostly.
 */
export const CAUSE_FAMILY: Record<DeathCauseCode, 'tribute' | 'body' | 'arena' | 'mutt' | 'gamemaker' | 'unknown'> = {
    tribute: 'tribute',
    bleeding: 'body',
    infection: 'body',
    sepsis: 'body',
    poison: 'body',
    dehydration: 'body',
    starvation: 'body',
    exhaustion: 'body',
    hypothermia: 'body',
    heatstroke: 'body',
    burns: 'body',
    shock: 'body',
    asphyxiation: 'body',
    exposure: 'body',
    status: 'body',
    nightlock: 'body',
    'self-inflicted': 'body',
    drowning: 'arena',
    fall: 'arena',
    collapse: 'arena',
    border: 'arena',
    trap: 'arena',
    machinery: 'arena',
    hazard: 'arena',
    // AUDIT-13 W5: the split-out hazard codes. `animal` is not a mutt — nothing
    // the Capitol made — so it sits with the arena.
    crush: 'arena',
    impact: 'arena',
    electrocution: 'arena',
    sound: 'arena',
    animal: 'arena',
    'exposure-pressure': 'arena',
    mutt: 'mutt',
    gamemaker: 'gamemaker',
    unknown: 'unknown',
};

/**
 * AUDIT-14 W3: an obituary names a zone by its plain name. "The Cornucopia
 * (The Ash Clearing)" is a map label; in a cause of death it reads as
 * "The Cornucopia". Applied where a non-tribute death's cause is recorded, so
 * every path that builds the string from `t.zone` is covered at once.
 */
export function plainZoneLabels(state: { arena: { zones: Array<{ name: string }> } }, cause: string): string {
    let out = cause;
    for (const z of state.arena.zones) {
        if (!z.name.includes('(') || !out.includes(z.name)) continue;
        out = out.split(z.name).join(z.name.replace(/\s*\([^)]*\)\s*$/, '') || z.name);
    }
    return out;
}
