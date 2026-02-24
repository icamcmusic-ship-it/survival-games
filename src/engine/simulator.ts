import { GameState, Tribute, EventLog, Phase, Item } from '../models/types';
import { RNG } from '../utils/rng';
import { ITEMS } from '../data/constants';

const COMBAT_TEMPLATES = [
    "{killer} overpowers {victim} and kills them.",
    "{killer} ambushes {victim} from behind.",
    "{killer} wins a brutal duel against {victim}.",
    "{victim} begs for mercy, but {killer} shows none.",
    "{killer} shoots {victim} from a distance."
];

const INTERVIEW_SCENARIOS = [
    {
        strategy: "The Star-Crossed Lover",
        success: "{tribute} tells a heartbreaking story about a loved one back home. The audience is moved to tears.",
        failure: "{tribute} tries to act heartbroken, but it comes off as fake and manipulative.",
        charismaBuff: 1,
        trustMultiplier: 1.5
    },
    {
        strategy: "The Ruthless Warrior",
        success: "{tribute} displays cold confidence and promises a bloodbath. The Careers are impressed.",
        failure: "{tribute} tries to be intimidating but ends up looking like a try-hard.",
        charismaBuff: 0,
        trustMultiplier: 1.2
    },
    {
        strategy: "The Humble Underdog",
        success: "{tribute} speaks with genuine modesty and determination. Sponsors appreciate the sincerity.",
        failure: "{tribute} comes across as too weak and unlikely to survive the first hour.",
        charismaBuff: 1,
        trustMultiplier: 1.3
    },
    {
        strategy: "The Mysterious Enigma",
        success: "{tribute} gives short, cryptic answers that leave the audience wanting more.",
        failure: "{tribute} is so quiet that the interview becomes painfully awkward.",
        charismaBuff: 0,
        trustMultiplier: 1.1
    }
];

export class Simulator {
    private state: GameState;
    private rng: RNG;

    constructor(initialState: GameState) {
        this.state = JSON.parse(JSON.stringify(initialState));
        this.rng = new RNG(`${this.state.seed}-${this.state.phase}-${this.state.day}`);
    }

    public getState(): GameState {
        return this.state;
    }

    private logEvent(text: string, tributesInvolved: string[], important: boolean = false) {
        this.state.log.push({
            id: this.rng.nextInt(0, 1000000).toString(),
            day: this.state.day,
            phase: this.state.phase,
            text,
            tributesInvolved,
            important
        });
    }

    private getAlive(): Tribute[] {
        return this.state.tributes.filter(t => t.status === 'alive');
    }

    public processTraining() {
        this.state.phase = 'training';
        this.rng = new RNG(`${this.state.seed}-training`);
        
        this.getAlive().forEach(t => {
            const attrs = ['strength', 'agility', 'intelligence', 'stealth', 'charisma'] as const;
            const boosted = this.rng.pick([...attrs]);
            t.attributes[boosted] = Math.min(10, t.attributes[boosted] + 1);
            
            const totalStats = Object.values(t.attributes).reduce((a, b) => a + b, 0);
            t.trainingScore = Math.min(12, Math.max(1, Math.floor(totalStats / 4) + this.rng.nextInt(-2, 2)));
            t.excitementRating += t.trainingScore * 5;
            
            this.logEvent(`${t.name} focused on ${boosted} during training and scored a ${t.trainingScore}.`, [t.id]);
        });
    }

    public processInterviews() {
        this.state.phase = 'interviews';
        this.rng = new RNG(`${this.state.seed}-interviews`);

        this.getAlive().forEach(t => {
            const scenario = this.rng.pick(INTERVIEW_SCENARIOS);
            const roll = t.attributes.charisma + this.rng.nextInt(-2, 3);
            const isSuccess = roll >= 5;

            if (isSuccess) {
                t.attributes.charisma = Math.min(10, t.attributes.charisma + scenario.charismaBuff);
                t.sponsorTrust = Math.floor(t.sponsorTrust * scenario.trustMultiplier);
                t.excitementRating += 20;
                this.logEvent(scenario.success.replace('{tribute}', t.name), [t.id], true);
            } else {
                t.sponsorTrust = Math.max(0, t.sponsorTrust - 10);
                this.logEvent(scenario.failure.replace('{tribute}', t.name), [t.id]);
            }
        });
    }

