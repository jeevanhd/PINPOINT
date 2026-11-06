import 'dotenv/config';
import { deflateSync } from 'node:zlib';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { getStorage } from '../src/storage';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@pinpoint.app';
const DEMO_PASSWORD = 'pinpoint123';

/** Tiny PNG writer so the demo place has a real photo without shipping a binary. */
function makePlacePhoto(width = 1200, height = 800): Buffer {
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();
  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = rowStart + 1 + x * 3;
      // A warm desk: paper base, a darker table edge, a notebook block.
      const onTable = y > height * 0.55;
      const notebook = x > width * 0.18 && x < width * 0.62 && y > height * 0.62 && y < height * 0.9;
      const mug = (x - width * 0.78) ** 2 + (y - height * 0.72) ** 2 < (width * 0.07) ** 2;
      const [r, g, b] = mug
        ? [47, 93, 80]
        : notebook
          ? [255, 253, 248]
          : onTable
            ? [198, 176, 148]
            : [246, 241, 231];
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const KEY_POINTS = [
  { id: 0, text: 'Chlorophyll in chloroplasts absorbs light energy' },
  { id: 1, text: 'Water is split and oxygen is released as a by-product' },
  { id: 2, text: 'The light reactions produce ATP and NADPH' },
  { id: 3, text: 'The Calvin cycle fixes carbon dioxide into glucose' },
  { id: 4, text: 'Glucose stores the energy captured from sunlight' },
  { id: 5, text: 'The rate depends on light intensity, carbon dioxide and temperature' },
];

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash, name: 'Jeevan H D', passMark: 70 },
    create: { email: DEMO_EMAIL, name: 'Jeevan H D', passwordHash, passMark: 70 },
  });

  // Start from a clean slate for this account so re-seeding is idempotent.
  await prisma.exam.deleteMany({ where: { userId: user.id } });
  await prisma.place.deleteMany({ where: { userId: user.id } });
  await prisma.topic.deleteMany({ where: { userId: user.id } });
  await prisma.unit.deleteMany({ where: { userId: user.id } });

  const unit = await prisma.unit.create({
    data: { userId: user.id, title: 'Biology - Unit 3' },
  });

  const topic = await prisma.topic.create({
    data: {
      userId: user.id,
      unitId: unit.id,
      title: 'Photosynthesis',
      notes:
        'Photosynthesis converts light energy into chemical energy. Chlorophyll absorbs light, water is split to release oxygen, and the Calvin cycle fixes carbon dioxide into glucose.',
      source: 'AI',
      keyPointsJson: KEY_POINTS,
      keyPointSeq: KEY_POINTS.length,
    },
  });

  const photo = makePlacePhoto();
  const stored = await getStorage().put({ buffer: photo, mimeType: 'image/png', extension: 'png' });

  const place = await prisma.place.create({
    data: { userId: user.id, name: 'Study desk', imageKey: stored.key },
  });

  await prisma.flag.createMany({
    data: [
      {
        placeId: place.id,
        userId: user.id,
        xPct: 24,
        yPct: 30,
        label: 'Lamp = light energy',
        notes: 'The lamp is the sunlight. Chlorophyll absorbs it.',
        topicId: topic.id,
        keyPointId: 0,
      },
      {
        placeId: place.id,
        userId: user.id,
        xPct: 46,
        yPct: 74,
        label: 'Notebook = Calvin cycle',
        notes: 'The open page fixes CO2 into glucose.',
        topicId: topic.id,
        keyPointId: 3,
      },
      {
        placeId: place.id,
        userId: user.id,
        xPct: 78,
        yPct: 70,
        label: 'Mug = water split',
        notes: 'Steam leaving the mug is the oxygen leaving.',
        topicId: topic.id,
        keyPointId: 1,
      },
      {
        placeId: place.id,
        userId: user.id,
        xPct: 62,
        yPct: 22,
        label: 'Window = ATP',
        notes: 'Free note: energy carrier, not a photo.',
      },
    ],
  });

  const inThreeDays = new Date();
  inThreeDays.setUTCHours(0, 0, 0, 0);
  inThreeDays.setUTCDate(inThreeDays.getUTCDate() + 3);

  await prisma.exam.create({
    data: { userId: user.id, title: 'Physics - Unit 2', subject: 'Physics', examDate: inThreeDays },
  });

  console.log(`Seeded demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Topic: ${topic.title} (${KEY_POINTS.length} key points), place: ${place.name} (4 flags)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
