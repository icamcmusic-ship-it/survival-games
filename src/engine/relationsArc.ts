/**
 * AUDIT-13 §6: relationship arcs.
 *
 * The audit found the social layer busy and forgetful: alliances reshuffled
 * every two cycles, betrayal was rare and arrived from nowhere, district
 * partners had one beat, romance barely happened, vengeance was sworn and
 * forgotten, and nobody looked after anybody younger. Each of those has a
 * small arc here, run once per alliance phase after the structure upkeep:
 *
 *   R1  the two halves of a split meet again: reunion or feud
 *   R3  the betrayal-intent score, with a warning beat a cycle ahead
 *   R4  the district partner: the search, the last of the district, the
 *       final-two standoff
 *   R5  the slow burn: allies of an age sharing a camp, declared in the end
 *   R6  vengeance cooling when the target has been out of sight for days
 *   R7  the ward: an older ally teaches and stands for a young one, and the
 *       young one keeps something of them
 *
 * Every beat is typed so `test:audit13-relations` can count it.
 */
import { SimContext, getAlive } from './context';
import { Proficiency, Tribute } from '../models/types';
import { ALLIANCES, AUDIT13_RELATIONS, AUDIT14_RELATIONS } from '../data/balance';
import { ARCHETYPES } from '../data/archetypes';
import { TRAITS, traitFits } from '../data/constants';
import { traitMod } from '../data/traits';
import { adjustRel, getRel, trustOf } from './relationships';
import { allianceOf, allied, areLovers, isStarCrossed, membersOf, mergeAllianceRecords, registerAlliance } from './alliance';
import { cycleOf, ensureMemory, hasStoodBy, hasVengeanceAgainst, rememberedPlaceOf } from './memory';
import { inventoryValue } from './items';
import { resolveBetrayal } from './betrayal';
import { oathRefusesBetrayal } from './traitHooks';
import { noteGrudgeMotive } from './allianceBonds';
import { adjustResolve } from './resolve';
import { addExcitement } from './audience';
import { effectiveAllianceMaxSize } from './gamesProfile';
import { profOf, trainProficiency } from './proficiency';

type Arc = NonNullable<Tribute['relationsArc']>;
const arcOf = (t: Tribute): Arc => (t.relationsArc ??= {});
const names = (ts: Tribute[]) => ts.map(t => t.name).join(' and ');

/**
 * R3: the betrayal-intent score for one alliance, run before the ordinary
 * betrayal roll. Returns true when it acted (a strike), so the caller skips
 * the ordinary roll for that group this cycle.
 *
 * The pact's scheduled break was the watchable betrayal and it was rare; the
 * rest arrived without a tell. Here a tribute who wants what an ally is
 * carrying, and does not trust them, is *seen* wanting it one cycle before
 * they act — and if the group breaks up in between, the knife never comes.
 */
