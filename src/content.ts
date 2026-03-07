import OpenAI from 'openai';

// ============================================================================
// OpenAI content generation engine
// ============================================================================

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TextPostContent {
    title: string;
    body: string;
    imageQuery: string; // search term for Pexels image
}

interface PollPostContent {
    title: string;
    options: string[];
}

interface CommentContent {
    text: string;
}

// ============================================================================
// Channel-aware content topics
// ============================================================================

const CHANNEL_TYPE_PROMPTS: Record<string, string> = {
    TOPIC: `Generate a post about this topic. The post should be informative, engaging, and share real insights or knowledge. Include specific facts, data points, or actionable advice.`,
    COMPANY: `Generate a post about working in the fintech industry in Africa. Share an insider perspective—could be about company culture, technology choices, industry trends, career growth, or lessons learned. Be authentic and specific.`,
    LOCATION: `Generate a post about this location—could be local tech scene, startup ecosystem, job market, events, food spots, or lifestyle tips. Make it feel like a genuine local perspective.`,
    HASHTAG: `Generate a post related to this hashtag trend. Share a hot take, opinion, or insight that would spark discussion. Be conversational and authentic.`,
    CHANNEL: `Generate an engaging post appropriate for this channel's audience. Be informative yet conversational.`,
};

const GENERAL_POST_PROMPTS = [
    `Share a genuine career insight or lesson learned while working in African fintech. Be specific about a real challenge or achievement.`,
    `Share a tech industry observation or trend you've noticed recently. Include your personal perspective on why it matters.`,
    `Share a productivity tip, work-life balance insight, or professional development advice based on real experience.`,
    `Share an interesting technical concept, tool, or approach you've been exploring. Explain why it excites you.`,
    `Share a thought on the state of technology in Africa — startups, payments, mobile money, or digital services.`,
    `Share a workplace culture observation — what makes a great team, leadership lessons, or collaboration tips.`,
];

// ============================================================================
// Content generators
// ============================================================================

export async function generateTextPost(
    channelName?: string,
    channelType?: string,
    persona?: { company: string; jobTitle: string; fullName: string },
): Promise<TextPostContent> {
    let systemPrompt = `You are a professional working in African fintech. You write authentic, engaging social media posts — not corporate marketing speak. Your posts feel like real thoughts shared by a real person. Keep posts concise (2-4 sentences for body). Never use hashtags or emojis excessively.`;

    if (persona) {
        systemPrompt += ` You are a ${persona.jobTitle} at ${persona.company}.`;
    }

    let userPrompt: string;
    if (channelName && channelType && CHANNEL_TYPE_PROMPTS[channelType]) {
        userPrompt = `${CHANNEL_TYPE_PROMPTS[channelType]} The channel is called "${channelName}" (type: ${channelType}). Generate a post relevant to this channel.`;
    } else {
        userPrompt = GENERAL_POST_PROMPTS[Math.floor(Math.random() * GENERAL_POST_PROMPTS.length)]!;
    }

    const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: `${userPrompt}\n\nRespond in JSON: { "title": "short engaging title (max 10 words)", "body": "the post body (2-4 sentences, authentic tone)", "imageQuery": "a 2-3 word search query for a relevant stock photo, or empty string if no image needed" }`,
            },
        ],
        temperature: 0.9,
        max_tokens: 300,
    });

    const raw = resp.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    return {
        title: parsed.title ?? 'Untitled Post',
        body: parsed.body ?? '',
        imageQuery: parsed.imageQuery ?? '',
    };
}

export async function generatePollPost(
    channelName?: string,
    channelType?: string,
    persona?: { company: string; jobTitle: string },
): Promise<PollPostContent> {
    let systemPrompt = `You are a professional working in African fintech. Create an engaging poll question with 2-4 options that would spark discussion.`;

    if (persona) {
        systemPrompt += ` You are a ${persona.jobTitle} at ${persona.company}.`;
    }

    let context = '';
    if (channelName && channelType) {
        context = ` The poll is for the "${channelName}" channel (type: ${channelType}). Make it relevant.`;
    }

    const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: `Create a poll question with 2-4 options.${context}\n\nRespond in JSON: { "title": "the poll question", "options": ["option 1", "option 2", "option 3"] }`,
            },
        ],
        temperature: 0.9,
        max_tokens: 200,
    });

    const raw = resp.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    return {
        title: parsed.title ?? 'What do you think?',
        options: parsed.options ?? ['Yes', 'No'],
    };
}

export async function generateComment(
    postTitle: string,
    postBody: string,
    persona?: { company: string; jobTitle: string },
): Promise<CommentContent> {
    let systemPrompt = `You are a professional engaging in a social media discussion. Write a brief, authentic comment (1-2 sentences). Be conversational — agree, disagree, add perspective, or ask a question. Never be generic.`;

    if (persona) {
        systemPrompt += ` You are a ${persona.jobTitle} at ${persona.company}.`;
    }

    const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: `The post says:\nTitle: "${postTitle}"\nBody: "${postBody}"\n\nWrite a short, authentic comment (1-2 sentences). Just the comment text, no quotes.`,
            },
        ],
        temperature: 0.95,
        max_tokens: 100,
    });

    return {
        text: resp.choices[0]?.message?.content?.trim() ?? 'Interesting perspective!',
    };
}
