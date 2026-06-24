import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  let userBb = await prisma.user.findFirst({
    where: { username: 'Bb' }
  });

  if (!userBb) {
    console.log('Creating user Bb...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    userBb = await prisma.user.create({
      data: {
        username: 'Bb',
        email: 'Bb@example.com',
        password: hashedPassword,
        uniqueId: 'user_Bb_cap',
      }
    });
  }

  const allUsers = await prisma.user.findMany();
  let linked = 0;
  for (let i = 0; i < allUsers.length; i++) {
    for (let j = i + 1; j < allUsers.length; j++) {
      const u1 = allUsers[i];
      const u2 = allUsers[j];

      await prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: u1.id, receiverId: u2.id },
            { requesterId: u2.id, receiverId: u1.id }
          ]
        }
      });

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

  console.log(`Linked everything including Bb! Total friendships: ${linked}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
