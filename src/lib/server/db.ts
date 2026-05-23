import { PrismaClient } from '@prisma/client';

// Uses process.env.NODE_ENV (not $app/environment) so this module can be loaded
// by tooling that runs outside the SvelteKit build context — notably
// `@better-auth/cli generate`, which evaluates auth.ts via jiti.
const isDev = process.env.NODE_ENV !== 'production';

// Vite HMR re-evaluates this module on every server-file edit. Without the
// globalThis cache, each reload constructs a fresh PrismaClient and we exhaust
// Neon's connection limit within seconds of dev work.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: isDev ? ['warn', 'error'] : ['error']
	});

if (isDev) globalForPrisma.prisma = prisma;
