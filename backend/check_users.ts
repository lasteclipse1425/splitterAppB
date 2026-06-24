import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allUsers = await prisma.user.findMany();
  console.log('All Users:');
  for (const u of allUsers) {
    console.log(`- ID: ${u.id}, username: '${u.username}', email: '${u.email}', uniqueId: '${u.uniqueId}'`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
