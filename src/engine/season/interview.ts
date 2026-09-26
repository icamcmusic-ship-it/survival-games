import { EpilogueQA, Tribute } from '../../models/types';
import { AUDIT12_WAVE3 } from '../../data/balance';
import { SimContext } from '../context';
import { significantWounds } from '../woundLedger';
import { campaignOf } from '../campaign';
import { killLedgerOf } from './killLedger';

/**
 * AUDIT-12 wave 3 §11: the questions a victor's record now earns.
 *
 *  - **The scar.** The worst wound in the victor's ledger (`significantWounds`)
 *    is asked about by name, with the day it happened.
 *  - **The kill ledger.** A victor who killed is asked about the list.
 *  - **The nemesis.** A victor reaped again who is a campaign nemesis is asked
 *    about the districts that have not forgiven them.
 *
 * Pure over the finished state; no draws.
 */
export function ledgerQuestions(ctx: SimContext, winner: Tribute): EpilogueQA[] {
    const out: EpilogueQA[] = [];
    const scar = significantWounds(winner, AUDIT12_WAVE3.interview.scarMin)
        .sort((a, b) => b.amount - a.amount)[0];
    if (scar) {
        const cause = scar.cause.charAt(0).toLowerCase() + scar.cause.slice(1);
        out.push({
            question: `Caesar Flickerman: 'The scar. Our cameras have it as ${cause}. Will you show the audience?'`,
            answer: `${winner.name}: 'It still pulls when the weather turns, Caesar. I don't mind. It means I'm still here to feel it.'`,
        });
    }
    const kills = killLedgerOf(ctx.state, winner.id);
    if (kills.length >= 2) {
        out.push({
            question: `Caesar Flickerman: '${kills.map(k => k.victim).join(', ')}. ${kills.length} names. Do you say them, at night?'`,
            answer: `${winner.name}: 'Every one of them, Caesar. In order.'`,
        });
    }
    const nemesis = campaignOf(ctx.state.campaign).ledger?.nemeses?.find(n => n.name === winner.name && winner.veteranOf);
    if (nemesis) {
        out.push({
            question: `Caesar Flickerman: 'Twice now. District${nemesis.victimDistricts.length === 1 ? '' : 's'} ${nemesis.victimDistricts.join(', ')} will be watching this with the sound off. What would you say to them?'`,
            answer: `${winner.name}: 'Nothing they would want to hear from me.'`,
        });
    }
    return out;
}
