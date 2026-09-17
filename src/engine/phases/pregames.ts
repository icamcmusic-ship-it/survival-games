import { isVeteran } from '../veterans';
import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import {
    CHARIOT_ANGLES, DISTRICT_TOKENS, GOODBYE_SCENES, REAPING_CROWDS, STYLISTS, TRAIN_SCENES,
} from '../../data/pregames';
import { PREGAMES } from '../../data/balance';
import { addExcitement } from '../audience';
import { adjustRel } from '../relationships';
import { clampTribute } from '../vitals';
import { legacyOf } from '../../data/districts';
import { HEAD_GAMEMAKERS } from '../../data/gamemakers';
import { resolveContinuity, standingEffect, standingLine } from '../continuity';
import { addNotoriety } from '../notoriety';
import { readPanem } from '../../utils/panemStorage';
import { ordinal } from '../gamesProfile';
import { loseSanity } from '../sanityBands';


const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

export function processPreGames(ctx: SimContext) {
    if (ctx.state.preGamesDone) return;
    ctx.state.preGamesDone = true;
    ctx.rng = new RNG(`${ctx.state.seed}-pregames`);

    const cast = getAlive(ctx.state);
    const districts = [...new Set(cast.map(t => t.district))].sort((a, b) => a - b);

    // ---- §10.5: victors reaped again ----
    // Announced before anything else, because it changes how the whole
    // broadcast reads: a field with a past victor in it is not an ordinary
    // reaping and the Capitol would not pretend otherwise.
    cast.filter(t => isVeteran(ctx.state.veteransSeated, t)).forEach(vet => {
        ctx.logEvent(
            `${vet.name} of District ${vet.district} walks onto the stage for the second time. `
            + `They won the ${vet.veteranOf} Games. There is a rule against this, or there was, and nobody in the Capitol is discussing it tonight.`,
            [vet.id],
            { important: true, category: 'system' }
        );
    });

    // ---- 0. The Head Gamemaker ----
    const headGamemaker = ctx.rng.pick(HEAD_GAMEMAKERS);
    ctx.state.headGamemaker = headGamemaker.name;
    ctx.logEvent(headGamemaker.openingLine, [], { important: true, category: 'gamemaker' });
    // REPLAY-10: they have a record in this player's Panem, and the broadcast
    // brings it up — which is what makes the country continuous between runs
    // rather than a series of unrelated Games.
    const panem = readPanem();

    /*
     * §9.3: what the last few Games left behind.
     *
     * `PanemRecords` already knew which Gamemaker had run how many of this
     * player's Games, which districts had been crowned, and how long the
     * current dynasty had run. None of it reached the arena. It does now, and
     * it is resolved here — where the Head Gamemaker has just been drawn and
     * the cast is standing on the stage — rather than in the store, so a
     * headless run with no record book simply gets no continuity.
     *
     * Derived, never stored: see `engine/continuity.ts` for why.
     */
    const continuity = resolveContinuity(panem, headGamemaker.name, [...new Set(cast.map(t => t.district))]);
    ctx.state.continuity = continuity;
    if (continuity.grudgeLine) {
        ctx.logEvent(continuity.grudgeLine, [], { important: true, category: 'gamemaker' });
    }
    Object.entries(continuity.standings).forEach(([key, standing]) => {
        const district = Number(key);
        const { trust, threat } = standingEffect(standing);
        const locals = cast.filter(t => t.district === district);
        if (locals.length === 0) return;
        locals.forEach(t => {
            t.sponsorTrust = Math.max(0, Math.min(100, t.sponsorTrust + trust));
            // A district that keeps winning walks in already known: everybody
            // else starts with a reputation for them. That is what a dynasty
            // costs, and it is the reason patronage is a decision rather than
            // a purchase.
            if (threat > 0) cast.forEach(other => addNotoriety(other, t.id, threat));
        });
        ctx.logEvent(standingLine(district, standing), locals.map(t => t.id), { important: true, category: 'system' });
    });

    // §10.4: the small continuity thread. Somebody from this district died in
    // an earlier Games carrying something from home, and the district sent it
    // back in. Purely cosmetic — nothing mechanical reads a token or a quirk —
    // and that is the point: repeat play should feel like it is accumulating
    // rather than resetting, without the accumulation becoming a power curve.
    Object.entries(panem.heirlooms ?? {}).forEach(([district, heirloom]) => {
        const candidates = cast.filter(t => t.district === Number(district) && !t.veteranOf);
        if (candidates.length === 0) return;
        if (!ctx.rng.chance(PREGAMES.heirloomChance)) return;
        const heir = ctx.rng.pick(candidates);
        heir.token = heirloom.token;
        if (heirloom.quirk && !(heir.quirks ?? []).includes(heirloom.quirk)) {
            heir.quirks = [...(heir.quirks ?? []), heirloom.quirk];
        }
        ctx.logEvent(
            `${heir.name} carries ${heirloom.token} out of the goodbye room in District ${district}. `
            + `It belonged to ${heirloom.fromName}, who did not bring it home, and District ${district} has been keeping it for somebody.`,
            [heir.id],
            { important: true, category: 'system' }
        );
    });

    const record = panem.gamemakerRecords?.[headGamemaker.name];
    if (record && record.games > 0) {
        const avgDays = (record.totalDays / record.games).toFixed(1);
        ctx.logEvent(
            `This is ${headGamemaker.name}'s ${ordinal(record.games + 1)} Games. `
            + `Of the previous ${record.games}, ${record.victors} produced a victor, `
            + `and they ran ${avgDays} days on average.`,
            [],
            { category: 'gamemaker' }
        );
    }

    // ---- 1. The square ----
    districts.forEach(district => {
        const crowd = REAPING_CROWDS[district];
        if (crowd) ctx.logEvent(crowd, [], { category: 'system' });

        cast.filter(t => t.district === district).forEach(t => {
            // §5 (requests): one line per tribute, and it is the record.
            //
            // The square used to produce two: the reaping note and a reaction
            // line drawn from `REAPING_REACTIONS`. The reaction line is the
            // "extra flavour" the request names — the faint, the walk, the
            // escort mispronouncing it — and it said nothing the tribute's own
            // sheet does not, twenty-four times a run, immediately next to the
            // note. It is gone; the note is what the reaping was.
            //
            // The volunteer lead-in is gone with it: every line in the two
            // volunteer pools now opens with "Volunteered", so prefixing it
            // with "X volunteers." printed the word twice in one sentence.
            ctx.logEvent(
                `${t.name} of District ${t.district}, ${t.age}.`
                + (t.reapingNote ? ` ${t.reapingNote}` : ''),
                [t.id],
                { important: true, category: 'system' }
            );
            // The excitement the two removed lines used to carry is kept: it is
            // a fact about how the country reacted, not a piece of prose.
            if (t.age <= PREGAMES.childAge) addExcitement(t, PREGAMES.childReactionExcitement);
            if (t.volunteered) addExcitement(t, PREGAMES.volunteerExcitement);
        });
    });

    // ---- 2. The goodbye room ----
    cast.forEach(t => {
        // §6.9: the district token, pressed into their hands here. Stored on
        // the tribute so the broadcast can find it again — at the sheet, at
        // the death, in the victor's hands on the way home.
        //
        // §12: the review board does not allow all of them. Every tribute used
        // to be issued a token unconditionally, which quietly turned the 'The
        // Token' achievement — crown a victor still carrying the one thing
        // they brought from home — into "win the Games", at a 98.8% fire rate.
        // A token somebody could have been refused is a token worth keeping.
        const tokenPool = DISTRICT_TOKENS[t.district];
        if (tokenPool && !t.token && ctx.rng.chance(PREGAMES.tokenAllowedChance)) {
            t.token = ctx.rng.pick(tokenPool);
            ctx.logEvent(
                `${t.name} leaves the goodbye room carrying their district token: ${t.token}. The review board will allow it. It is the only thing of home the arena will.`,
                [t.id],
                { category: 'system' }
            );
        } else if (tokenPool && !t.token) {
            ctx.logEvent(
                `${t.name} is asked to leave their token behind at the review board. No reason is given, and none is ever given. `
                + `They go in with nothing of home on them at all.`,
                [t.id],
                { category: 'system' }
            );
        }
        const scene = ctx.pickText(GOODBYE_SCENES);
        const alone = scene.startsWith('Nobody comes');
        ctx.logEvent(fill(scene, { tribute: t.name }), [t.id], { category: 'sanity' });
        if (alone) {
            loseSanity(t, PREGAMES.aloneGoodbyeSanity);
            // The Capitol has always liked a tribute nobody came for.
            t.sponsorTrust = Math.min(100, t.sponsorTrust + PREGAMES.aloneGoodbyeTrust);
        } else {
            t.vitals.sanity = Math.min(100, t.vitals.sanity + PREGAMES.goodbyeSanity);
        }
        clampTribute(t);
    });

    // ---- 3. The train ----
    cast.forEach(t => {
        ctx.logEvent(
            fill(ctx.pickText(TRAIN_SCENES), { tribute: t.name, mentor: t.mentorLegacy ?? 'Their mentor' }),
            [t.id],
            { category: 'system' }
        );
        // Two days in a compartment with the only other person from home.
        const partner = cast.find(o => o.district === t.district && o.id !== t.id);
        if (partner) adjustRel(t, partner.id, PREGAMES.trainPartnerBond);
    });

    // ---- 4. The Remake Center ----
    const stylists = ctx.rng.shuffle([...STYLISTS]);
    districts.forEach((district, index) => {
        const stylist = stylists[index % stylists.length];
        cast.filter(t => t.district === district).forEach(t => { t.stylist = stylist; });
    });

    // ---- 5. The chariot parade ----
    ctx.logEvent(
        'The chariots come down the City Circle. This is the first and last time most of the Capitol will look at any of these faces before the arena.',
        [],
        { important: true, category: 'system' }
    );

    cast.forEach(t => {
        const chariot = ctx.rng.pick(CHARIOT_ANGLES);
        t.chariotAngle = chariot.angle;
        ctx.logEvent(
            fill(chariot.line, {
                tribute: t.name,
                stylist: t.stylist ?? 'Their stylist',
                district: String(t.district),
            }),
            [t.id],
            { important: chariot.pull >= 2, category: 'system' }
        );

        // A parade is charisma and a stylist and nothing else. A well-dressed
        // tribute with nothing to say still gets one good night out of it.
        const pull = chariot.pull
            + (t.attributes.charisma - 5) * PREGAMES.paradeCharismaWeight
            + (legacyOf(t.district).tier === 'storied' ? PREGAMES.paradeLegacyBonus : 0);
        // The parade's whole purpose is buzz: remember how hard it landed so
        // the early-run sponsor stream can read it (chariotAngle stops being
        // a write-only flavour string).
        t.paradeBuzz = Math.max(0, pull);
        t.sponsorTrust = Math.max(0, Math.min(100,
            t.sponsorTrust + Math.round(pull * PREGAMES.paradeTrustPerPull)));
        t.reputation = Math.max(5, Math.min(95,
            t.reputation + Math.round(pull * PREGAMES.paradeReputationPerPull)));
        addExcitement(t, Math.max(0, pull * PREGAMES.paradeExcitementPerPull));
        clampTribute(t);
    });

    const talked = [...cast].sort((a, b) => b.sponsorTrust - a.sponsorTrust).slice(0, 2);
    if (talked.length > 0) {
        ctx.logEvent(
            `By the end of the night the Capitol is talking about ${talked.map(t => `${t.name} (D${t.district})`).join(' and ')}. Everybody else came down the same avenue and nobody remembers it.`,
            talked.map(t => t.id),
            { important: true, category: 'sponsor' }
        );
    }
}