    public startGames() {
        this.state.phase = 'bloodbath';
        this.state.day = 1;
    }

    public processBloodbath() {
        this.state.phase = 'bloodbath';
        this.rng = new RNG(`${this.state.seed}-bloodbath`);
        const alive = this.getAlive();
        
        const shuffled = [...alive].sort(() => this.rng.nextFloat() - 0.5);
        
        const runners: Tribute[] = [];
        const fighters: Tribute[] = [];

        shuffled.forEach(t => {
            let fightChance = 0.3;
            if (t.isCareer) fightChance += 0.4;
            if (t.attributes.strength > 7) fightChance += 0.2;
            if (t.traits.includes('Bloodthirsty')) fightChance += 0.3;
            if (t.traits.includes('Pacifist')) fightChance -= 0.3;

            if (this.rng.chance(fightChance)) {
                fighters.push(t);
            } else {
                runners.push(t);
            }
        });

        runners.forEach(t => {
            if (this.rng.chance(0.8)) {
                this.logEvent(`${t.name} runs away from the Cornucopia.`, [t.id]);
            } else {
                const item = this.rng.pick(ITEMS);
                t.inventory.push(item);
                this.logEvent(`${t.name} grabs a ${item.name} and runs away.`, [t.id]);
            }
        });

        while (fighters.length > 1) {
            const t1 = fighters.splice(this.rng.nextInt(0, fighters.length - 1), 1)[0];
            const t2 = fighters.splice(this.rng.nextInt(0, fighters.length - 1), 1)[0];

            this.resolveCombat(t1, t2, true);
        }

        if (fighters.length === 1) {
            const winner = fighters[0];
            const item1 = this.rng.pick(ITEMS);
            const item2 = this.rng.pick(ITEMS);
            winner.inventory.push(item1, item2);
            this.logEvent(`${winner.name} survives the bloodbath and claims ${item1.name} and ${item2.name}.`, [winner.id]);
        }

        this.state.phase = 'day';
    }

    private resolveCombat(t1: Tribute, t2: Tribute, isBloodbath: boolean = false) {
        if (t1.status === 'dead' || t2.status === 'dead') return;

        const t1Power = t1.attributes.strength + t1.attributes.agility + (t1.inventory.some(i => i.type === 'weapon') ? 5 : 0) + this.rng.nextInt(0, 5);
        const t2Power = t2.attributes.strength + t2.attributes.agility + (t2.inventory.some(i => i.type === 'weapon') ? 5 : 0) + this.rng.nextInt(0, 5);

        if (t1Power > t2Power + 3) {
            this.killTribute(t2, t1, isBloodbath);
        } else if (t2Power > t1Power + 3) {
            this.killTribute(t1, t2, isBloodbath);
        } else {
            t1.health -= 20;
            t2.health -= 20;
            t1.injuries.bleeding = true;
            t2.injuries.bleeding = true;
            this.logEvent(`${t1.name} and ${t2.name} fight but both escape injured.`, [t1.id, t2.id]);
            this.checkDeath(t1);
            this.checkDeath(t2);
        }
    }

    private killTribute(victim: Tribute, killer?: Tribute, isBloodbath: boolean = false) {
        victim.status = 'dead';
        victim.health = 0;
        victim.dayOfDeath = this.state.day;
        
        if (killer) {
            killer.kills += 1;
            killer.excitementRating += 20;
            victim.causeOfDeath = `Killed by ${killer.name}`;
            
            const template = this.rng.pick(COMBAT_TEMPLATES);
            const text = template.replace('{killer}', killer.name).replace('{victim}', victim.name);

            if (victim.inventory.length > 0) {
                const loot = victim.inventory[0];
                killer.inventory.push(loot);
                this.logEvent(`${text} ${killer.name} loots a ${loot.name}.`, [killer.id, victim.id], true);
            } else {
                this.logEvent(text, [killer.id, victim.id], true);
            }
        } else {
            victim.causeOfDeath = 'Died to environment';
            this.logEvent(`${victim.name} dies.`, [victim.id], true);
        }
    }

