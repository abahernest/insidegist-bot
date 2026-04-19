import { faker } from '@faker-js/faker';

// ============================================================================
// Company definitions with realistic roles
// ============================================================================

interface CompanyDef {
    name: string;
    domain: string;
    count: number;
    roles: string[];
}

const COMPANIES: CompanyDef[] = [
    {
        name: 'Kuda Bank',
        domain: 'kuda.com',
        count: 22,
        roles: [
            'Software Engineer', 'Senior Software Engineer', 'Staff Engineer',
            'Engineering Manager', 'Product Manager', 'Product Designer',
            'Data Analyst', 'Data Engineer', 'DevOps Engineer',
            'Mobile Engineer', 'Frontend Engineer', 'Backend Engineer',
            'QA Engineer', 'Technical Writer', 'Customer Success Manager',
            'Head of Engineering', 'VP of Product', 'Growth Manager',
            'Marketing Associate', 'People Operations Lead', 'Compliance Officer',
            'Risk Analyst',
        ],
    },
    {
        name: 'Moniepoint',
        domain: 'moniepoint.com',
        count: 18,
        roles: [
            'Software Engineer', 'Senior Software Engineer', 'Staff Engineer',
            'Engineering Manager', 'Product Manager', 'Product Designer',
            'Data Scientist', 'DevOps Engineer', 'Mobile Engineer',
            'Frontend Engineer', 'Backend Engineer', 'QA Engineer',
            'Head of Product', 'Growth Lead', 'Marketing Manager',
            'Business Development Manager', 'Compliance Officer', 'HR Manager',
        ],
    },
    {
        name: 'Interswitch',
        domain: 'interswitchgroup.com',
        count: 15,
        roles: [
            'Software Engineer', 'Senior Software Engineer', 'Solutions Architect',
            'Engineering Manager', 'Product Manager', 'Product Designer',
            'Data Engineer', 'DevOps Engineer', 'Security Engineer',
            'Backend Engineer', 'QA Lead', 'Head of Engineering',
            'Business Analyst', 'Project Manager', 'Technical Lead',
        ],
    },
    {
        name: 'Safaricom',
        domain: 'safaricom.co.ke',
        count: 12,
        roles: [
            'Software Engineer', 'Senior Software Engineer', 'Staff Engineer',
            'Engineering Manager', 'Product Manager', 'Data Scientist',
            'Mobile Engineer', 'Cloud Engineer', 'Network Engineer',
            'UX Researcher', 'Head of Digital', 'Technical Program Manager',
        ],
    },
    {
        name: 'Paystack',
        domain: 'paystack.com',
        count: 10,
        roles: [
            'Software Engineer', 'Senior Software Engineer', 'Staff Engineer',
            'Engineering Manager', 'Product Manager', 'Product Designer',
            'Developer Advocate', 'Frontend Engineer', 'Backend Engineer',
            'Head of Engineering',
        ],
    },
];

// ============================================================================
// Bot persona type
// ============================================================================

export interface BotPersona {
    username: string;
    email: string;
    password: string;
    fullName: string;
    company: string;
    jobTitle: string;
    bio: string;
}

// ============================================================================
// Generate all bot personas deterministically
// ============================================================================

export function generateAllPersonas(): BotPersona[] {
    // Seed faker for deterministic generation
    faker.seed(2026);
    
    const personas: BotPersona[] = [];

    for (const company of COMPANIES) {
        // Shuffle roles for variety, then assign
        const shuffledRoles = [...company.roles].sort(() => Math.random() - 0.5);

        for (let i = 0; i < company.count; i++) {
            const sex = i % 2 === 0 ? 'male' : 'female';
            const firstName = faker.person.firstName(sex as any);
            const lastName = faker.person.lastName();
            const fullName = `${firstName} ${lastName}`;

            // Build a unique, clean username
            const usernameBase = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            const username = `${usernameBase}${faker.number.int({ min: 10, max: 99 })}`;

            const role = shuffledRoles[i % shuffledRoles.length]!;

            const bioTemplates = [
                `${role} at ${company.name}. ${faker.lorem.sentence()}`,
                `${role} @ ${company.name} | Building the future of fintech 🚀`,
                `${role} at ${company.name}. Passionate about technology and innovation.`,
                `${role} • ${company.name} • ${faker.location.city()}`,
                `Currently ${role} at ${company.name}. Previously at ${faker.company.name()}.`,
                `${role} at ${company.name} | ${faker.person.zodiacSign()} energy`,
            ];

            personas.push({
                username,
                email: `${username}@${company.domain}`,
                password: 'BotPass2026!#',
                fullName,
                company: company.name,
                jobTitle: role,
                bio: bioTemplates[i % bioTemplates.length]!,
            });
        }
    }

    return personas;
}

// Total expected: 22 + 18 + 15 + 12 + 10 = 77 users
