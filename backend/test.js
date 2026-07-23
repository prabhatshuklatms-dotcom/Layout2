const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.amenityPlacement.count().then(console.log).catch(console.error).finally(() => prisma.$disconnect());