export function betrayalIntent(ctx: SimContext, members: Tribute[]): boolean {
    lapseIntents(ctx);
    const alive = getAlive(ctx.state).length;
    if (alive > AUDIT13_RELATIONS.intentFieldSize || members.length < 2) return false;
    const cycle = cycleOf(ctx.state);
    const live = members.filter(m => m.status === 'alive' && !m.downed);

    // A standing intent comes due first.
    for (const m of live) {
        const intent = m.relationsArc?.betrayalIntent;
        if (!intent || intent.cycle >= cycle) continue;
        const victim = live.find(o => o.id === intent.targetId);
        if (!victim) continue; // lapseIntents has it
        // AUDIT-14 T8: the fuse is one to three cycles, by ambition — cut
        // short by opportunity: the two of them alone in the dark.
        const alone = victim.zone === m.zone && ctx.state.phase === 'night'
            && !live.some(o => o.id !== m.id && o.id !== victim.id && o.zone === victim.zone);
        if (!alone && cycle - intent.cycle < (intent.fuse ?? 1)) continue;
        if (!allied(m, victim)) { standDown(ctx, m, victim, 'split'); continue; }
        // E6: a knife needs the two of them in one place. Apart, it waits a
        // cycle; apart for longer, it lapses on screen.
        if (victim.zone !== m.zone) {
            if (cycle - intent.cycle <= AUDIT14_RELATIONS.intentApartGrace) continue;
            standDown(ctx, m, victim, 'apart');
            continue;
        }
        if (oathRefusesBetrayal(ctx, m)) { standDown(ctx, m, victim, 'oath'); continue; }
        // AUDIT-14 T8: a target who saw the tell is not waiting to be knifed.
        if (victim.relationsArc?.watchful?.fromId === m.id) {
            victim.relationsArc.watchful = undefined;
            if (ctx.rng.chance(AUDIT14_RELATIONS.watchfulPreempt)) {
                m.relationsArc!.betrayalIntent = undefined;
                ctx.logEvent(
                    `${victim.name} has been watching ${m.name} watch them for a day. ${victim.name} does not wait for the rest of it.`,
                    [victim.id, m.id],
                    { type: 'preemptive-betrayals', important: true, category: 'betrayal', zone: m.zone },
                );
                resolveBetrayal(ctx, victim, m, members, 'preempt');
                return true;
            }
            if (ctx.rng.chance(AUDIT14_RELATIONS.watchfulSidestep)) {
                standDown(ctx, m, victim, 'watchful');
                adjustRel(m, victim.id, -AUDIT14_RELATIONS.sidestepRegard);
                adjustRel(victim, m.id, -AUDIT14_RELATIONS.sidestepRegard);
                continue;
            }
        }
        m.relationsArc!.betrayalIntent = undefined;
        noteGrudgeMotive(ctx, m, victim);
        ctx.logEvent(
            ctx.rng.pick([
                `Everybody watching saw this coming a day ago. ${m.name} does it anyway, to ${victim.name}.`,
                `${m.name} finishes the count they started yesterday. ${victim.name} was the thing being counted.`,
                `The Capitol has been waiting on this since last night: ${m.name} finally moves on ${victim.name}.`,
            ]),
            [m.id, victim.id],
            { type: 'betrayal-warning-paid', important: true, category: 'betrayal', zone: m.zone },
        );
        // E8: the victim was warned a cycle ahead ("saw it coming").
        resolveBetrayal(ctx, m, victim, members, undefined, true);
        return true;
    }

    // Then, at most one new tell per group per cycle.
    let best: { m: Tribute; o: Tribute; score: number } | undefined;
    live.forEach(m => {
        if (m.relationsArc?.betrayalIntent) return;
        const ambition = Math.max(AUDIT13_RELATIONS.intentAmbitionFloor,
            ARCHETYPES[m.archetype].treachery + traitMod(m, 'treachery'));
        live.forEach(o => {
            // E6: the tell is seen from across a camp, not across the arena.
            if (o.id === m.id || areLovers(m, o) || o.zone !== m.zone) return;
            const distrust = Math.max(0, Math.min(1, (100 - trustOf(m, o)) / 200));
            const kit = Math.min(AUDIT13_RELATIONS.intentKitCap, 0.5 + inventoryValue(o) / AUDIT13_RELATIONS.intentKitNorm);
            const score = ambition * distrust * kit * (AUDIT13_RELATIONS.intentFieldSize / Math.max(2, alive));
            if (score >= AUDIT13_RELATIONS.intentThreshold && (!best || score > best.score)) best = { m, o, score };
        });
    });
    if (!best) return false;
    const { m, o, score } = best as { m: Tribute; o: Tribute; score: number };
    // AUDIT-14 T8: the fuse, by how much they want it.
    const ambition = ARCHETYPES[m.archetype].treachery + traitMod(m, 'treachery');
    const fuse = Math.max(1, AUDIT14_RELATIONS.fuseMax
        - (ambition > AUDIT14_RELATIONS.fuseAmbitionShort ? 1 : 0)
        - (ambition > AUDIT14_RELATIONS.fuseAmbitionShorter ? 1 : 0));
    arcOf(m).betrayalIntent = { targetId: o.id, cycle, fuse };
    void score;
    ctx.logEvent(warningLine(ctx, m, o), [m.id, o.id],
        { type: 'betrayal-warning', important: true, category: 'betrayal', zone: m.zone });
    noticeTell(ctx, m, o, live);
    return false;
}

