import {
    BotInstance,
    createTextPost,
    createMediaPost,
    createChannelTextPost,
    createChannelMediaPost,
    createPollPost,
    reactToPost,
    reactToComment,
    commentOnPost,
    voteOnPoll,
    followUser,
    followChannel,
} from './actions';
import { ApiClient } from './api';

// ============================================================================
// Weighted action definitions
// ============================================================================

interface WeightedAction {
    name: string;
    weight: number;
    fn: (bot: BotInstance) => Promise<void>;
}

const ACTIONS: WeightedAction[] = [
    { name: 'createTextPost', weight: 12, fn: createTextPost },
    { name: 'createMediaPost', weight: 12, fn: createMediaPost },
    { name: 'createChannelTextPost', weight: 13, fn: createChannelTextPost },
    { name: 'createChannelMediaPost', weight: 10, fn: createChannelMediaPost },
    { name: 'createPollPost', weight: 8, fn: createPollPost },
    { name: 'reactToPost', weight: 15, fn: reactToPost },
    { name: 'reactToComment', weight: 5, fn: reactToComment },
    { name: 'commentOnPost', weight: 10, fn: commentOnPost },
    { name: 'voteOnPoll', weight: 5, fn: voteOnPoll },
    { name: 'followUser', weight: 5, fn: followUser },
    { name: 'followChannel', weight: 5, fn: followChannel },
];

// ============================================================================
// Weighted random selection
// ============================================================================

function pickWeightedAction(): WeightedAction {
    const totalWeight = ACTIONS.reduce((sum, a) => sum + a.weight, 0);
    let random = Math.random() * totalWeight;

    for (const action of ACTIONS) {
        random -= action.weight;
        if (random <= 0) return action;
    }

    return ACTIONS[0]!;
}

function randomDelay(minMs: number, maxMs: number): number {
    return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
}

// ============================================================================
// Scheduler
// ============================================================================

export class Scheduler {
    private bots: BotInstance[];
    private running = false;
    private actionsPerHour: number;

    constructor(bots: BotInstance[], actionsPerHour = 20) {
        this.bots = bots;
        this.actionsPerHour = actionsPerHour;
    }

    /**
     * Start the scheduler loop. Picks a random bot and a weighted random action
     * at randomized intervals.
     */
    async start(): Promise<void> {
        this.running = true;
        console.log(`[scheduler] Starting with ${this.bots.length} bots, ~${this.actionsPerHour} actions/hour`);

        // Average interval between actions
        const avgIntervalMs = (3600 * 1000) / this.actionsPerHour;

        while (this.running) {
            // Filter out bots that aren't verified (got 401)
            const activeBots = this.bots.filter(b => b.verified);
            if (activeBots.length === 0) {
                console.log('[scheduler] No verified bots available. Waiting 5 minutes before retry...');
                await this.sleep(5 * 60 * 1000);

                // Try to re-login all bots
                for (const bot of this.bots) {
                    try {
                        await bot.api.fetchCsrfToken();
                        await bot.api.login({ username: bot.persona.username, password: bot.persona.password });
                        bot.verified = true;
                        console.log(`[scheduler] Re-logged in: ${bot.persona.username}`);
                    } catch {
                        bot.verified = false;
                    }
                }
                continue;
            }

            // Pick a random bot and action
            const bot = activeBots[Math.floor(Math.random() * activeBots.length)]!;
            const action = pickWeightedAction();

            try {
                console.log(`\n[scheduler] ${bot.persona.username} → ${action.name}`);
                await action.fn(bot);
            } catch (err: unknown) {
                if (ApiClient.isUnauthorized(err)) {
                    console.warn(`[scheduler] ${bot.persona.username} got 401 — marking as unverified`);
                    bot.verified = false;
                } else {
                    console.error(`[scheduler] Action ${action.name} failed for ${bot.persona.username}:`, (err as Error).message);
                }
            }

            // Random delay: 50%–150% of average interval to feel human
            const delay = randomDelay(avgIntervalMs * 0.5, avgIntervalMs * 1.5);
            console.log(`[scheduler] Next action in ${Math.round(delay / 1000)}s`);
            await this.sleep(delay);
        }
    }

    stop(): void {
        this.running = false;
        console.log('[scheduler] Stopping...');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
