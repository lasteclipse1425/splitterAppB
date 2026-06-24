import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  let bb = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'bb' },
        { email: 'bb@example.com' },
        { uniqueId: 'user_bb' }
      ]
    }
  });

  if (!bb) {
    console.log('User bb not found! Creating bb...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    bb = await prisma.user.create({
      data: {
        username: 'bb',
        email: 'bb@example.com',
        password: hashedPassword,
        uniqueId: 'user_bb',
      }
    });
  }

  console.log(`Found/Created user bb with ID: ${bb.id}`);

  const mockUsers = await prisma.user.findMany({
    where: {
      username: {
        in: ['alice', 'bob', 'charlie', 'david', 'eve', 'Gay']
      }
    }
  });

  console.log('Creating friendships for bb...');
  for (const mockUser of mockUsers) {
    if (mockUser.id === bb.id) continue;
    
    // bb -> mockUser
    await prisma.friendship.upsert({
      where: {
        requesterId_receiverId: {
          requesterId: bb.id,
          receiverId: mockUser.id,
        },
      },
      update: { status: 'ACCEPTED' },
      create: {
        requesterId: bb.id,
        receiverId: mockUser.id,
        status: 'ACCEPTED',
      },
    });

    // mockUser -> bb
    await prisma.friendship.upsert({
      where: {
        requesterId_receiverId: {
          requesterId: mockUser.id,
          receiverId: bb.id,
        },
      },
      update: { status: 'ACCEPTED' },
      create: {
        requesterId: mockUser.id,
        receiverId: bb.id,
        status: 'ACCEPTED',
      },
    });
    console.log(`Friendship created between ${bb.username} and ${mockUser.username}`);
  }

  console.log('Seeding complete for user bb!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