/**
 * AUDIT-14 T8: the tell is seen by the audience; now the target (or a sharp
 * ally in the zone, who tells them) gets a roll at seeing it too. A watchful
 * target may strike first or be somewhere else when the knife comes.
 */
function noticeTell(ctx: SimContext, m: Tribute, o: Tribute, live: Tribute[]) {
    const K = AUDIT14_RELATIONS;
    const chance = (w: Tribute) => K.noticeBase + w.attributes.intelligence * K.noticePerIntelligence
        + profOf(w, 'vigilance') * K.noticePerVigilance;
    let by: Tribute | undefined;
    if (ctx.rng.chance(chance(o))) by = o;
    else {
        by = live.find(w => w.id !== m.id && w.id !== o.id && w.zone === o.zone
            && w.attributes.intelligence >= K.noticeAllyIntelligence && ctx.rng.chance(chance(w)));
    }
    if (!by) return;
    arcOf(o).watchful = { fromId: m.id, cycle: cycleOf(ctx.state) };
    ctx.logEvent(
        by.id === o.id
            ? `${o.name} catches ${m.name} looking, and looks back. From now on ${o.name} sleeps with their back to a tree.`
            : `${by.name} saw how ${m.name} was looking at ${o.name}, and says so, quietly, to ${o.name}.`,
        by.id === o.id ? [o.id, m.id] : [by.id, o.id, m.id],
        { type: 'betrayal-noticed', category: 'betrayal', zone: o.zone },
    );
}

/**
 * AUDIT-14 RB8/R10 (and E7): the tell, keyed to what is driving it (the kit,
 * the distrust, or simply the field getting small) and to the hour.
 */
function warningLine(ctx: SimContext, m: Tribute, o: Tribute): string {
    const when = ctx.state.phase === 'night' ? 'the evening' : 'the grey hour before the day starts';
    const kit = inventoryValue(o) >= AUDIT13_RELATIONS.intentKitNorm;
    const distrust = trustOf(m, o) < 0;
    const endgame = getAlive(ctx.state).length <= 4;
    const pool = endgame ? [
        `${m.name} counts the cannons out loud, under their breath, and then looks at ${o.name} for a long time. The arithmetic only works one way.`,
        `There are not many left, and ${m.name} spends ${when} working out how many of them are sitting at this fire. ${o.name} is one.`,
    ] : kit ? [
        `${m.name} spends ${when} sharpening everything they own and counting, twice, what ${o.name} is carrying. Nobody says anything. The cameras stay on ${m.name}.`,
        `${m.name} offers to carry ${o.name}'s pack for a while. ${o.name} says no. ${m.name} keeps looking at it anyway.`,
        `Through ${when}, ${m.name}'s eyes keep going back to what ${o.name} has and ${m.name} does not.`,
    ] : distrust ? [
        `${m.name} sleeps facing ${o.name}, and does not really sleep. Whatever was trust between them has turned into a watch.`,
        `${m.name} spends ${when} asking ${o.name} small questions and not believing the answers. The cameras notice before ${o.name} does.`,
    ] : [
        `${m.name} spends ${when} very quiet, and positioned, always, just behind ${o.name}.`,
        `Something has changed in how ${m.name} looks at ${o.name}. Nobody in the camp could say what. The audience can.`,
    ];
    return ctx.rng.pick(pool);
}

