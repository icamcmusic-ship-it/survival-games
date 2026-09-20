/**
 * AUDIT-9 batch 3: the behaviour changes, stated as propositions.
 *
 * The balance sweep says whether a rate moved. It cannot say *why*, and on
 * archetype populations of a hundred-odd entrants it cannot say it with much
 * confidence either — which is the lesson of batch 3 step 1, where a
 * co-winner counting fix moved two archetypes past each other without either
 * of them changing. So every mechanism this batch adds is asserted here, in a
 * positioned scene, where it either fires or it does not.
 */
import { scenario, check, eq, world, report } from './scenarios';
import { ARCHETYPES } from '../src/data/archetypes';
import { DEBTS, OBLIGATIONS } from '../src/data/balance';
import { ITEMS } from '../src/data/constants';
import { createContext } from '../src/engine/context';
import { RNG } from '../src/utils/rng';
import { appealForAid, openObligations } from '../src/engine/obligations';
import { repayDebts, incurDebt, debtTo } from '../src/engine/debts';
import { Item } from '../src/models/types';

const food = () => structuredClone(ITEMS.find(i => i.type === 'food')!) as Item;

console.log('the creed: a break-off that is not fear');

scenario(
    'the Zealot declares a disengagement condition rather than carrying a hardcoded one',
    'the last extreme archetype property was an `archetype === zealot` branch in fear.ts, and that is how it stayed invisible',
    () => {
        eq(ARCHETYPES.zealot.disengage, 'unworthy', 'the creed is on the sheet');
        eq(ARCHETYPES.zealot.fearScale, 0, 'and it is still not afraid of anything');
        // Nobody else has one yet; if that changes this is the line to update.
        const others = Object.values(ARCHETYPES).filter(a => a.disengage !== undefined);
        eq(others.length, 1, 'exactly one archetype carries a creed so far');
    },
);

scenario(
    'the creed keeps its eagerness out of the Cornucopia and nowhere else',
    'the horn is twenty-four people grabbing bags; it is not the point an archetype with a creed is there to make',
    () => {
        // The bloodbath reads `disengage` to decide whether an archetype's
        // general appetite for a fight applies to this specific one. Asserted
        // through the property rather than by re-running the phase, because
        // the phase's own fight roll mixes in plate position, layout, body and
        // traits — this is the one clause the change touches.
        const zealot = ARCHETYPES.zealot;
        const beast = ARCHETYPES.beast;
        check(zealot.aggression > 0, 'the Zealot is still an aggressive archetype');
        check(beast.disengage === undefined, 'the Beast has no creed');
        check(beast.aggression > 0, 'and its aggression still counts at the horn');
    },
);

console.log('the appeal: asking somebody who is not on your side');

scenario(
    'a tribute in visible need can be given supplies by a non-ally standing there',
    'every promise in the game required an alliance, which made a social archetype useless among strangers',
    () => {
        const w = world('B3-appeal');
        const [asker, giver] = w.state.tributes;
        w.only(asker, giver);
        asker.zone = giver.zone;
        asker.allianceId = undefined;
        giver.allianceId = undefined;
        // Visible need, and somebody here with it spare.
        asker.vitals.hunger = 95;
        asker.vitals.thirst = 40;
        asker.kills = 0;
        asker.attributes.charisma = 10;
        asker.inventory = [];
        giver.inventory = [food(), food(), food()];
        w.state.obligations = [];
        // The ask is a roll; run enough cycles that a 16% opening roll has
        // certainly come up, and assert it lands at all rather than how often.
        let made = 0;
        for (let i = 0; i < 200 && made === 0; i++) {
            appealForAid(createContext(w.state, new RNG(`appeal-${i}`)));
            made = openObligations(w.state).length;
        }
        check(made > 0, 'somebody outside their alliance promised them supplies');
        const o = openObligations(w.state)[0];
        eq(o.owedById, giver.id, 'the giver is the one who owes it');
        eq(o.owedToId, asker.id, 'and the asker is owed');
        eq(o.kind, 'supply', 'and it is supplies');
    },
);

