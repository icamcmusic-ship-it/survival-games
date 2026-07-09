import { SimContext, getAlive } from '../context';
import { EpilogueQA } from '../../models/types';

export function processEpilogue(ctx: SimContext) {
    ctx.state.phase = 'epilogue';
    const alive = getAlive(ctx.state);
    const winner = alive[0];

    const qas: EpilogueQA[] = [];

    if (!winner) {
        qas.push({
            question: "Caesar Flickerman: 'The Arena is silent. There is no victor. What are your final thoughts on this dark chapter?'",
            answer: "Official broadcast: 'A grim end. For the first time, no tribute survived the Arena hazards. Deep mourning is declared across all Districts.'"
        });
    } else {
        qas.push({
            question: `Caesar Flickerman: 'Ladies and gentlemen, the victor of the hunger games... ${winner.name} of District ${winner.district}! What a spectacular run. Tell us, what was going through your mind when you first stepped onto that pedestal?'`,
            answer: `${winner.name}: 'Honestly, Caesar, that first sound of the gong was terrifying. I just knew I had to survive, no matter what it took.'`
        });

        if (winner.traits.includes('Bloodthirsty')) {
            qas.push({
                question: "Caesar Flickerman: 'You showed a remarkably aggressive, almost lethal hunger out there. Some would call it... bloodthirsty. Did you enjoy the hunt?'",
                answer: `${winner.name}: 'It is a game of kill or be killed, Caesar. I embraced the fire. The Capitol wanted a show, and I gave them exactly that.'`
            });
        } else if (winner.traits.includes('Pacifist')) {
            qas.push({
                question: "Caesar Flickerman: 'You played with a quiet, noble, peaceful strategy. Some of the audience was holding their breath, wondering how a pacifist could survive such a brutal arena. How do you feel now?'",
                answer: `${winner.name}: 'I feel a profound sorrow for everyone who did not make it. I only defended myself when I had to. I dream of a day where we do not have to fight.'`
            });
        } else if (winner.traits.includes('Star-Crossed')) {
            qas.push({
                question: `Caesar Flickerman: 'Your story has touched the hearts of the entire Capitol. The tragedy of District ${winner.district} and your star-crossed companion... We wept for you. How will you hold their memory?'`,
                answer: `${winner.name}: 'Every single victory in this arena belongs to both of us. Part of me died with them, and I will spend my life making sure their name is never forgotten.'`
            });
        } else if (winner.traits.includes('Strategist')) {
            qas.push({
                question: "Caesar Flickerman: 'Our analysts noticed your incredibly sharp tactical play. You always seemed one step ahead of the hazards. Was it all calculated?'",
                answer: `${winner.name}: 'The arena is like a chessboard, Caesar. You cannot just react; you have to predict. Knowing when to move and when to hide made all the difference.'`
            });
        } else if (winner.isCareer) {
            qas.push({
                question: "Caesar Flickerman: 'As a career tribute, you have been training for this since you were a child. Did the reality of the arena live up to your expectations?'",
                answer: `${winner.name}: 'Training in District ${winner.district} makes you strong, but nothing can fully prepare you for the real arena. It was an honor, and I am proud to bring glory back to my home.'`
            });
        } else {
            qas.push({
                question: "Caesar Flickerman: 'You entered as a massive underdog, but you outmaneuvered every career and hazard. What kept you going in those lonely nights?'",
                answer: `${winner.name}: 'I kept thinking about my friends and family back in District ${winner.district}. Whenever I was close to giving up, their faces pushed me forward.'`
            });
        }

        if (winner.kills >= 4) {
            qas.push({
                question: `Caesar Flickerman: 'An incredible ${winner.kills} eliminations to your name! A true force of nature in the arena. Which battle was the most intense?'`,
                answer: `${winner.name}: 'Every face-to-face clash was a heartbeat away from death. You do not think in those moments, Caesar; your hands move, and you pray you are the one standing.'`
            });
        } else if (winner.kills === 0) {
            qas.push({
                question: "Caesar Flickerman: 'Fascinatingly, you did not eliminate any competitors yourself. You survived purely through flawless stealth and environmental strategy! A ghost of the arena!'",
                answer: `${winner.name}: 'I did not want to take a life if I did not have to, Caesar. Letting the others and the arena fight each other while I hid in the shadows was my only option.'`
            });
        } else {
            qas.push({
                question: `Caesar Flickerman: 'You made ${winner.kills} critical elimination${winner.kills > 1 ? 's' : ''} during the simulation. What did it feel like to overcome your opponents?'`,
                answer: `${winner.name}: 'It was pure instinct. No regrets, but also no pride. We were all thrust into a nightmare, and I did what was required.'`
            });
        }

        if (winner.sponsorTrust > 75) {
            qas.push({
                question: "Caesar Flickerman: 'The sponsors absolutely showered you with silver parachutes. Their gifts of food and medical supplies saved you multiple times. Would you like to thank them?'",
                answer: `${winner.name}: 'To everyone in the Capitol who sent a gift: you saved my life. Every package felt like a lifeline when I was shivering in the dark. Thank you.'`
            });
        } else {
            qas.push({
                question: "Caesar Flickerman: 'You survived on an incredibly lean budget, with very few sponsor parachutes! That is a true testament to your raw self-reliance!'",
                answer: `${winner.name}: 'I had to learn how to forage, find water, and rely purely on my own two hands. It was tough, but it taught me what I am truly capable of.'`
            });
        }

        qas.push({
            question: "Caesar Flickerman: 'Well, champion, the crown is yours, and the Capitol is celebrating your triumphant return!'",
            answer: `${winner.name}: 'Thank you, Caesar. Let the people of the Capitol hear: I am going home.'`
        });
    }

    ctx.state.epilogueInterview = qas;
}