/** AUDIT-14 RB8: an intent that lapses says so, so the tell resolves on screen either way. */
function standDown(ctx: SimContext, m: Tribute, o: Tribute, why: 'dead' | 'apart' | 'split' | 'oath' | 'downed' | 'watchful') {
    if (m.relationsArc) m.relationsArc.betrayalIntent = undefined;
    const line = {
        dead: `${m.name} had been counting what ${o.name} carried. Somebody else has settled the question for them.`,
        apart: `${m.name} spent a night deciding about ${o.name}, and by the time it was decided ${o.name} was somewhere else. The moment goes.`,
        split: `Whatever ${m.name} was going to do to ${o.name}, the group coming apart has done first. ${m.name} lets it go.`,
        oath: `${m.name} gets as far as reaching for it, and stops. Whatever they swore, it holds. ${o.name} never knows how close it was.`,
        downed: `${m.name} was going to move on ${o.name}. Flat on the ground, ${m.name} is not going to move on anybody.`,
        watchful: `${m.name} comes for ${o.name} in the night and finds their bedroll empty. ${o.name} is sleeping somewhere else, and both of them know why.`,
    }[why];
    ctx.logEvent(line, [m.id, o.id], { type: 'betrayal-stood-down', category: 'betrayal', zone: m.zone });
}

/**
 * AUDIT-14 RB8 / E8: an intent whose target is dead, whose pair are no longer
 * allied, or whose holder is down, is dropped with a line rather than carried
 * silently into the holder's next group.
 */
export function lapseIntents(ctx: SimContext) {
    ctx.state.tributes.forEach(m => {
        const intent = m.relationsArc?.betrayalIntent;
        if (!intent) return;
        // E8: a dead holder's intent goes with them, silently.
        if (m.status !== 'alive') { m.relationsArc!.betrayalIntent = undefined; return; }
        const o = ctx.state.tributes.find(x => x.id === intent.targetId);
        if (!o) { m.relationsArc!.betrayalIntent = undefined; return; }
        if (o.status !== 'alive') standDown(ctx, m, o, 'dead');
        else if (!allied(m, o)) standDown(ctx, m, o, 'split');
        else if (m.downed) standDown(ctx, m, o, 'downed');
    });
}

/** R1: the two halves of a split, meeting again. */
function reunionOrFeud(ctx: SimContext) {
    const records = ctx.state.alliances ?? {};
    const maxSize = effectiveAllianceMaxSize(ctx.state, ALLIANCES.maxSize);
    Object.values(records).forEach(record => {
        if (!record.splitFrom || record.splitSettled) return;
        const other = records[record.splitFrom];
        if (!other || other.splitSettled || other.id === record.id) return;
        const a = membersOf(ctx.state, record.id);
        const b = membersOf(ctx.state, other.id);
        if (a.length < 2 || b.length < 2) return;
        const meet = a.find(m => b.some(o => o.zone === m.zone));
        if (!meet) return;
        // Not the same afternoon they split: a reunion needs some time apart.
        if (cycleOf(ctx.state) - Math.max(record.formedCycle, other.formedCycle) < AUDIT13_RELATIONS.reunionMinApart) return;
        record.splitSettled = true;
        other.splitSettled = true;
        const cross = [...a.map(m => b.reduce((s, o) => s + getRel(m, o.id), 0) / b.length),
            ...b.map(m => a.reduce((s, o) => s + getRel(m, o.id), 0) / a.length)];
        const regard = cross.reduce((s, x) => s + x, 0) / cross.length;
        if (regard >= AUDIT13_RELATIONS.reunionRegard && a.length + b.length <= maxSize) {
            const merged = [...a, ...b];
            merged.forEach(m => { m.allianceId = record.id; });
            mergeAllianceRecords(ctx, record.id, other.id, merged);
            merged.forEach(m => merged.forEach(o => { if (o.id !== m.id) adjustRel(m, o.id, 5); }));
            ctx.logEvent(
                `${names(a)} walk into ${meet.zone} and find ${names(b)} already there. Whatever split them is not mentioned. `
                + 'By dark they are one camp again, and it is the most anybody has smiled in days.',
                merged.map(m => m.id),
                { type: 'alliance-reunion', important: true, category: 'alliance', zone: meet.zone },
            );
            return;
        }
        {
            a.forEach(m => b.forEach(o => {
                adjustRel(m, o.id, -AUDIT13_RELATIONS.feudRegardCost);
                adjustRel(o, m.id, -AUDIT13_RELATIONS.feudRegardCost);
            }));
            ctx.logEvent(
                `${names(a)} and ${names(b)} used to share a fire. In ${meet.zone} they stand on opposite sides of it `
                + 'and say the things that were not said when they split. Nobody leaves as friends.',
                [...a, ...b].map(m => m.id),
                { type: 'alliance-feud', important: true, category: 'alliance', zone: meet.zone },
            );
        }
    });
}