    private checkDeath(t: Tribute) {
        if (t.health <= 0 && t.status === 'alive') {
            this.killTribute(t);
        }
    }

    public processTurn() {
        if (this.state.phase === 'day') {
            this.processDayNight('day');
            this.state.phase = 'night';
        } else if (this.state.phase === 'night') {
            this.processDayNight('night');
            this.state.day += 1;
            this.state.phase = 'day';
        } else if (this.state.phase === 'feast') {
            this.processFeast();
            this.state.phase = 'day';
        }

        if (this.getAlive().length <= 1) {
            this.state.phase = 'ended';
            const winner = this.getAlive()[0];
            if (winner) {
                this.logEvent(`The Hunger Games are over! ${winner.name} is the victor!`, [winner.id], true);
            } else {
                this.logEvent(`The Hunger Games are over! There are no survivors.`, [], true);
            }
        }
    }

    private processFeast() {
        this.rng = new RNG(`${this.state.seed}-${this.state.day}-feast`);
        const alive = this.getAlive();
        const attendees: Tribute[] = [];

        alive.forEach(t => {
            if (this.rng.chance(0.6) || t.vitals.hunger > 70 || t.vitals.thirst > 70) {
                attendees.push(t);
            } else {
                this.logEvent(`${t.name} decides not to go to the feast.`, [t.id]);
            }
        });

        if (attendees.length === 0) {
            this.logEvent(`No one attends the feast.`, []);
            return;
        }

        const shuffled = [...attendees].sort(() => this.rng.nextFloat() - 0.5);
        
        while (shuffled.length > 1) {
            const t1 = shuffled.splice(this.rng.nextInt(0, shuffled.length - 1), 1)[0];
            const t2 = shuffled.splice(this.rng.nextInt(0, shuffled.length - 1), 1)[0];
            this.resolveCombat(t1, t2);
        }

        if (shuffled.length === 1) {
            const winner = shuffled[0];
            const item1 = this.rng.pick(ITEMS);
            const item2 = this.rng.pick(ITEMS);
            winner.inventory.push(item1, item2);
            winner.health = Math.min(100, winner.health + 50);
            winner.vitals.hunger = 0;
            winner.vitals.thirst = 0;
            this.logEvent(`${winner.name} survives the feast and claims ${item1.name} and ${item2.name}, fully restoring their vitals.`, [winner.id], true);
        }
    }

