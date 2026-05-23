import { PrismaClient } from '@prisma/client';
import { dev } from '$app/environment';

// Vite HMR re-evaluates this module on every server-file edit. Without the
// globalThis cache, each reload constructs a fresh PrismaClient and we exhaust
// Neon's connection limit within seconds of dev work.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: dev ? ['warn', 'error'] : ['error']
	});

if (dev) globalForPrisma.prisma = prisma;
