import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allUsers = await prisma.user.findMany();
  
  console.log(`Found ${allUsers.length} users. Linking everyone...`);
  
  let linked = 0;
  for (let i = 0; i < allUsers.length; i++) {
    for (let j = i + 1; j < allUsers.length; j++) {
      const u1 = allUsers[i];
      const u2 = allUsers[j];

      // To avoid duplicates that could mess up the frontend, we just need ONE row per friendship
      // Let's delete any existing friendships between them first to be clean
      await prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: u1.id, receiverId: u2.id },
            { requesterId: u2.id, receiverId: u1.id }
          ]
        }
      });

      // Now create a single clean friendship row
      await prisma.friendship.create({
        data: {
          requesterId: u1.id,
          receiverId: u2.id,
          status: 'ACCEPTED'
        }
      });
      linked++;
    }
  }

  console.log(`Created ${linked} unique friendships! Everyone is friends with everyone now.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
