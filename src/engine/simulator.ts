import { GameState, Tribute, EventLog, Phase, Item, EpilogueQA } from '../models/types';
import { RNG } from '../utils/rng';
import { ITEMS } from '../data/constants';
import { WEAPON_KILL_TEMPLATES, INTERVIEW_SCENARIOS, SURVIVAL_TEXTS, ENCOUNTER_TEXTS, SYSTEM_TEXTS, SANITY_TEXTS } from '../data/flavorText';

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

    private logEvent(text: string, tributesInvolved: string[], important: boolean = false, zone?: string) {
        let resolvedZone = zone;
        if (!resolvedZone && tributesInvolved.length > 0) {
            const firstTribute = this.state.tributes.find(t => t.id === tributesInvolved[0]);
            if (firstTribute) {
                resolvedZone = firstTribute.zone;
            }
        }
        this.state.log.push({
            id: this.rng.nextInt(0, 1000000).toString(),
            day: this.state.day,
            phase: this.state.phase,
            text,
            tributesInvolved,
            important,
            zone: resolvedZone
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
        this.initializeCareerAlliance();
    }

    private initializeCareerAlliance() {
        const careers = this.getAlive().filter(t => t.isCareer);
        if (careers.length > 1) {
            const allianceId = `career-pack-${this.state.seed}`;
            careers.forEach(t => {
                t.allianceId = allianceId;
                // Set initial positive relationships within the pack
                careers.forEach(other => {
                    if (t.id !== other.id) {
                        t.relationships[other.id] = 50;
                    }
                });
            });
            this.logEvent("The Careers from Districts 1, 2, and 4 have formed a lethal pack.", careers.map(c => c.id), true);
        }
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

            if (t1 && t2) {
                this.resolveCombat(t1, t2, true);
                if (t1.status === 'alive') fighters.push(t1);
                if (t2.status === 'alive') fighters.push(t2);
            } else {
                if (t1 && t1.status === 'alive') fighters.push(t1);
                if (t2 && t2.status === 'alive') fighters.push(t2);
            }
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

        // Star-crossed lovers refuse to fight each other!
        if (t1.traits.includes('Star-Crossed') && t2.traits.includes('Star-Crossed') && t1.district === t2.district) {
            this.logEvent(`${t1.name} and ${t2.name} refuse to fight each other due to their deep bond as star-crossed lovers.`, [t1.id, t2.id]);
            return;
        }

        const t1Weapon = t1.inventory.find(i => i.type === 'weapon');
        const t2Weapon = t2.inventory.find(i => i.type === 'weapon');

        let t1Power = t1.attributes.strength + t1.attributes.agility + (t1Weapon ? t1Weapon.value / 10 : 0) + this.rng.nextInt(0, 5);
        let t2Power = t2.attributes.strength + t2.attributes.agility + (t2Weapon ? t2Weapon.value / 10 : 0) + this.rng.nextInt(0, 5);

        // Injury penalties
        if (t1.injuries.arms) t1Power -= 2;
        if (t1.injuries.legs) t1Power -= 2;
        if (t2.injuries.arms) t2Power -= 2;
        if (t2.injuries.legs) t2Power -= 2;

        if (t1Power > t2Power + 3) {
            this.killTribute(t2, t1, isBloodbath, t1Weapon);
        } else if (t2Power > t1Power + 3) {
            this.killTribute(t1, t2, isBloodbath, t2Weapon);
        } else {
            t1.health -= 20;
            t2.health -= 20;
            t1.injuries.bleeding = true;
            t2.injuries.bleeding = true;
            
            // Random localized injury
            if (this.rng.chance(0.3)) t1.injuries.arms = true;
            if (this.rng.chance(0.3)) t2.injuries.legs = true;

            this.logEvent(`${t1.name} and ${t2.name} fight but both escape injured.`, [t1.id, t2.id]);
            
            // Weapon durability loss
            if (t1Weapon && t1Weapon.durability) t1Weapon.durability -= 10;
            if (t2Weapon && t2Weapon.durability) t2Weapon.durability -= 10;

            // Grudge formed
            t1.relationships[t2.id] = (t1.relationships[t2.id] || 0) - 20;
            t2.relationships[t1.id] = (t2.relationships[t1.id] || 0) - 20;

            this.checkDeath(t1);
            this.checkDeath(t2);
        }

        // Clean up broken weapons
        [t1, t2].forEach(t => {
            t.inventory = t.inventory.filter(i => i.type !== 'weapon' || (i.durability === undefined || i.durability > 0));
        });
    }

    private killTribute(victim: Tribute, killer?: Tribute, isBloodbath: boolean = false, weapon?: Item) {
        victim.status = 'dead';
        victim.health = 0;
        victim.dayOfDeath = this.state.day;
        
        // Star-crossed lover heartbreak logic
        if (victim.traits.includes('Star-Crossed')) {
            const partner = this.state.tributes.find(t => t.district === victim.district && t.id !== victim.id && t.status === 'alive');
            if (partner && partner.traits.includes('Star-Crossed')) {
                partner.vitals.sanity = Math.max(0, partner.vitals.sanity - 60);
                partner.excitementRating += 55;
                this.logEvent(`TRAGEDY: ${partner.name} screams in agony as their star-crossed lover ${victim.name} is eliminated, suffering a devastating blow to their sanity.`, [partner.id, victim.id], true);
            }
        }
        
        if (killer) {
            killer.kills += 1;
            killer.excitementRating += 20;
            victim.causeOfDeath = `Killed by ${killer.name}`;

            // Trauma Triggers
            if (killer.traits.includes('Pacifist')) {
                killer.vitals.sanity -= 40;
                this.logEvent(`${killer.name} is deeply traumatized by the act of killing.`, [killer.id]);
            } else if (!killer.isCareer) {
                killer.vitals.sanity -= 10;
            }
            
            const weaponType = weapon ? weapon.id : 'unarmed';
            const templates = WEAPON_KILL_TEMPLATES[weaponType] || WEAPON_KILL_TEMPLATES['unarmed'];
            const template = this.rng.pick(templates);
            const text = template.replace('{killer}', killer.name).replace('{victim}', victim.name);

            if (weapon && weapon.durability) weapon.durability -= 10;

            if (victim.inventory.length > 0) {
                const lootNames = victim.inventory.map(i => i.name).join(', ');
                killer.inventory.push(...victim.inventory);
                victim.inventory = [];
                this.logEvent(`${text} ${killer.name} loots: ${lootNames}.`, [killer.id, victim.id], true);
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
        this.processAlliances();

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
            this.state.phase = 'epilogue';
            this.processEpilogue();
        }
    }

    private processAlliances() {
        const alive = this.getAlive();
        const alliances = new Map<string, Tribute[]>();

        alive.forEach(t => {
            if (t.allianceId) {
                if (!alliances.has(t.allianceId)) alliances.set(t.allianceId, []);
                alliances.get(t.allianceId)!.push(t);
            }
        });

        // 1. Dissolve small alliances
        alliances.forEach((members, id) => {
            if (members.length < 2) {
                members.forEach(m => delete m.allianceId);
                alliances.delete(id);
            }
        });

        // 2. Betrayal Logic
        alliances.forEach((members, id) => {
            // Betrayal chance increases as fewer tributes remain
            const betrayalThreshold = alive.length <= 4 ? 0.3 : 0.05;
            
            if (this.rng.chance(betrayalThreshold)) {
                const betrayer = this.rng.pick(members);
                const victim = this.rng.pick(members.filter(m => m.id !== betrayer.id));
                
                if (victim) {
                    // Star-crossed lovers never betray each other
                    if (betrayer.traits.includes('Star-Crossed') && victim.traits.includes('Star-Crossed') && betrayer.district === victim.district) {
                        return;
                    }
                    this.logEvent(`${betrayer.name} betrays the alliance and attacks ${victim.name}!`, [betrayer.id, victim.id], true);
                    delete betrayer.allianceId; // Betrayer leaves
                    this.resolveCombat(betrayer, victim);
                }
            }
        });

        // 3. Dynamic Alliance Formation & Star-Crossed Lovers
        if (alive.length > 4) {
            for (let i = 0; i < alive.length; i++) {
                for (let j = i + 1; j < alive.length; j++) {
                    const t1 = alive[i];
                    const t2 = alive[j];
                    
                    if (!t1.allianceId && !t2.allianceId) {
                        const rel = t1.relationships[t2.id] || 0;
                        if (rel > 40 && this.rng.chance(0.2)) {
                            const newId = `alliance-${t1.id}-${t2.id}`;
                            t1.allianceId = newId;
                            t2.allianceId = newId;
                            this.logEvent(`${t1.name} and ${t2.name} form a formal alliance.`, [t1.id, t2.id], true);
                        }
                    }
                }
            }
        }

        // 4. Romantic "Star-Crossed Lovers" formation check (District partners of opposite gender)
        for (let dist = 1; dist <= 12; dist++) {
            const districtTributes = alive.filter(t => t.district === dist);
            if (districtTributes.length === 2 && districtTributes[0].gender !== districtTributes[1].gender) {
                const t1 = districtTributes[0];
                const t2 = districtTributes[1];
                let currentRel = t1.relationships[t2.id] || 0;

                // Romance grows if they reside in the same zone or support each other
                if (t1.zone === t2.zone) {
                    currentRel = Math.min(100, currentRel + this.rng.nextInt(4, 10));
                    t1.relationships[t2.id] = currentRel;
                    t2.relationships[t1.id] = currentRel;
                }

                if (currentRel >= 80 && !t1.traits.includes('Star-Crossed')) {
                    t1.traits.push('Star-Crossed');
                    t2.traits.push('Star-Crossed');

                    const bondId = `lovers-${dist}-${this.state.seed}`;
                    t1.allianceId = bondId;
                    t2.allianceId = bondId;

                    t1.sponsorTrust = Math.min(100, t1.sponsorTrust + 40);
                    t2.sponsorTrust = Math.min(100, t2.sponsorTrust + 40);
                    t1.excitementRating += 50;
                    t2.excitementRating += 50;

                    this.logEvent(`ROMANCE: ${t1.name} and ${t2.name} of District ${dist} have formed an unshakeable bond as Star-Crossed Lovers! The Capitol audience is completely captivated.`, [t1.id, t2.id], true);
                }
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
            
            if (t1 && t2) {
                this.resolveCombat(t1, t2);
                if (t1.status === 'alive') shuffled.push(t1);
                if (t2.status === 'alive') shuffled.push(t2);
            } else {
                if (t1 && t1.status === 'alive') shuffled.push(t1);
                if (t2 && t2.status === 'alive') shuffled.push(t2);
            }
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
        
        // 0. Hazard Escalation & Safe Zone Shrinking over time (starts Day 5+)
        const isEscalated = this.state.day >= 5;
        if (isEscalated) {
            const collapseCount = Math.min(this.state.arena.zones.length - 1, this.state.day - 4);
            const collapsedList = this.state.arena.zones.slice(this.state.arena.zones.length - collapseCount);
            this.state.collapsedZones = collapsedList;

            alive.forEach(t => {
                if (collapsedList.includes(t.zone)) {
                    const damage = 20 + (this.state.day - 5) * 10;
                    t.health -= damage;
                    const safeZones = this.state.arena.zones.filter(z => !collapsedList.includes(z));
                    const newSafeZone = safeZones[0] || 'The Cornucopia';
                    
                    this.logEvent(`HAZARD ESCALATION: ${t.name} is trapped inside the collapsing border of ${t.zone}! They sustain ${damage} injury damage and desperately flee into the safe sector of ${newSafeZone}.`, [t.id], true, newSafeZone);
                    t.zone = newSafeZone;
                    this.checkDeath(t);
                }
            });
        }

        // 1. Item Degradation & Spoilage
        alive.forEach(t => {
            t.inventory = t.inventory.filter(item => {
                if (item.type === 'food' && item.spoilage !== undefined) {
                    item.spoilage -= 1;
                    if (item.spoilage <= 0) {
                        this.logEvent(`${t.name}'s ${item.name} has spoiled.`, [t.id]);
                        return false;
                    }
                }
                return true;
            });
        });

        // 2. Vitals & Arena Environmental Effects
        alive.forEach(t => {
            let hungerDrain = 10;
            let thirstDrain = 15;
            let fatigueDrain = time === 'day' ? 10 : -20;

            if (this.state.arena.id === 'frozen') {
                const hasWarmth = t.inventory.some(i => i.id === 'matches');
                if (!hasWarmth) {
                    fatigueDrain += 10;
                    t.health -= 5;
                }
            } else if (this.state.arena.id === 'solar') {
                thirstDrain *= 2;
            } else if (this.state.arena.id === 'toxic') {
                if (this.rng.chance(0.2)) t.vitals.sanity -= 15;
            }

            // Trait Effects
            if (t.traits.includes('Hydrophilic')) thirstDrain -= 5;
            if (t.traits.includes('Insomniac') && time === 'night') fatigueDrain += 10;
            if (t.traits.includes('Iron Stomach')) hungerDrain -= 5;
            if (t.traits.includes('Star-Crossed')) {
                t.sponsorTrust = Math.min(100, t.sponsorTrust + 5);
                t.excitementRating += 10;
            }

            t.vitals.hunger += hungerDrain;
            t.vitals.thirst += thirstDrain;
            t.vitals.fatigue += fatigueDrain;
            t.vitals.sanity -= 5; // Base sanity drain
            
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

            // Consume medical items to heal wounds, cure infections, or restore health
            const medkitIdx = t.inventory.findIndex(i => i.id === 'medkit');
            if (medkitIdx >= 0 && (t.health < 70 || Object.values(t.injuries).some(v => v))) {
                t.inventory.splice(medkitIdx, 1);
                t.health = Math.min(100, t.health + 50);
                t.injuries.bleeding = false;
                t.injuries.infected = false;
                t.injuries.head = false;
                t.injuries.torso = false;
                t.injuries.arms = false;
                t.injuries.legs = false;
                this.logEvent(`${t.name} uses a First Aid Kit to heal their wounds.`, [t.id], true);
            } else {
                const ointmentIdx = t.inventory.findIndex(i => i.id === 'ointment');
                if (ointmentIdx >= 0 && (t.health < 85 || t.injuries.infected || t.injuries.bleeding)) {
                    t.inventory.splice(ointmentIdx, 1);
                    t.health = Math.min(100, t.health + 25);
                    t.injuries.infected = false;
                    t.injuries.bleeding = false;
                    this.logEvent(`${t.name} applies Burn Ointment, soothing their injuries and infections.`, [t.id], true);
                }
            }

            this.checkDeath(t);
        });

        const currentAlive = this.getAlive();
        
        // 3. Dynamic Stances, Movement (Zones) & Crafting
        const acted = new Set<string>();
        currentAlive.forEach(t => {
            // Crafting
            const hasRope = t.inventory.findIndex(i => i.id === 'rope');
            const hasKnife = t.inventory.findIndex(i => i.id === 'knife');
            if (hasRope >= 0 && hasKnife >= 0 && !t.inventory.some(i => i.id === 'spear')) {
                t.inventory.splice(Math.max(hasRope, hasKnife), 1);
                t.inventory.splice(Math.min(hasRope, hasKnife), 1);
                const spear = ITEMS.find(i => i.id === 'spear')!;
                t.inventory.push({ ...spear });
                this.logEvent(`${t.name} crafts a Spear using a Rope and a Knife.`, [t.id]);
            }

            // Update Stance
            const hasWeapon = t.inventory.some(i => i.type === 'weapon');
            if (t.health < 40 || t.injuries.bleeding) {
                t.stance = 'Evasive';
            } else if (hasWeapon && t.health > 70 && (t.isCareer || t.traits.includes('Bloodthirsty'))) {
                t.stance = 'Aggressive';
            } else {
                t.stance = 'Defensive';
            }

            // Movement
            if (t.vitals.sanity < 30 && this.rng.chance(0.4)) {
                this.handleInsanity(t);
                acted.add(t.id);
                return;
            }

            if (t.allianceId) {
                // Alliance members move together
                const allianceMembers = currentAlive.filter(m => m.allianceId === t.allianceId);
                const leader = allianceMembers[0]; // Simple leader logic
                if (t.id === leader.id) {
                    if (t.stance === 'Evasive' || this.rng.chance(0.5)) {
                        const collapsedList = this.state.collapsedZones || [];
                        const activeZones = this.state.arena.zones.filter(z => !collapsedList.includes(z));
                        const pool = activeZones.length > 0 ? activeZones : this.state.arena.zones;
                        const newZone = this.rng.pick(pool);
                        if (t.zone !== newZone) {
                            allianceMembers.forEach(m => m.zone = newZone);
                            if (t.stance !== 'Evasive') {
                                this.logEvent(`The alliance of ${allianceMembers.map(m => m.name).join(', ')} travels to ${newZone}.`, allianceMembers.map(m => m.id));
                            }
                        }
                    }
                }
            } else if (t.stance === 'Evasive' || this.rng.chance(0.5)) {
                const collapsedList = this.state.collapsedZones || [];
                const activeZones = this.state.arena.zones.filter(z => !collapsedList.includes(z));
                const pool = activeZones.length > 0 ? activeZones : this.state.arena.zones;
                const newZone = this.rng.pick(pool);
                if (t.zone !== newZone) {
                    t.zone = newZone;
                    if (t.stance !== 'Evasive') {
                        this.logEvent(`${t.name} travels to ${newZone}.`, [t.id]);
                    }
                }
            }
        });

        const shuffled = [...currentAlive].sort(() => this.rng.nextFloat() - 0.5);

        shuffled.forEach(t => {
            if (acted.has(t.id) || t.status === 'dead') return;

            let eventChance = 0.1;
            let muttChance = 0.1;
            if (isEscalated) {
                const multiplier = 1 + (this.state.day - 5) * 0.3;
                eventChance = Math.min(0.35, eventChance * multiplier);
                muttChance = Math.min(0.35, muttChance * multiplier);
            }

            if (this.rng.chance(eventChance)) {
                const event = this.rng.pick(this.state.arena.events);
                if (this.rng.chance(0.5)) {
                    t.health -= 30;
                    this.logEvent(`${t.name} is caught in a ${event} in ${t.zone} and is severely injured!`, [t.id], true);
                } else {
                    this.logEvent(`${t.name} barely escapes a ${event} in ${t.zone}.`, [t.id]);
                }
                this.checkDeath(t);
                acted.add(t.id);
                return;
            }

            if (this.rng.chance(muttChance)) {
                const mutt = this.rng.pick(this.state.arena.mutts);
                if (t.attributes.agility > 6 && this.rng.chance(0.7)) {
                    this.logEvent(`${t.name} outruns a pack of ${mutt} in ${t.zone}.`, [t.id]);
                } else {
                    t.health -= 40;
                    t.injuries.bleeding = true;
                    this.logEvent(`${t.name} is attacked by ${mutt} in ${t.zone} and barely survives.`, [t.id], true);
                }
                this.checkDeath(t);
                acted.add(t.id);
                return;
            }

            // Only encounter others in the SAME ZONE
            const others = shuffled.filter(o => o.id !== t.id && !acted.has(o.id) && o.status === 'alive' && o.zone === t.zone);
            if (others.length > 0 && this.rng.chance(0.4)) {
                const other = others[0];
                
                // Alliance Logic
                const inSameAlliance = t.allianceId && t.allianceId === other.allianceId;
                
                // Grudge/Debt Logic
                const relationship = t.relationships[other.id] || 0;

                if (inSameAlliance) {
                    // Share resources within alliance
                    const tHungry = t.vitals.hunger > 40;
                    const oHasFood = other.inventory.some(i => i.type === 'food');
                    if (tHungry && oHasFood) {
                        const foodIdx = other.inventory.findIndex(i => i.type === 'food');
                        const food = other.inventory.splice(foodIdx, 1)[0];
                        t.vitals.hunger = Math.max(0, t.vitals.hunger - 40);
                        this.logEvent(`${other.name} shares their ${food.name} with ${t.name}.`, [t.id, other.id]);
                    }
                    this.logEvent(`${t.name} and ${other.name} support each other in ${t.zone}.`, [t.id, other.id]);
                } else if (relationship > 20) {
                    const template = this.rng.pick(ENCOUNTER_TEXTS.shareResources);
                    const text = template.replace('{t1}', t.name).replace('{t2}', other.name).replace('{zone}', t.zone);
                    this.logEvent(text, [t.id, other.id]);
                    t.vitals.hunger = Math.max(0, t.vitals.hunger - 10);
                    other.vitals.hunger = Math.max(0, other.vitals.hunger - 10);
                } else if (t.stance === 'Aggressive' || other.stance === 'Aggressive' || relationship < -10) {
                    this.resolveCombat(t, other);
                } else {
                    if (this.rng.chance(0.5)) {
                        const template = this.rng.pick(ENCOUNTER_TEXTS.peaceful);
                        const text = template.replace('{t1}', t.name).replace('{t2}', other.name).replace('{zone}', t.zone);
                        this.logEvent(text, [t.id, other.id]);
                    } else {
                        const template = this.rng.pick(ENCOUNTER_TEXTS.friendly);
                        const text = template.replace('{t1}', t.name).replace('{t2}', other.name).replace('{zone}', t.zone);
                        this.logEvent(text, [t.id, other.id]);
                        t.vitals.sanity = Math.min(100, t.vitals.sanity + 10);
                        other.vitals.sanity = Math.min(100, other.vitals.sanity + 10);
                        t.relationships[other.id] = (t.relationships[other.id] || 0) + 10;
                        other.relationships[t.id] = (other.relationships[t.id] || 0) + 10;
                    }
                }
                acted.add(t.id);
                acted.add(other.id);
                return;
            }

            if (t.stance === 'Evasive') {
                this.logEvent(`${t.name} hides quietly in ${t.zone}.`, [t.id]);
            } else if (t.stance === 'Defensive') {
                if (this.rng.chance(0.4)) {
                    const item = this.rng.pick(ITEMS.filter(i => i.type === 'food' || i.type === 'water'));
                    t.inventory.push(item);
                    this.logEvent(`${t.name} forages in ${t.zone} and finds a ${item.name}.`, [t.id]);
                } else {
                    this.logEvent(`${t.name} sets up camp and rests in ${t.zone}.`, [t.id]);
                }
            } else {
                this.logEvent(`${t.name} hunts for other tributes in ${t.zone} but finds no one.`, [t.id]);
            }
            acted.add(t.id);
        });

        this.processSponsors();
    }

    private handleInsanity(t: Tribute) {
        const roll = this.rng.nextFloat();
        if (roll < 0.4) {
            // Hallucination
            const template = this.rng.pick(SANITY_TEXTS.hallucination);
            const text = template.replace('{tribute}', t.name).replace('{zone}', t.zone);
            this.logEvent(text, [t.id], true);
            t.vitals.sanity -= 5;
        } else if (roll < 0.7) {
            // Ruin Stealth
            const template = this.rng.pick(SANITY_TEXTS.ruinStealth);
            const text = template.replace('{tribute}', t.name).replace('{zone}', t.zone);
            this.logEvent(text, [t.id], true);
            t.attributes.stealth = Math.max(0, t.attributes.stealth - 2);
            // Alert others - increase encounter chance in this zone? 
            // For now just log it as important.
        } else if (t.inventory.length > 0) {
            // Drop Item
            const itemIdx = this.rng.nextInt(0, t.inventory.length - 1);
            const item = t.inventory.splice(itemIdx, 1)[0];
            const template = this.rng.pick(SANITY_TEXTS.dropItem);
            const text = template.replace('{tribute}', t.name).replace('{item}', item.name).replace('{zone}', t.zone);
            this.logEvent(text, [t.id], true);
        } else {
            // Default to hallucination if no items
            const template = this.rng.pick(SANITY_TEXTS.hallucination);
            const text = template.replace('{tribute}', t.name).replace('{zone}', t.zone);
            this.logEvent(text, [t.id], true);
        }
    }

    private processSponsors() {
        const alive = this.getAlive();
        alive.forEach(t => {
            const sponsorScore = t.excitementRating + t.sponsorTrust;
            if (sponsorScore > 100 && this.rng.chance(0.3)) {
                const gift = this.rng.pick(ITEMS.filter(i => i.value > 20));
                t.inventory.push(gift);
                t.excitementRating -= 50; // Consume some rating
                this.logEvent(`${t.name} receives a sponsor gift: ${gift.name}!`, [t.id], true);
            }
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

    public processEpilogue() {
        this.state.phase = 'epilogue';
        const alive = this.getAlive();
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
        
        this.state.epilogueInterview = qas;
    }
}
