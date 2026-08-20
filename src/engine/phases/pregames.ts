import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import {
    CHARIOT_ANGLES, GOODBYE_SCENES, REAPING_CROWDS, REAPING_REACTIONS, STYLISTS, TRAIN_SCENES,
} from '../../data/pregames';
import { PREGAMES } from '../../data/balance';
import { addExcitement } from '../audience';
import { adjustRel } from '../relationships';
import { clampTribute } from '../vitals';
import { legacyOf } from '../../data/districts';
import { HEAD_GAMEMAKERS } from '../../data/gamemakers';

/**
 * Everything between the bowl and the training floor.
 *
 * SIDE-06: the reaping was a static grid and the pre-Games was three clicks.
 * The source material spends roughly half its page count here, and it is where
 * the audience decides who these people are — which in this simulation is not
 * decorative, because `sponsorTrust` and `excitementRating` are read by the
 * sponsor stream, the odds board, and (since CANON-07) by the Gamemakers when
 * they decide whether to start closing the arena.
 *
 * Five beats, each producing real numbers: the reaping square and the reaction
 * to a name being read, the goodbye room, the train, the Remake Center, and the
 * chariot parade.
 */

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

function reactionPool(t: Tribute) {
    if (t.age <= PREGAMES.childAge) return REAPING_REACTIONS.child;
    if (t.volunteered || t.isCareer || t.traits.includes('Brute')) return REAPING_REACTIONS.hardened;
    return REAPING_REACTIONS.ordinary;
}

export function processPreGames(ctx: SimContext) {
    if (ctx.state.preGamesDone) return;
    ctx.state.preGamesDone = true;
    ctx.rng = new RNG(`${ctx.state.seed}-pregames`);

    const cast = getAlive(ctx.state);
    const districts = [...new Set(cast.map(t => t.district))].sort((a, b) => a - b);

    // ---- 0. The Head Gamemaker ----
    const headGamemaker = ctx.rng.pick(HEAD_GAMEMAKERS);
    ctx.state.headGamemaker = headGamemaker.name;
    ctx.logEvent(headGamemaker.openingLine, [], { important: true, category: 'gamemaker' });

    // ---- 1. The square ----
    districts.forEach(district => {
        const crowd = REAPING_CROWDS[district];
        if (crowd) ctx.logEvent(crowd, [], { category: 'system' });

        cast.filter(t => t.district === district).forEach(t => {
            if (t.reapingNote) {
                ctx.logEvent(`${t.name} volunteers. ${t.reapingNote}`, [t.id], { important: true, category: 'system' });
            }
            ctx.logEvent(
                fill(ctx.pickText(reactionPool(t)), { tribute: t.name }),
                [t.id],
                { important: t.age <= PREGAMES.childAge, category: 'system' }
            );
            // The country watched that reaction, and it is the first thing the
            // Capitol knows about them.
            if (t.age <= PREGAMES.childAge) addExcitement(t, PREGAMES.childReactionExcitement);
            if (t.volunteered) addExcitement(t, PREGAMES.volunteerExcitement);
        });
    });

    // ---- 2. The goodbye room ----
    cast.forEach(t => {
        const scene = ctx.pickText(GOODBYE_SCENES);
        const alone = scene.startsWith('Nobody comes');
        ctx.logEvent(fill(scene, { tribute: t.name }), [t.id], { category: 'sanity' });
        if (alone) {
            t.vitals.sanity = Math.max(0, t.vitals.sanity - PREGAMES.aloneGoodbyeSanity);
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