/** R4: the district partner. */
function partnerArc(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const cycle = cycleOf(ctx.state);
    alive.forEach(t => {
        const arc = arcOf(t);
        const kin = ctx.state.tributes.filter(o => o.id !== t.id && o.district === t.district);
        if (kin.length === 0) return;
        const living = kin.filter(o => o.status === 'alive');

        // The last of the district. Resolve from the only place left to find it.
        // Only for somebody who was bonded to them; for anybody else a
        // district partner's cannon is one more cannon.
        const bonded = kin.some(o => getRel(t, o.id) >= AUDIT13_RELATIONS.lastOfDistrictRegard);
        if (living.length === 0 && bonded && !arc.lastOfDistrict && alive.length > 2) {
            arc.lastOfDistrict = true;
            adjustResolve(t, AUDIT13_RELATIONS.lastOfDistrictResolve);
            // The resolve is everybody's; the beat is for when the field is
            // small enough that the camera is already on them.
            if (alive.length > AUDIT13_RELATIONS.lastOfDistrictBeatField) return;
            ctx.logEvent(
                `${t.name} is the last of District ${t.district} in the arena now. Something in how they carry themselves changes: `
                + 'there is nobody left to go home instead of them.',
                [t.id, ...kin.map(o => o.id)],
                { type: 'last-of-district', important: true, category: 'alliance', zone: t.zone },
            );
            return;
        }

        // After the horn, somebody who cares goes looking — and keeps
        // looking. AUDIT-14 T14: the search replaces any non-urgent objective,
        // re-aims on every fresh sighting or rumour, and ends with a meeting
        // or with the evidence that there is nobody to meet.
        partnerSearch(ctx, t, arc, kin, cycle);
    });

    // The final two, from one district: the oldest standoff there is.
    if (alive.length === 2 && alive[0].district === alive[1].district
        && !arcOf(alive[0]).standoff && !arcOf(alive[1]).standoff) {
        const [a, b] = alive;
        arcOf(a).standoff = true;
        arcOf(b).standoff = true;
        addExcitement(a, 30);
        addExcitement(b, 30);
        ctx.logEvent(
            `${a.name} and ${b.name} came in on the same train. Now they are the last two, and they both know `
            + 'the thing nobody in District ' + a.district + ' will say out loud: they cannot both go home.',
            [a.id, b.id],
            { type: 'partner-standoff', important: true, category: 'alliance', zone: a.zone },
        );
    }
}

