import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL } from '$app/env/private';
import { dev } from '$app/env';
import { PrismaClient } from '../../generated/prisma/client';

type PrismaGlobal = typeof globalThis & { prisma?: PrismaClient };

const globalForPrisma = globalThis as PrismaGlobal;

// Reuse one client across dev HMR reloads so connections are not exhausted.
export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

if (dev) {
	globalForPrisma.prisma = prisma;
}