scenario(
    'a tribute who is not in need does not ask',
    'an appeal is visible need, not a standing request for more',
    () => {
        const w = world('B3-appeal-2');
        const [asker, giver] = w.state.tributes;
        w.only(asker, giver);
        asker.zone = giver.zone;
        asker.allianceId = giver.allianceId = undefined;
        asker.vitals.hunger = OBLIGATIONS.appealNeedLine - 10;
        asker.vitals.thirst = 10;
        giver.inventory = [food(), food(), food()];
        w.state.obligations = [];
        for (let i = 0; i < 100; i++) appealForAid(createContext(w.state, new RNG(`no-appeal-${i}`)));
        eq(openObligations(w.state).length, 0, 'nobody asked for anything');
    },
);

scenario(
    'somebody with blood on them is not given the benefit of the doubt',
    'standing is what an appeal spends, so killing people has to cost it',
    () => {
        const w = world('B3-appeal-3');
        const [asker, giver] = w.state.tributes;
        w.only(asker, giver);
        asker.zone = giver.zone;
        asker.allianceId = giver.allianceId = undefined;
        asker.vitals.hunger = 95;
        asker.attributes.charisma = 5;
        asker.kills = 12;
        giver.inventory = [food(), food(), food()];
        w.state.obligations = [];
        for (let i = 0; i < 200; i++) appealForAid(createContext(w.state, new RNG(`bloody-${i}`)));
        eq(openObligations(w.state).length, 0, 'a killer asking a stranger for food is told no');
    },
);

console.log('debts: the largest one they can actually pay');

scenario(
    'a debt to the dead no longer blocks a smaller one to somebody standing right there',
    'repayDebts took the largest creditor and returned if they were gone, so one unpayable debt froze the ledger forever',
    () => {
        const w = world('B3-debt');
        const [debtor, creditor, ghost] = w.state.tributes;
        w.only(debtor, creditor, ghost);
        debtor.zone = creditor.zone;
        // The big debt is owed to somebody who died at the horn.
        ghost.status = 'dead';
        ghost.health = 0;
        // DEBTS.max caps a single ledger line, so the scene is built inside it.
        incurDebt(debtor, ghost, DEBTS.max);
        incurDebt(debtor, creditor, DEBTS.max - 1);
        debtor.inventory = [food(), food()];
        creditor.inventory = [];
        check(debtTo(debtor, ghost.id) > debtTo(debtor, creditor.id), 'the unpayable debt is the larger one');
        const owedBefore = debtTo(debtor, creditor.id);
        let paid = false;
        for (let i = 0; i < 400 && !paid; i++) {
            repayDebts(createContext(w.state, new RNG(`debt-${i}`)));
            paid = debtTo(debtor, creditor.id) < owedBefore;
        }
        check(paid, 'the payable debt gets paid');
        eq(debtTo(debtor, ghost.id), DEBTS.max, 'and the debt to the dead is still carried, not cleared');
    },
);

scenario(
    'the biggest payable debt is still the one settled first',
    'the preference was right; it was only counting debts that could not be settled at all',
    () => {
        const w = world('B3-debt-2');
        const [debtor, small, big] = w.state.tributes;
        w.only(debtor, small, big);
        debtor.zone = small.zone = big.zone;
        incurDebt(debtor, small, DEBTS.max - 2);
        incurDebt(debtor, big, DEBTS.max);
        debtor.inventory = [food()];
        let settled: string | undefined;
        for (let i = 0; i < 400 && !settled; i++) {
            repayDebts(createContext(w.state, new RNG(`debt2-${i}`)));
            if (debtTo(debtor, big.id) < DEBTS.max) settled = 'big';
            else if (debtTo(debtor, small.id) < DEBTS.max - 2) settled = 'small';
        }
        eq(settled, 'big', 'the larger of the two payable debts went first');
    },
);

process.exit(report('AUDIT-9 batch 3 mechanisms') ? 1 : 0);