/** AUDIT-14 T14: the partner search, run every cycle it stays open. */
function partnerSearch(ctx: SimContext, t: Tribute, arc: Arc, kin: Tribute[], cycle: number) {
    const searching = arc.partnerSearchFor ? kin.find(o => o.id === arc.partnerSearchFor) : undefined;
    // The cannon and the district on the sky: the search is over.
    if (searching && searching.status !== 'alive') {
        arc.partnerSearchFor = undefined;
        if (t.objective?.kind === 'reach' && t.objective.reason === 'ally') t.objective = { kind: 'survive' };
        ctx.logEvent(
            `${t.name} sees District ${t.district} on the sky tonight and stops walking. There is nobody left out there to find.`,
            [t.id, searching.id],
            { type: 'partner-search', category: 'travel', zone: t.zone },
        );
        return;
    }
    const partner = searching ?? kin.find(o => o.status === 'alive' && getRel(t, o.id) >= AUDIT13_RELATIONS.partnerSearchRegard);
    if (!partner || allied(t, partner) || ctx.state.day > AUDIT14_RELATIONS.partnerSearchDays) {
        arc.partnerSearchFor = undefined;
        return;
    }
    // Found them: an offer, face to face.
    if (partner.zone === t.zone) {
        if (!searching) return;
        arc.partnerSearchFor = undefined;
        if (t.objective?.kind === 'reach' && t.objective.reason === 'ally') t.objective = { kind: 'survive' };
        adjustRel(t, partner.id, AUDIT14_RELATIONS.partnerMeetRegard);
        adjustRel(partner, t.id, AUDIT14_RELATIONS.partnerMeetRegard);
        const both = !t.allianceId && !partner.allianceId;
        if (both) {
            const id = `alliance-${t.id}-${partner.id}`;
            t.allianceId = id;
            partner.allianceId = id;
            registerAlliance(ctx, id, [t, partner]);
        }
        ctx.logEvent(
            both
                ? `${t.name} finds ${partner.name} in ${t.zone}, and neither of them says anything for a while. Then they are two, from the same place, and that is a group.`
                : `${t.name} finds ${partner.name} in ${t.zone}. Whatever else each of them has now, they stand together for a moment first.`,
            [t.id, partner.id],
            { type: 'partner-search', important: both, category: 'alliance', zone: t.zone },
        );
        return;
    }
    // Only a non-urgent objective gives way to it.
    const urgent = t.objective && !['survive', 'hold', 'wait', 'scout', 'isolate'].includes(t.objective.kind)
        && !(t.objective.kind === 'reach' && (t.objective.reason === 'ally' || t.objective.reason === 'forage'));
    if (urgent) return;
    const where = rememberedPlaceOf(ctx.state, t, partner.id);
    if (!where || (ctx.state.collapsedZones ?? []).includes(where) || where === t.zone) return;
    const aimed = t.objective?.kind === 'reach' && t.objective.zone === where;
    if (aimed && searching) return;
    const first = !searching;
    arc.partnerSearchFor = partner.id;
    arc.partnerSearched = true;
    t.objective = { kind: 'reach', zone: where, reason: 'ally', expires: cycle + AUDIT13_RELATIONS.partnerSearchCycles };
    ctx.logEvent(
        first
            ? `${t.name} did not see where ${partner.name} went at the gong, only where they were last. That is where ${t.name} goes.`
            : `${t.name} hears ${partner.name} was seen in ${where}, and turns that way.`,
        [t.id, partner.id],
        { type: 'partner-search', category: 'travel', zone: t.zone },
    );
}

/**
 * AUDIT-14 T12: read by `riskTolerance`. An elder whose ward is down beside
 * them stops weighing their own skin.
 */
export function wardDownedRisk(state: SimContext['state'], t: Tribute): number {
    const down = state.tributes.some(o => o.status === 'alive' && o.downed && o.zone === t.zone
        && o.relationsArc?.wardOf === t.id);
    return down ? AUDIT14_RELATIONS.wardDownedRisk : 0;
}

/** R5: the slow burn, between allies of an age who keep sharing a camp. */
function slowBurn(ctx: SimContext, declare: (a: Tribute, b: Tribute) => void) {
    // AUDIT-14 RB1: one love story per Games is the budget the lovers guard
    // holds; the slow burn is the sincere route into it, not a second one.
    if ((ctx.state.romances ?? []).length > 0) return;
    const alive = getAlive(ctx.state);
    for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
            const a = alive[i], b = alive[j];
            if (!allied(a, b) || a.allianceId?.startsWith('lovers-')) continue;
            if (isStarCrossed(a) || isStarCrossed(b)) continue;
            // AUDIT-14 E19: consecutive nights at the same fire. A cycle apart
            // resets it; a day cycle neither adds nor breaks it.
            if (a.zone !== b.zone) {
                if (a.relationsArc?.rapport?.[b.id]) a.relationsArc.rapport[b.id] = 0;
                if (b.relationsArc?.rapport?.[a.id]) b.relationsArc.rapport[a.id] = 0;
                continue;
            }
            if (ctx.state.phase !== 'night') continue;
            if (a.age < AUDIT13_RELATIONS.romanceMinAge || b.age < AUDIT13_RELATIONS.romanceMinAge || Math.abs(a.age - b.age) > AUDIT13_RELATIONS.romanceAgeGap) continue;
            // A rescue or a shared watch: the camp is the watch rota.
            const record = allianceOf(ctx.state, a.allianceId);
            if (!record) continue;
            if (!ctx.rng.chance(Math.min(1, AUDIT13_RELATIONS.romanceRampChance * (hasStoodBy(a, b.id) || hasStoodBy(b, a.id) ? 2 : 1)))) continue;
            const ra = (arcOf(a).rapport ??= {});
            const rb = (arcOf(b).rapport ??= {});
            ra[b.id] = (ra[b.id] ?? 0) + 1;
            rb[a.id] = ra[b.id];
            if (ra[b.id] < AUDIT13_RELATIONS.romanceRampCycles) continue;
            if (Math.min(getRel(a, b.id), getRel(b, a.id)) < AUDIT13_RELATIONS.romanceRegard) continue;
            ctx.logEvent(
                `Nobody saw it start. ${a.name} and ${b.name} have taken the same watch for ${ra[b.id]} nights running, `
                + 'and tonight neither of them bothers to pretend it is about the watch.',
                [a.id, b.id],
                { type: 'romance-slow-burn', important: true, category: 'romance', zone: a.zone },
            );
            declare(a, b);
            a.sponsorTrust = Math.min(100, a.sponsorTrust + AUDIT13_RELATIONS.romanceSponsorBonus);
            b.sponsorTrust = Math.min(100, b.sponsorTrust + AUDIT13_RELATIONS.romanceSponsorBonus);
            return;
        }
    }
}

