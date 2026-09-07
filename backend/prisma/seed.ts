/**
 * Wedding OS — Prisma Seed Script
 * Phase 2: Database Foundation
 *
 * Uses hardcoded UUIDs for full determinism.
 * Safe to run multiple times — all operations use upsert.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient, UserRole, VendorCategory, BookingStatus, RsvpStatus } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Stable Seed IDs ──────────────────────────────────────────────────────────

const USERS = {
  customer: 'a1000000-0000-0000-0000-000000000001',
  vendor1:  'a1000000-0000-0000-0000-000000000002',
  vendor2:  'a1000000-0000-0000-0000-000000000003',
  vendor3:  'a1000000-0000-0000-0000-000000000004',
  vendor4:  'a1000000-0000-0000-0000-000000000005',
  vendor5:  'a1000000-0000-0000-0000-000000000006',
  admin:    'a1000000-0000-0000-0000-000000000007',
};

const VENDOR_PROFILES = {
  photography: 'b2000000-0000-0000-0000-000000000001',
  venue:       'b2000000-0000-0000-0000-000000000002',
  catering:    'b2000000-0000-0000-0000-000000000003',
  music:       'b2000000-0000-0000-0000-000000000004',
  mehendi:     'b2000000-0000-0000-0000-000000000005',
};

const WEDDING_ID = 'c3000000-0000-0000-0000-000000000001';

const GUESTS = {
  g1: 'd4000000-0000-0000-0000-000000000001',
  g2: 'd4000000-0000-0000-0000-000000000002',
  g3: 'd4000000-0000-0000-0000-000000000003',
  g4: 'd4000000-0000-0000-0000-000000000004',
  g5: 'd4000000-0000-0000-0000-000000000005',
};

const EVENTS = {
  e1: 'e5000000-0000-0000-0000-000000000001',
  e2: 'e5000000-0000-0000-0000-000000000002',
  e3: 'e5000000-0000-0000-0000-000000000003',
};

const EXPENSES = {
  ex1: 'f6000000-0000-0000-0000-000000000001',
  ex2: 'f6000000-0000-0000-0000-000000000002',
  ex3: 'f6000000-0000-0000-0000-000000000003',
  ex4: 'f6000000-0000-0000-0000-000000000004',
};

const TASKS = {
  t1: 'a7000000-0000-0000-0000-000000000001',
  t2: 'a7000000-0000-0000-0000-000000000002',
  t3: 'a7000000-0000-0000-0000-000000000003',
  t4: 'a7000000-0000-0000-0000-000000000004',
};

const BOOKINGS = {
  b1: 'b8000000-0000-0000-0000-000000000001',
  b2: 'b8000000-0000-0000-0000-000000000002',
  b3: 'b8000000-0000-0000-0000-000000000003',
};

// ─── Placeholder password hash (NOT a real bcrypt hash — Phase 3 will add hashing) ──
// This value represents "password123" and will be replaced in Phase 3 with real bcrypt.
const DEV_PASSWORD_HASH = '$2b$10$PLACEHOLDER_HASH_FOR_DEVELOPMENT_ONLY_DO_NOT_USE_IN_PRODUCTION';

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Wedding OS database...');

  // ── Users ──────────────────────────────────────────────────────────────────

  const customer = await prisma.user.upsert({
    where:  { id: USERS.customer },
    update: {},
    create: {
      id:           USERS.customer,
      email:        'priya.sharma@dev.wedos.local',
      passwordHash: DEV_PASSWORD_HASH,
      role:         UserRole.CUSTOMER,
      firstName:    'Priya',
      lastName:     'Sharma',
    },
  });
  console.log(`  ✓ Customer: ${customer.email}`);

  const vendor1 = await prisma.user.upsert({
    where:  { id: USERS.vendor1 },
    update: {},
    create: {
      id:           USERS.vendor1,
      email:        'rajan.photography@dev.wedos.local',
      passwordHash: DEV_PASSWORD_HASH,
      role:         UserRole.VENDOR,
      firstName:    'Rajan',
      lastName:     'Kapoor',
    },
  });
  console.log(`  ✓ Vendor 1: ${vendor1.email}`);

  const vendor2 = await prisma.user.upsert({
    where:  { id: USERS.vendor2 },
    update: {},
    create: {
      id:           USERS.vendor2,
      email:        'grandpalace.venue@dev.wedos.local',
      passwordHash: DEV_PASSWORD_HASH,
      role:         UserRole.VENDOR,
      firstName:    'Meera',
      lastName:     'Patel',
    },
  });
  console.log(`  ✓ Vendor 2: ${vendor2.email}`);

  const vendor3 = await prisma.user.upsert({
    where:  { id: USERS.vendor3 },
    update: {},
    create: {
      id:           USERS.vendor3,
      email:        'royal.catering@dev.wedos.local',
      passwordHash: DEV_PASSWORD_HASH,
      role:         UserRole.VENDOR,
      firstName:    'Arjun',
      lastName:     'Nair',
    },
  });
  console.log(`  ✓ Vendor 3: ${vendor3.email}`);

  const vendor4 = await prisma.user.upsert({
    where:  { id: USERS.vendor4 },
    update: {},
    create: {
      id:           USERS.vendor4,
      email:        'beats.dj@dev.wedos.local',
      passwordHash: DEV_PASSWORD_HASH,
      role:         UserRole.VENDOR,
      firstName:    'Vikram',
      lastName:     'Singh',
    },
  });
  console.log(`  ✓ Vendor 4: ${vendor4.email}`);

  const vendor5 = await prisma.user.upsert({
    where:  { id: USERS.vendor5 },
    update: {},
    create: {
      id:           USERS.vendor5,
      email:        'henna.art@dev.wedos.local',
      passwordHash: DEV_PASSWORD_HASH,
      role:         UserRole.VENDOR,
      firstName:    'Sunita',
      lastName:     'Verma',
    },
  });
  console.log(`  ✓ Vendor 5: ${vendor5.email}`);

  const admin = await prisma.user.upsert({
    where:  { id: USERS.admin },
    update: {},
    create: {
      id:           USERS.admin,
      email:        'admin@dev.wedos.local',
      passwordHash: DEV_PASSWORD_HASH,
      role:         UserRole.ADMIN,
      firstName:    'Admin',
      lastName:     'WeddingOS',
    },
  });
  console.log(`  ✓ Admin: ${admin.email}`);

  // ── Vendor Profiles ────────────────────────────────────────────────────────

  await prisma.vendorProfile.upsert({
    where:  { id: VENDOR_PROFILES.photography },
    update: {},
    create: {
      id:            VENDOR_PROFILES.photography,
      userId:        USERS.vendor1,
      businessName:  'Rajan Kapoor Photography',
      category:      VendorCategory.PHOTOGRAPHY,
      description:   'Award-winning wedding photographer capturing timeless moments across India. Specialising in candid and traditional styles.',
      startingPrice: 45000,
      imageUrl:      'https://picsum.photos/seed/photography/800/600',
      location:      'Mumbai, Maharashtra',
    },
  });
  console.log('  ✓ Vendor Profile: Rajan Kapoor Photography');

  await prisma.vendorProfile.upsert({
    where:  { id: VENDOR_PROFILES.venue },
    update: {},
    create: {
      id:            VENDOR_PROFILES.venue,
      userId:        USERS.vendor2,
      businessName:  'The Grand Palace Banquets',
      category:      VendorCategory.VENUE,
      description:   'Luxurious banquet hall accommodating up to 1500 guests. Features a grand ballroom, garden lawn, and dedicated bridal suite.',
      startingPrice: 250000,
      imageUrl:      'https://picsum.photos/seed/venue/800/600',
      location:      'Delhi, NCR',
    },
  });
  console.log('  ✓ Vendor Profile: The Grand Palace Banquets');

  await prisma.vendorProfile.upsert({
    where:  { id: VENDOR_PROFILES.catering },
    update: {},
    create: {
      id:            VENDOR_PROFILES.catering,
      userId:        USERS.vendor3,
      businessName:  'Royal Feast Catering',
      category:      VendorCategory.CATERING,
      description:   'Premium multi-cuisine catering for weddings. Specialises in North Indian, South Indian, and Continental cuisine with live counters.',
      startingPrice: 800,
      imageUrl:      'https://picsum.photos/seed/catering/800/600',
      location:      'Bangalore, Karnataka',
    },
  });
  console.log('  ✓ Vendor Profile: Royal Feast Catering');

  await prisma.vendorProfile.upsert({
    where:  { id: VENDOR_PROFILES.music },
    update: {},
    create: {
      id:            VENDOR_PROFILES.music,
      userId:        USERS.vendor4,
      businessName:  'BeatMasters Entertainment',
      category:      VendorCategory.MUSIC,
      description:   'Professional DJ and live music service for weddings. Includes full sound setup, lighting, and a 6-hour entertainment package.',
      startingPrice: 30000,
      imageUrl:      'https://picsum.photos/seed/music/800/600',
      location:      'Hyderabad, Telangana',
    },
  });
  console.log('  ✓ Vendor Profile: BeatMasters Entertainment');

  await prisma.vendorProfile.upsert({
    where:  { id: VENDOR_PROFILES.mehendi },
    update: {},
    create: {
      id:            VENDOR_PROFILES.mehendi,
      userId:        USERS.vendor5,
      businessName:  'Sunita Henna Arts',
      category:      VendorCategory.MEHENDI,
      description:   'Intricate bridal mehendi designs by master artist Sunita Verma. Offers bridal, family, and guest packages with natural henna.',
      startingPrice: 5000,
      imageUrl:      'https://picsum.photos/seed/mehendi/800/600',
      location:      'Jaipur, Rajasthan',
    },
  });
  console.log('  ✓ Vendor Profile: Sunita Henna Arts');

  // ── Wedding ────────────────────────────────────────────────────────────────

  await prisma.wedding.upsert({
    where:  { id: WEDDING_ID },
    update: {},
    create: {
      id:          WEDDING_ID,
      customerId:  USERS.customer,
      date:        new Date('2026-12-14T10:00:00.000Z'),
      location:    'The Grand Palace Banquets, Delhi NCR',
      totalBudget: 1500000,
    },
  });
  console.log('  ✓ Wedding: Priya Sharma (14 December 2026, Delhi)');

  // ── Guests ────────────────────────────────────────────────────────────────

  const guestData = [
    { id: GUESTS.g1, name: 'Rahul Sharma',   email: 'rahul.sharma@example.com',   rsvpStatus: RsvpStatus.ATTENDING, plusOneCount: 1 },
    { id: GUESTS.g2, name: 'Anjali Gupta',   email: 'anjali.gupta@example.com',   rsvpStatus: RsvpStatus.ATTENDING, plusOneCount: 0 },
    { id: GUESTS.g3, name: 'Deepak Mehta',   email: 'deepak.mehta@example.com',   rsvpStatus: RsvpStatus.DECLINED,  plusOneCount: 0 },
    { id: GUESTS.g4, name: 'Kavya Reddy',    email: null,                         rsvpStatus: RsvpStatus.PENDING,   plusOneCount: 0 },
    { id: GUESTS.g5, name: 'Suresh Iyer',    email: 'suresh.iyer@example.com',    rsvpStatus: RsvpStatus.ATTENDING, plusOneCount: 2 },
  ];

  for (const guest of guestData) {
    await prisma.guest.upsert({
      where:  { id: guest.id },
      update: {},
      create: {
        id:           guest.id,
        weddingId:    WEDDING_ID,
        name:         guest.name,
        email:        guest.email ?? undefined,
        rsvpStatus:   guest.rsvpStatus,
        plusOneCount: guest.plusOneCount,
      },
    });
  }
  console.log(`  ✓ Guests: ${guestData.length} guests seeded`);

  // ── Events ────────────────────────────────────────────────────────────────

  const eventData = [
    {
      id:        EVENTS.e1,
      name:      'Mehendi Ceremony',
      startTime: new Date('2026-12-12T10:00:00.000Z'),
      endTime:   new Date('2026-12-12T18:00:00.000Z'),
      location:  'Sharma Residence, Delhi',
    },
    {
      id:        EVENTS.e2,
      name:      'Wedding Ceremony',
      startTime: new Date('2026-12-14T10:00:00.000Z'),
      endTime:   new Date('2026-12-14T14:00:00.000Z'),
      location:  'The Grand Palace Banquets, Delhi NCR',
    },
    {
      id:        EVENTS.e3,
      name:      'Reception',
      startTime: new Date('2026-12-14T18:00:00.000Z'),
      endTime:   new Date('2026-12-14T23:00:00.000Z'),
      location:  'The Grand Palace Banquets, Delhi NCR',
    },
  ];

  for (const event of eventData) {
    await prisma.event.upsert({
      where:  { id: event.id },
      update: {},
      create: { ...event, weddingId: WEDDING_ID },
    });
  }
  console.log(`  ✓ Events: ${eventData.length} events seeded`);

  // ── Expenses ──────────────────────────────────────────────────────────────

  const expenseData = [
    { id: EXPENSES.ex1, title: 'Venue Booking Deposit',    amount: 75000,  category: 'Venue',       isPaid: true  },
    { id: EXPENSES.ex2, title: 'Bridal Lehenga',           amount: 85000,  category: 'Clothing',    isPaid: true  },
    { id: EXPENSES.ex3, title: 'Photography Package',      amount: 45000,  category: 'Photography', isPaid: false },
    { id: EXPENSES.ex4, title: 'Catering Advance (500 pax)',amount: 400000, category: 'Catering',    isPaid: false },
  ];

  for (const expense of expenseData) {
    await prisma.expense.upsert({
      where:  { id: expense.id },
      update: {},
      create: { ...expense, weddingId: WEDDING_ID },
    });
  }
  console.log(`  ✓ Expenses: ${expenseData.length} expenses seeded`);

  // ── Tasks ─────────────────────────────────────────────────────────────────

  const taskData = [
    { id: TASKS.t1, title: 'Finalise guest list',          dueDate: new Date('2026-10-01'), isCompleted: true  },
    { id: TASKS.t2, title: 'Book the venue',               dueDate: new Date('2026-10-15'), isCompleted: true  },
    { id: TASKS.t3, title: 'Send wedding invitations',     dueDate: new Date('2026-11-01'), isCompleted: false },
    { id: TASKS.t4, title: 'Confirm catering menu',        dueDate: new Date('2026-11-15'), isCompleted: false },
  ];

  for (const task of taskData) {
    await prisma.task.upsert({
      where:  { id: task.id },
      update: {},
      create: { ...task, weddingId: WEDDING_ID },
    });
  }
  console.log(`  ✓ Tasks: ${taskData.length} tasks seeded`);

  // ── Bookings ──────────────────────────────────────────────────────────────

  const bookingData = [
    {
      id:          BOOKINGS.b1,
      weddingId:   WEDDING_ID,
      vendorId:    VENDOR_PROFILES.photography,
      status:      BookingStatus.ACCEPTED,
      message:     'Looking forward to capturing our special day!',
      serviceDate: new Date('2026-12-14T09:00:00.000Z'),
    },
    {
      id:          BOOKINGS.b2,
      weddingId:   WEDDING_ID,
      vendorId:    VENDOR_PROFILES.venue,
      status:      BookingStatus.ACCEPTED,
      message:     'Please confirm the banquet hall for 500 guests.',
      serviceDate: new Date('2026-12-14T08:00:00.000Z'),
    },
    {
      id:          BOOKINGS.b3,
      weddingId:   WEDDING_ID,
      vendorId:    VENDOR_PROFILES.mehendi,
      status:      BookingStatus.PENDING,
      message:     'Interested in bridal + 20 family members package.',
      serviceDate: new Date('2026-12-12T09:00:00.000Z'),
    },
  ];

  for (const booking of bookingData) {
    await prisma.booking.upsert({
      where:  { id: booking.id },
      update: {},
      create: booking,
    });
  }
  console.log(`  ✓ Bookings: ${bookingData.length} bookings seeded`);

  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
