import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const users = [
    { username: 'alice', email: 'alice@example.com', password: 'password123', uniqueId: 'user_alice' },
    { username: 'bob', email: 'bob@example.com', password: 'password123', uniqueId: 'user_bob' },
    { username: 'charlie', email: 'charlie@example.com', password: 'password123', uniqueId: 'user_charlie' },
    { username: 'david', email: 'david@example.com', password: 'password123', uniqueId: 'user_david' },
    { username: 'eve', email: 'eve@example.com', password: 'password123', uniqueId: 'user_eve' },
  ];

  console.log('Creating users...');
  const createdUsers = [];
  for (const u of users) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        username: u.username,
        email: u.email,
        password: hashedPassword,
        uniqueId: u.uniqueId,
      },
    });
    createdUsers.push(user);
    console.log(`Created user: ${user.username}`);
  }

  console.log('Creating friendships...');
  for (let i = 0; i < createdUsers.length; i++) {
    for (let j = i + 1; j < createdUsers.length; j++) {
      const user1 = createdUsers[i];
      const user2 = createdUsers[j];

      await prisma.friendship.upsert({
        where: {
          requesterId_receiverId: {
            requesterId: user1.id,
            receiverId: user2.id,
          },
        },
        update: { status: 'ACCEPTED' },
        create: {
          requesterId: user1.id,
          receiverId: user2.id,
          status: 'ACCEPTED',
        },
      });

      await prisma.friendship.upsert({
        where: {
          requesterId_receiverId: {
            requesterId: user2.id,
            receiverId: user1.id,
          },
        },
        update: { status: 'ACCEPTED' },
        create: {
          requesterId: user2.id,
          receiverId: user1.id,
          status: 'ACCEPTED',
        },
      });
      console.log(`Friendship created between ${user1.username} and ${user2.username}`);
    }
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
