import dotenv from 'dotenv';
dotenv.config();

import { ApiClient } from './api';
import { generateAllPersonas, BotPersona } from './identities';
import { BotInstance } from './actions';
import { Scheduler } from './scheduler';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8080';
const ACTIONS_PER_HOUR = parseInt(process.env.ACTIONS_PER_HOUR ?? '20', 10);

// ============================================================================
// Bot initialization
// ============================================================================

async function initializeBot(persona: BotPersona): Promise<BotInstance | null> {
    const api = new ApiClient(API_BASE_URL);

    try {
        await api.fetchCsrfToken();
    } catch {
        console.warn(`[init] Could not fetch CSRF token for ${persona.username}`);
    }

    // Step 1: Verify email first (init-signup-ver → complete-signup-ver)
    try {
        const verResp = await api.initSignupVerification(persona.email);
        const otp = typeof verResp === 'string' ? verResp : (verResp?.otp ?? verResp?.code ?? verResp?.data);
        if (otp) {
            await api.completeSignupVerification(persona.email, String(otp));
            console.log(`[init] Verified email: ${persona.email}`);
        } else {
            console.warn(`[init] Could not extract OTP for ${persona.email}, response:`, verResp);
        }
    } catch (verErr) {
        console.warn(`[init] Verification failed for ${persona.email}:`, (verErr as Error).message);
    }

    // Step 2: Register the user
    try {
        const resp = await api.register({
            email: persona.email,
            username: persona.username,
            password: persona.password,
        });
        console.log(`[init] Registered: ${persona.username} (${persona.company})`);

        // Step 3: Update profile with company info
        try {
            await api.updateProfile({
                summary: persona.bio,
                company_name: persona.company,
                job_title: persona.jobTitle,
            });
        } catch {
            // Profile update may fail, that's ok
        }

        return {
            api,
            persona,
            userId: resp.user?.id,
            verified: true,
        };
    } catch (err: unknown) {
        if (ApiClient.is4xx(err)) {
            // User likely already exists, try to login
            try {
                await api.fetchCsrfToken();
                const resp = await api.login({
                    username: persona.username,
                    password: persona.password,
                });
                console.log(`[init] Logged in: ${persona.username} (${persona.company})`);
                return {
                    api,
                    persona,
                    userId: resp.user?.id,
                    verified: true,
                };
            } catch (loginErr) {
                if (ApiClient.isUnauthorized(loginErr)) {
                    console.warn(`[init] ${persona.username} — login failed (likely unverified), will retry later`);
                    return {
                        api,
                        persona,
                        verified: false,
                    };
                }
                console.error(`[init] Login failed for ${persona.username}:`, (loginErr as Error).message);
                return null;
            }
        }
        console.error(`[init] Registration failed for ${persona.username}:`, (err as Error).message);
        return null;
    }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('='.repeat(60));
    console.log('InsideGist Bot Service v2.0');
    console.log(`API: ${API_BASE_URL}`);
    console.log(`Actions/hour: ${ACTIONS_PER_HOUR}`);
    console.log('='.repeat(60));

    const personas = generateAllPersonas();
    console.log(`\nGenerated ${personas.length} bot personas across 5 companies\n`);

    // Initialize all bots (register or login)
    const bots: BotInstance[] = [];
    for (const persona of personas) {
        const bot = await initializeBot(persona);
        if (bot) bots.push(bot);

        // Small delay between registrations to avoid rate-limiting
        await new Promise(r => setTimeout(r, 500));
    }

    const verified = bots.filter(b => b.verified).length;
    const unverified = bots.filter(b => !b.verified).length;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Initialized ${bots.length} bots (${verified} verified, ${unverified} awaiting verification)`);
    console.log('='.repeat(60));

    if (bots.length === 0) {
        console.error('No bots could be initialized. Exiting.');
        process.exit(1);
    }

    // Start the scheduler
    const scheduler = new Scheduler(bots, ACTIONS_PER_HOUR);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nReceived SIGINT, shutting down...');
        scheduler.stop();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        console.log('\nReceived SIGTERM, shutting down...');
        scheduler.stop();
        process.exit(0);
    });

    await scheduler.start();
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
