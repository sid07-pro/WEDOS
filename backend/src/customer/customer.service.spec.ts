import { Test, TestingModule } from '@nestjs/testing';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
  UserRole: { CUSTOMER: 'CUSTOMER', VENDOR: 'VENDOR', ADMIN: 'ADMIN' },
}));

jest.mock('../prisma/prisma.service');

describe('CustomerService', () => {
  let service: CustomerService;
  let prismaMock: {
    user: { findUnique: jest.Mock };
    wedding: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
      wedding: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty dashboard when user has no wedding', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'cust-1',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya@example.com',
      role: 'CUSTOMER',
    });
    prismaMock.wedding.findUnique.mockResolvedValue(null);

    const result = await service.getDashboard('cust-1');
    expect(result.hasWedding).toBe(false);
    expect(result.wedding).toBeNull();
    expect(result.budget.totalBudget).toBe(0);
    expect(result.events).toHaveLength(0);
    expect(result.user.firstName).toBe('Priya');
  });

  it('should return populated dashboard when user has a wedding with events, expenses, tasks, guests', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'cust-1',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya@example.com',
      role: 'CUSTOMER',
    });
    prismaMock.wedding.findUnique.mockResolvedValue({
      id: 'wed-1',
      customerId: 'cust-1',
      date: new Date('2026-12-14T10:00:00Z'),
      location: 'The Grand Palace Banquets, Delhi NCR',
      totalBudget: 1500000,
      events: [
        {
          id: 'ev-1',
          name: 'Mehendi Ceremony',
          startTime: new Date('2026-12-12T10:00:00Z'),
          endTime: new Date('2026-12-12T18:00:00Z'),
          location: 'Sharma Residence, Delhi',
        },
      ],
      expenses: [
        { id: 'exp-1', title: 'Venue Booking', amount: 75000 },
        { id: 'exp-2', title: 'Photography', amount: 45000 },
      ],
      tasks: [
        { id: 't-1', title: 'Finalise guest list', isCompleted: true },
        { id: 't-2', title: 'Confirm catering menu', isCompleted: false },
      ],
      guests: [
        { id: 'g-1', rsvpStatus: 'ATTENDING', plusOneCount: 1 },
        { id: 'g-2', rsvpStatus: 'PENDING', plusOneCount: 0 },
        { id: 'g-3', rsvpStatus: 'DECLINED', plusOneCount: 0 },
      ],
    });

    const result = await service.getDashboard('cust-1');
    expect(result.hasWedding).toBe(true);
    expect(result.wedding?.totalBudget).toBe(1500000);
    expect(result.budget.totalSpent).toBe(120000);
    expect(result.budget.remainingBudget).toBe(1380000);
    expect(result.tasks.totalTasks).toBe(2);
    expect(result.tasks.completedTasks).toBe(1);
    expect(result.tasks.completedPercentage).toBe(50);
    expect(result.guests.totalGuests).toBe(3);
    expect(result.guests.attending).toBe(1);
    expect(result.guests.pending).toBe(1);
    expect(result.guests.declined).toBe(1);
    expect(result.guests.totalHeadcount).toBe(2);
    expect(result.events).toHaveLength(1);
    expect(result.nextEvent?.name).toBe('Mehendi Ceremony');
  });

  it('should update only the authenticated customer wedding', async () => {
    prismaMock.wedding.findUnique.mockResolvedValue({ id: 'wed-1' });
    prismaMock.wedding.update.mockResolvedValue({
      id: 'wed-1',
      date: new Date('2026-12-14T00:00:00Z'),
      location: 'Delhi',
      totalBudget: { toString: () => '1500000.50' },
    });

    const result = await service.updateWedding('cust-1', {
      date: '2026-12-14',
      location: '  Delhi  ',
      totalBudget: '1500000.50',
    });

    expect(prismaMock.wedding.update).toHaveBeenCalledWith({
      where: { customerId: 'cust-1' },
      data: {
        date: new Date('2026-12-14T00:00:00.000Z'),
        location: 'Delhi',
        totalBudget: '1500000.50',
      },
    });
    expect(result.totalBudget).toBe('1500000.50');
  });

  it('should create a wedding for the authenticated customer', async () => {
    prismaMock.wedding.findUnique.mockResolvedValue(null);
    prismaMock.wedding.create.mockResolvedValue({
      id: 'wed-1',
      date: new Date('2026-12-14T00:00:00Z'),
      location: 'Delhi',
      totalBudget: { toString: () => '1500000.00' },
    });

    const result = await service.createWedding('cust-1', {
      date: '2026-12-14',
      location: '  Delhi  ',
      totalBudget: '1500000.00',
    });

    expect(prismaMock.wedding.create).toHaveBeenCalledWith({
      data: {
        customerId: 'cust-1',
        date: new Date('2026-12-14T00:00:00.000Z'),
        location: 'Delhi',
        totalBudget: '1500000.00',
      },
    });
    expect(result.id).toBe('wed-1');
  });

  it('should reject creating a second wedding for the same customer', async () => {
    prismaMock.wedding.findUnique.mockResolvedValue({ id: 'wed-1' });

    await expect(
      service.createWedding('cust-1', {
        date: '2026-12-14',
        location: 'Delhi',
        totalBudget: '1500000.00',
      }),
    ).rejects.toThrow('A wedding already exists for this customer');
    expect(prismaMock.wedding.create).not.toHaveBeenCalled();
  });

  it('should expose pending tasks and upcoming task list on the dashboard', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'cust-1',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya@example.com',
      role: 'CUSTOMER',
    });
    prismaMock.wedding.findUnique.mockResolvedValue({
      id: 'wed-1',
      customerId: 'cust-1',
      date: new Date('2026-12-14T10:00:00Z'),
      location: 'Delhi',
      totalBudget: 1000,
      events: [],
      expenses: [],
      tasks: [
        {
          id: 't-1',
          title: 'Book caterer',
          dueDate: new Date('2026-11-01T00:00:00Z'),
          isCompleted: false,
        },
        { id: 't-2', title: 'Send invites', dueDate: null, isCompleted: false },
        { id: 't-3', title: 'Pick venue', dueDate: null, isCompleted: true },
      ],
      guests: [],
    });

    const result = await service.getDashboard('cust-1');
    expect(result.tasks.pendingTasks).toBe(2);
    expect(result.upcomingTasks).toHaveLength(2);
    expect(result.upcomingTasks[0].title).toBe('Book caterer');
    expect(result.upcomingTasks[0].dueDate).toBe('2026-11-01T00:00:00.000Z');
    expect(result.upcomingTasks[1].dueDate).toBeNull();
    expect(result.upcomingEventsCount).toBe(0);
  });
});