/** R6: a sworn name nobody has seen for days stops organising the run. */
function coolVengeance(ctx: SimContext) {
    const cycle = cycleOf(ctx.state);
    getAlive(ctx.state).forEach(t => {
        const mem = ensureMemory(t);
        const stale = mem.vengeance.find(id => {
            const target = ctx.state.tributes.find(o => o.id === id);
            if (!target || target.status !== 'alive') return false;
            const seen = mem.rivals[id]?.lastSeenCycle;
            return seen !== undefined && cycle - seen > AUDIT13_RELATIONS.vengeanceCoolCycles;
        });
        if (!stale) return;
        const target = ctx.state.tributes.find(o => o.id === stale)!;
        mem.vengeance = mem.vengeance.filter(id => id !== stale);
        const arc = arcOf(t);
        arc.cooled = [...(arc.cooled ?? []), stale];
        if (t.objective?.kind === 'hunt' && t.objective.targetId === stale) t.objective = { kind: 'survive' };
        ctx.logEvent(
            ctx.rng.pick([
                `${t.name} has not seen ${target.name} in days. The oath is still there, somewhere, but ${t.name} has stopped walking towards it.`,
                `${t.name} used to say ${target.name}'s name every night. Tonight they notice they have not said it in a while.`,
                `Hunger has a way of crowding things out. ${target.name} is still out there; ${t.name} is mostly thinking about water.`,
                `${t.name} does not forgive ${target.name}. They just stop going looking, which from the outside looks the same.`,
            ]),
            [t.id, target.id],
            { type: 'vengeance-cooled', category: 'alliance', zone: t.zone },
        );
    });
}

