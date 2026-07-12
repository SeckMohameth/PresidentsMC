import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { exportClubStats } from '@/utils/clubStatsExport';
import { Crew, CrewAlbum, CrewMember, CrewStats, CrewStatsSnapshot, Ride } from '@/types';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(async () => undefined),
  EncodingType: { UTF8: 'utf8' },
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: 'file:///print/stats.pdf' })),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const NOW = new Date('2026-07-15T18:00:00.000Z');

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

const crew = {
  id: 'crew-1',
  name: 'The Presidents M.C.',
} as Crew;

const memberBase = {
  avatar: '',
  email: '',
  joinedAt: '2025-01-01T00:00:00.000Z',
  joinedCrewAt: '2025-02-01T00:00:00.000Z',
  ridesAttended: 0,
  milesTraveled: 0,
};

const members: CrewMember[] = [
  {
    ...memberBase,
    id: 'm2',
    name: 'Zed Rider',
    email: 'zed@club.com',
    role: 'member',
    ridesAttended: 3,
    milesTraveled: 120.46,
    bike: 'Road King',
  } as CrewMember,
  {
    ...memberBase,
    id: 'm1',
    name: 'Joe "Hammer" Smith',
    email: 'joe@club.com',
    role: 'admin',
    leadershipTitle: 'President',
    ridesAttended: 10,
    milesTraveled: 900,
    bikes: [
      { id: 'b1', name: 'Street Glide', createdAt: '2025-01-01', isPrimary: true },
      { id: 'b2', name: 'Fat Boy', createdAt: '2025-01-02' },
    ],
  } as CrewMember,
  {
    ...memberBase,
    id: 'm3',
    name: 'Ana Torres',
    email: 'ana@club.com',
    role: 'officer',
  } as CrewMember,
];

const rides: Ride[] = [
  {
    id: 'r-old',
    title: 'Spring Opener',
    status: 'completed',
    dateTime: '2026-04-01T14:00:00.000Z',
    pace: 'casual',
    estimatedDistance: 82.35,
    attendees: ['m1', 'm2'],
    checkedIn: ['m1'],
    photos: [{ id: 'p1' } as any],
    startLocation: { name: 'Clubhouse' } as any,
    endLocation: { name: 'Lookout' } as any,
    createdByName: 'Joe "Hammer" Smith',
  } as unknown as Ride,
  {
    id: 'r-new',
    title: 'Summer Run',
    status: 'upcoming',
    dateTime: '2026-08-01T14:00:00.000Z',
    pace: 'spirited',
    estimatedDistance: 150,
    attendees: ['m1'],
    checkedIn: [],
    photos: [],
    startLocation: { name: 'Clubhouse' } as any,
    endLocation: { name: 'Coast' } as any,
    createdByName: 'Ana Torres',
  } as unknown as Ride,
  {
    id: 'r-cancelled',
    title: 'Rainout',
    status: 'cancelled',
    dateTime: '2026-05-01T14:00:00.000Z',
    pace: 'moderate',
    estimatedDistance: 0,
    attendees: [],
    checkedIn: [],
    photos: [],
    startLocation: { name: 'Clubhouse' } as any,
    endLocation: { name: 'Nowhere' } as any,
    createdByName: '',
  } as unknown as Ride,
];

const crewStats: CrewStats = {
  totalRides: 3,
  totalMiles: 1020.46,
  totalPhotos: 1,
  totalMembers: 3,
  ridesThisMonth: 1,
  milesThisMonth: 82.35,
};

const statsHistory: CrewStatsSnapshot[] = [
  {
    id: 's1',
    crewId: 'crew-1',
    period: 'month',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    totalRides: 2,
    totalMiles: 300.128,
    totalPhotos: 4,
    totalMembers: 3,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

const input = { crew, members, rides, albums: [] as CrewAlbum[], crewStats, statsHistory };

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  setPlatform('ios');
});

afterEach(() => {
  jest.useRealTimers();
  setPlatform('ios');
});

describe('exportClubStats — json', () => {
  it('writes a dated, filesystem-safe file and shares it', async () => {
    const uri = await exportClubStats('json', input);
    expect(uri).toBe('file:///cache/the-presidents-m-c-club-stats-2026-07-15.json');
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(uri, expect.any(String), {
      encoding: 'utf8',
    });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(uri, { mimeType: 'application/json' });
  });

  it('exports accurate summary counts and sorted members/rides', async () => {
    await exportClubStats('json', input);
    const content = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1] as string;
    const data = JSON.parse(content);

    expect(data.summary).toMatchObject({
      clubName: 'The Presidents M.C.',
      totalMembers: 3,
      admins: 1,
      officers: 1,
      members: 1,
      completedRides: 1,
      upcomingRides: 1,
      cancelledRides: 1,
      totalMiles: 1020.5, // rounded to 1 decimal
      totalCheckIns: 1,
      bikeProfiles: 3, // 2 from bikes[] + 1 legacy single bike
    });

    // Members alphabetical, rides newest first.
    expect(data.members.map((m: any) => m.name)).toEqual([
      'Ana Torres',
      'Joe "Hammer" Smith',
      'Zed Rider',
    ]);
    expect(data.rides.map((r: any) => r.title)).toEqual(['Summer Run', 'Rainout', 'Spring Opener']);

    // Multi-bike members list every bike; single-bike members fall back.
    expect(data.members[1].bikes).toBe('Street Glide; Fat Boy');
    expect(data.members[2].bikes).toBe('Road King');

    expect(data.history[0]).toMatchObject({ period: 'month', totalMiles: 300.1 });
  });
});

describe('exportClubStats — csv', () => {
  it('escapes quotes so member names cannot break the CSV', async () => {
    await exportClubStats('csv', input);
    const content = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1] as string;
    expect(content).toContain('"Joe ""Hammer"" Smith"');
    expect(content).toContain('Summary');
    expect(content).toContain('Members');
    expect(content).toContain('Rides');
    expect(content).toContain('Stats History');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.stringMatching(/\.csv$/), {
      mimeType: 'text/csv',
    });
  });
});

describe('exportClubStats — pdf', () => {
  it('renders HTML with escaped content and shares the printed file', async () => {
    const uri = await exportClubStats('pdf', {
      ...input,
      crew: { ...crew, name: 'Presidents <MC> & "Co"' },
    });
    expect(uri).toBe('file:///print/stats.pdf');
    const { html } = (Print.printToFileAsync as jest.Mock).mock.calls[0][0];
    expect(html).toContain('Presidents &lt;MC&gt; &amp; &quot;Co&quot; Club Stats');
    expect(html).not.toContain('<MC>');
    expect(html).toContain('Joe &quot;Hammer&quot; Smith');
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///print/stats.pdf', {
      mimeType: 'application/pdf',
    });
  });
});

describe('exportClubStats — web', () => {
  it('skips the share sheet on web', async () => {
    setPlatform('web');
    await exportClubStats('json', input);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});
