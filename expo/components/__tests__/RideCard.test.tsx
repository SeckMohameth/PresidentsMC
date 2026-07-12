import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import RideCard from '@/components/RideCard';
import { useCrew } from '@/providers/CrewProvider';
import { useRouter } from 'expo-router';
import { Ride } from '@/types';

jest.mock('@/providers/CrewProvider', () => ({ useCrew: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

const NOW = new Date('2026-07-15T18:00:00.000Z');

const ride = (overrides: Partial<Ride> = {}): Ride => ({
  id: 'ride-1',
  crewId: 'crew-1',
  title: 'Bear Mountain Run',
  description: '',
  startLocation: { name: 'Clubhouse', address: '1 Main St', latitude: 40.7, longitude: -74 },
  endLocation: { name: 'Bear Mountain', address: 'NY', latitude: 41.3, longitude: -73.9 },
  dateTime: new Date(NOW.getTime() + 3 * 86400000).toISOString(),
  estimatedDuration: '2 hours',
  estimatedDistance: 85,
  pace: 'spirited',
  notes: '',
  coverImage: '',
  createdBy: 'u1',
  createdByName: 'Joe',
  attendees: ['u1', 'u2'],
  checkedIn: [],
  status: 'upcoming',
  photos: [],
  ...overrides,
});

const push = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  (useRouter as jest.Mock).mockReturnValue({ push });
  (useCrew as jest.Mock).mockReturnValue({ members: [] });
});

afterEach(() => jest.useRealTimers());

describe('RideCard status badge', () => {
  it('counts down to upcoming rides', async () => {
    const screen = await render(<RideCard ride={ride()} />);
    expect(screen.getByText('In 3 days')).toBeTruthy();
  });

  it('says Tomorrow and Today at the boundaries', async () => {
    // +20h lands on the next local calendar day while keeping getDaysUntil at 1.
    const tomorrow = await render(
      <RideCard ride={ride({ dateTime: new Date(NOW.getTime() + 20 * 3600000).toISOString() })} />
    );
    expect(tomorrow.getByText('Tomorrow')).toBeTruthy();

    const today = await render(
      <RideCard ride={ride({ dateTime: new Date(NOW.getTime() + 2 * 3600000).toISOString() })} />
    );
    expect(today.getByText('Today')).toBeTruthy();
  });

  it('labels active, completed, cancelled, and past-due rides', async () => {
    expect((await render(<RideCard ride={ride({ status: 'active' })} />)).getByText('Today')).toBeTruthy();
    expect((await render(<RideCard ride={ride({ status: 'completed' })} />)).getByText('Completed')).toBeTruthy();
    expect((await render(<RideCard ride={ride({ status: 'cancelled' })} />)).getByText('Cancelled')).toBeTruthy();

    const pastDue = await render(
      <RideCard ride={ride({ dateTime: new Date(NOW.getTime() - 3 * 86400000).toISOString() })} />
    );
    expect(pastDue.getByText('Past due')).toBeTruthy();
  });
});

describe('RideCard content and navigation', () => {
  it('shows the title, route, pace, and distance', async () => {
    const screen = await render(<RideCard ride={ride()} />);
    expect(screen.getByText('Bear Mountain Run')).toBeTruthy();
    expect(screen.getByText('Spirited')).toBeTruthy();
    expect(screen.getAllByText(/85/).length).toBeGreaterThan(0);
  });

  it('navigates to the ride detail on press', async () => {
    const screen = await render(<RideCard ride={ride()} />);
    await fireEvent.press(screen.getByText('Bear Mountain Run'));
    expect(push).toHaveBeenCalledWith('/ride/ride-1');
  });

  it('renders the compact variant with date and attendee count', async () => {
    const screen = await render(<RideCard ride={ride()} variant="compact" />);
    expect(screen.getByText('Bear Mountain Run')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // attendees
    await fireEvent.press(screen.getByText('Bear Mountain Run'));
    expect(push).toHaveBeenCalledWith('/ride/ride-1');
  });
});
