import { GameState, Tribute } from '../models/types';
import { SimContext } from './context';
import { damageProject } from './actionBudget';
import { cycleOf } from './memory';
import { PROJECTS } from '../data/balance';
import { getAlive } from './context';
import { trainProficiency } from './proficiency';

/**
 * AUDIT-10 B5-03: an abandoned project.
 *
 * One of the twelve nonlethal events the audit names, and the one the project
 * ledger was always going to make possible: *"Build nonlethal events at least
 * as deliberately [as the lethal ones]: ... an abandoned project ..."*.
 *
 * The chain has the four parts §7's table asks every row to have.
 *
 *   **Warning.** The site is on the map and the frame is visible. A tribute
 *   standing there is told the work is going to waste before it does — see the
 *   weathering line below, which fires while there is still something to save.
 *   **Choice.** Come back to it, take it apart for what it is made of, or leave
 *   it. Each is available to anybody standing there, not only to whoever
 *   started it.
 *   **Nonfatal result.** Nobody dies. Hours are lost, or converted, or
 *   recovered.
 *   **Durable record.** `workerIds` survives on the project and the salvage is
 *   attributed, so "somebody took my shelter apart" is a fact with a name on
 *   it rather than a feeling.
 *
 * It is deliberately not a hazard roll. The audit's closing instruction on this
 * section is *"do not simply add lethality to the existing scheduler"*, and the
 * failure mode it is guarding against is a chain that is really a die roll with
 * prose on it. Nothing here is rolled: the weather takes a project back because
 * nobody has touched it for long enough, which is a fact about how the run has
 * gone rather than a number drawn at the moment of narration.
 */
export function tickAbandonedWork(ctx: SimContext) {
    const projects = ctx.state.projects;
    if (!projects) return;
    const now = cycleOf(ctx.state);

    Object.entries(projects).forEach(([, project]) => {
        const idle = now - project.lastCycle;
        if (idle < PROJECTS.abandonedAfterCycles) return;

        // Anybody standing at the site, whether or not they started it. The
        // whole point of the ledger is that this is a question the world can
        // answer.
        const here = getAlive(ctx.state).filter(t =>
            t.zone === project.zone && (t.zoneLevel ?? 'upper') === (project.level ?? 'upper'));

        const owners = project.workerIds;
        const stranger = here.find(t => !owners.includes(t.id));
        const owner = here.find(t => owners.includes(t.id));

        /*
         * Somebody else's abandoned work is materials.
         *
         * Taking it apart is not stealing exactly — the frame has been standing
         * untouched for days and its builder may be dead — which is why it is a
         * nonfatal event with a record rather than a betrayal.
         *
         * The benefit is the one the act actually confers, which is not a head
         * start on the same job: somebody who wanted to *build* here would
         * simply continue the project, which the ledger already lets them do.
         * A salvager is taking it apart, so what they get is the lengths and
         * what taking it apart teaches them. A first draft narrated them
         * carrying materials away and granted nothing at all, which is a log
         * line describing a mechanic that does not exist.
         */
        if (stranger && !owner) {
            const taken = damageProject(ctx.state, project.zone, project.level, PROJECTS.salvagedHours);
            if (taken <= 0) return;
            // Pulling somebody else's joinery apart is the best carpentry
            // lesson in the arena: you find out how they did it.
            trainProficiency(stranger, 'carpentry', ctx, PROJECTS.salvageCarpentryShare);
            const builders = owners
                .map(id => ctx.state.tributes.find(o => o.id === id))
                .filter((b): b is Tribute => b !== undefined);
            const allGone = builders.length > 0 && builders.every(b => b.status === 'dead');
            ctx.logEvent(
                `${stranger.name} takes apart what is left of the frame in ${project.zone} and carries the usable `
                + `lengths away. ${allGone
                    ? 'Nobody is going to object.'
                    : `${builders.map(b => b.name).join(' and ')} put those hours in, and will find out eventually.`}`,
                [stranger.id, ...owners],
                { category: 'survival', zone: project.zone },
            );
            return;
        }

        /*
         * Nobody there at all: the arena takes it back.
         *
         * Narrated only while there is still something to lose, because "the
         * frame you abandoned has rotted slightly further" every cycle for a
         * week is the repetitive low-information noise this section exists to
         * replace.
         */
        if (here.length === 0) {
            const before = project.hoursDone;
            const lost = damageProject(ctx.state, project.zone, project.level, PROJECTS.weatherHoursPerCycle);
            if (lost > 0 && before >= PROJECTS.weatherNoticeHours) {
                ctx.logEvent(
                    `The half-built frame in ${project.zone} has nobody left tending it. The weather is taking it `
                    + `back a piece at a time, and there is still enough of it standing to be worth somebody's afternoon.`,
                    [...owners],
                    { category: 'survival', zone: project.zone },
                );
            }
        }
    });
}

/** Whether a site has work somebody walked away from. For the interface. */
export function abandonedAt(state: GameState, zone: string): boolean {
    const now = state.cycle ?? 0;
    return Object.values(state.projects ?? {})
        .some(p => p.zone === zone && now - p.lastCycle >= PROJECTS.abandonedAfterCycles);
}
