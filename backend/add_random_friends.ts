import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const FIRST_NAMES = [
  "Alex", "Amina", "Arman", "Daniel", "Dina", "Emma", "Farida", "Ilya",
  "Jasur", "Kamila", "Liam", "Madina", "Maya", "Noah", "Samira", "Timur",
  "Yuki", "Zarina",
];
const LAST_NAMES = [
  "Adams", "Brown", "Chen", "Garcia", "Ivanov", "Kim", "Lee", "Miller",
  "Nakamura", "Patel", "Smith", "Taylor", "Williams", "Yamada",
];

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function randomName(): string {
  const first = FIRST_NAMES[randomBytes(2).readUInt16BE() % FIRST_NAMES.length]!;
  const last = LAST_NAMES[randomBytes(2).readUInt16BE() % LAST_NAMES.length]!;
  return `${first} ${last}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("For safety, random friends can only be added to a local SQLite database.");
  }

  const targetUniqueId = readOption("--target")?.trim();
  if (!targetUniqueId) {
    throw new Error("Specify the account with --target USER#1234");
  }

  const requestedCount = Number(readOption("--count") ?? 5);
  if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 50) {
    throw new Error("--count must be an integer from 1 to 50");
  }

  const target = await prisma.user.findUnique({
    where: { uniqueId: targetUniqueId },
    select: { id: true, username: true },
  });
  if (!target) throw new Error(`No account found with unique ID ${targetUniqueId}`);

  const added: string[] = [];
  for (let index = 0; index < requestedCount; index += 1) {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const username = randomName();
    const user = await prisma.user.create({
      data: {
        username,
        email: `demo-${suffix}@example.invalid`,
        password: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
        uniqueId: `USER#${suffix.toUpperCase()}`,
      },
      select: { id: true, username: true },
    });

    await prisma.friendship.create({
      data: {
        requesterId: target.id,
        receiverId: user.id,
        status: "ACCEPTED",
      },
    });
    added.push(user.username);
  }

  console.log(`Added ${added.length} random friends for ${target.username}:`);
  added.forEach((username) => console.log(`- ${username}`));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