    private processDayNight(time: 'day' | 'night') {
        this.rng = new RNG(`${this.state.seed}-${this.state.day}-${time}`);
        const alive = this.getAlive();
        
        alive.forEach(t => {
            t.vitals.hunger += 10;
            t.vitals.thirst += 15;
            t.vitals.fatigue += time === 'day' ? 10 : -20;
            
            if (t.vitals.hunger > 80) t.health -= 5;
            if (t.vitals.thirst > 80) t.health -= 10;
            if (t.injuries.bleeding) t.health -= 15;
            if (t.injuries.infected) t.health -= 10;

            if (t.vitals.hunger > 50) {
                const foodIdx = t.inventory.findIndex(i => i.type === 'food');
                if (foodIdx >= 0) {
                    t.inventory.splice(foodIdx, 1);
                    t.vitals.hunger = Math.max(0, t.vitals.hunger - 40);
                    this.logEvent(`${t.name} eats some food.`, [t.id]);
                }
            }
            if (t.vitals.thirst > 50) {
                const waterIdx = t.inventory.findIndex(i => i.type === 'water');
                if (waterIdx >= 0) {
                    t.inventory.splice(waterIdx, 1);
                    t.vitals.thirst = Math.max(0, t.vitals.thirst - 50);
                    this.logEvent(`${t.name} drinks some water.`, [t.id]);
                }
            }

            this.checkDeath(t);
        });

        const currentAlive = this.getAlive();
        const shuffled = [...currentAlive].sort(() => this.rng.nextFloat() - 0.5);
        
        const acted = new Set<string>();

        shuffled.forEach(t => {
            if (acted.has(t.id) || t.status === 'dead') return;

            if (this.rng.chance(0.1)) {
                const event = this.rng.pick(this.state.arena.events);
                if (this.rng.chance(0.5)) {
                    t.health -= 30;
                    this.logEvent(`${t.name} is caught in a ${event} and is severely injured!`, [t.id], true);
                } else {
                    this.logEvent(`${t.name} barely escapes a ${event}.`, [t.id]);
                }
                this.checkDeath(t);
                acted.add(t.id);
                return;
            }

            if (this.rng.chance(0.1)) {
                const mutt = this.rng.pick(this.state.arena.mutts);
                if (t.attributes.agility > 6 && this.rng.chance(0.7)) {
                    this.logEvent(`${t.name} outruns a pack of ${mutt}.`, [t.id]);
                } else {
                    t.health -= 40;
                    t.injuries.bleeding = true;
                    this.logEvent(`${t.name} is attacked by ${mutt} and barely survives.`, [t.id], true);
                }
                this.checkDeath(t);
                acted.add(t.id);
                return;
            }

            const others = shuffled.filter(o => o.id !== t.id && !acted.has(o.id) && o.status === 'alive');
            if (others.length > 0 && this.rng.chance(0.3)) {
                const other = others[0];
                
                if (t.stance === 'Aggressive' || other.stance === 'Aggressive' || t.isCareer) {
                    this.resolveCombat(t, other);
                } else {
                    if (this.rng.chance(0.5)) {
                        this.logEvent(`${t.name} and ${other.name} spot each other but decide not to fight.`, [t.id, other.id]);
                    } else {
                        this.logEvent(`${t.name} and ${other.name} share a moment of peace.`, [t.id, other.id]);
                        t.vitals.sanity = Math.min(100, t.vitals.sanity + 10);
                        other.vitals.sanity = Math.min(100, other.vitals.sanity + 10);
                    }
                }
                acted.add(t.id);
                acted.add(other.id);
                return;
            }

            if (t.stance === 'Evasive') {
                this.logEvent(`${t.name} hides quietly.`, [t.id]);
            } else if (t.stance === 'Defensive') {
                if (this.rng.chance(0.4)) {
                    const item = this.rng.pick(ITEMS.filter(i => i.type === 'food' || i.type === 'water'));
                    t.inventory.push(item);
                    this.logEvent(`${t.name} forages and finds a ${item.name}.`, [t.id]);
                } else {
                    this.logEvent(`${t.name} sets up camp and rests.`, [t.id]);
                }
            } else {
                this.logEvent(`${t.name} hunts for other tributes but finds no one.`, [t.id]);
            }
            acted.add(t.id);
        });
    }

    public triggerGamemakerEvent(type: 'mutt' | 'weather' | 'feast', targetId?: string) {
        if (!this.state.gamemakerMode) return;
        
        if (type === 'mutt') {
            const mutt = this.rng.pick(this.state.arena.mutts);
            if (targetId) {
                const t = this.state.tributes.find(tr => tr.id === targetId);
                if (t && t.status === 'alive') {
                    t.health -= 50;
                    t.injuries.bleeding = true;
                    this.logEvent(`GAMEMAKER: A pack of ${mutt} is unleashed directly on ${t.name}!`, [t.id], true);
                    this.checkDeath(t);
                }
            } else {
                this.logEvent(`GAMEMAKER: ${mutt} are released into the arena!`, [], true);
                this.getAlive().forEach(t => {
                    if (this.rng.chance(0.3)) {
                        t.health -= 20;
                        this.checkDeath(t);
                    }
                });
            }
        } else if (type === 'weather') {
            const event = this.rng.pick(this.state.arena.events);
            this.logEvent(`GAMEMAKER: The weather shifts drastically. ${event} begins!`, [], true);
            this.getAlive().forEach(t => {
                t.vitals.fatigue += 20;
                t.vitals.sanity -= 10;
            });
        } else if (type === 'feast') {
            this.logEvent(`GAMEMAKER: A feast is announced at the Cornucopia!`, [], true);
            this.state.phase = 'feast';
        }
    }
}