/** R7: the ward. */
function wards(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    // AUDIT-14 RB5 / E12: the bond is the alliance's. When the pair part, or
    // one of them swears on the other, it ends: the elder stops standing for
    // them, and there is nothing more to learn or inherit.
    alive.forEach(young => {
        const arc = young.relationsArc;
        if (!arc?.wardOf) return;
        const elder = ctx.state.tributes.find(o => o.id === arc.wardOf);
        if (!elder || elder.status !== 'alive') return;
        if (allied(elder, young) && !hasVengeanceAgainst(elder, young.id) && !hasVengeanceAgainst(young, elder.id)) return;
        arc.wardOf = undefined;
        arc.inherited = true; // one ward, one ending
        elder.protectorBonds = (elder.protectorBonds ?? []).filter(id => id !== young.id);
    });
    // Bond forms between allies of the right ages.
    alive.forEach(young => {
        const arc = arcOf(young);
        if (young.age > AUDIT13_RELATIONS.wardYoungAge || arc.wardOf) return;
        // AUDIT-14 T12: the elder who cares most, standing here — not the
        // first one in array order.
        const care = (o: Tribute) => getRel(o, young.id)
            + (ARCHETYPES[o.archetype].objectiveBias?.protect ?? 0) * AUDIT14_RELATIONS.wardProtectWeight;
        const elder = alive.filter(o => o.age >= AUDIT13_RELATIONS.wardElderAge && allied(o, young) && !areLovers(o, young)
            && o.zone === young.zone && !hasVengeanceAgainst(o, young.id) && !hasVengeanceAgainst(young, o.id))
            .sort((x, y) => care(y) - care(x))[0];
        if (!elder) return;
        arc.wardOf = elder.id;
        // The guardian stand rides the protector machinery: a protector
        // crosses a zone for a downed ward and takes a protect objective.
        if (!(elder.protectorBonds ?? []).includes(young.id)) elder.protectorBonds = [...(elder.protectorBonds ?? []), young.id];
        ctx.logEvent(
            ctx.rng.pick([
                `${elder.name} starts making ${young.name} eat first and sleep in the middle. Nobody asked them to. Nobody asks them to stop.`,
                `${elder.name} shows ${young.name} how to hold it properly. Then shows them again. Then stands a little closer than they need to.`,
                `${young.name} is ${young.age}. ${elder.name} decides, without telling anybody, that ${young.name} is going to see ${young.age + 1}.`,
                `${elder.name} takes ${young.name}'s watch as well as their own, and when asked about it says they were not tired.`,
            ]),
            [elder.id, young.id],
            { type: 'ward-bond', category: 'alliance', zone: elder.zone },
        );
    });
    // Teaching, and what is left when the teacher is gone.
    alive.forEach(young => {
        const arc = young.relationsArc;
        if (!arc?.wardOf) return;
        const elder = ctx.state.tributes.find(o => o.id === arc.wardOf);
        if (!elder) return;
        // AUDIT-14 E12: the bond is an alliance bond. It goes when the
        // alliance does, or when either has sworn on the other.
        if (elder.status === 'alive' && (!allied(elder, young)
            || hasVengeanceAgainst(elder, young.id) || hasVengeanceAgainst(young, elder.id))) {
            arc.wardOf = undefined;
            elder.protectorBonds = (elder.protectorBonds ?? []).filter(id => id !== young.id);
            return;
        }
        if (elder.status === 'alive') {
            if (elder.zone !== young.zone) return;
            const skill = (Object.keys(elder.proficiencies ?? {}) as Proficiency[]).sort((x, y) => profOf(elder, y) - profOf(elder, x))[0];
            if (skill && profOf(elder, skill) > profOf(young, skill)) trainProficiency(young, skill, ctx, AUDIT13_RELATIONS.wardTeachShare);
            return;
        }
        if (arc.inherited) return;
        arc.inherited = true;
        // AUDIT-14 E12: nothing is inherited across a killing between them.
        if (elder.lastDamage?.sourceId === young.id || young.lastDamage?.sourceId === elder.id) return;
        const trait = elder.traits.find(tr => (TRAITS as readonly string[]).includes(tr) && !young.traits.includes(tr) && traitFits(young.traits, tr));
        if (!trait) return;
        young.traits.push(trait);
        ctx.logEvent(
            `${young.name} catches themself doing something the way ${elder.name} used to do it. ${trait}, the Capitol commentators call it. `
            + `${young.name} would just call it ${elder.name}.`,
            [young.id, elder.id],
            { type: 'ward-inheritance', important: true, category: 'alliance', zone: young.zone },
        );
    });
}

/**
 * The per-cycle arcs (R1, R4-R7). `declare` is the romance declaration from
 * the alliance phase, passed in rather than imported to keep this module out
 * of the phase's import cycle.
 */
export function tickRelationsArc(ctx: SimContext, declare: (a: Tribute, b: Tribute) => void) {
    lapseIntents(ctx);
    reunionOrFeud(ctx);
    partnerArc(ctx);
    slowBurn(ctx, declare);
    coolVengeance(ctx);
    wards(ctx);
}
