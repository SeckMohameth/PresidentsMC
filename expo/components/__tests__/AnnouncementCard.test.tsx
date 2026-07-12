import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import AnnouncementCard from '@/components/AnnouncementCard';
import { useAuth } from '@/providers/AuthProvider';
import { Announcement } from '@/types';

jest.mock('@/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

const announcement = (overrides: Partial<Announcement> = {}): Announcement => ({
  id: 'a1',
  crewId: 'crew-1',
  authorId: 'admin-1',
  authorName: 'Joe Smith',
  authorAvatar: '',
  authorRole: 'admin',
  title: 'Meeting Friday',
  content: 'Mandatory meeting at the clubhouse, 7pm.',
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(), // 5m ago
  isPinned: false,
  likedBy: [],
  ...overrides,
});

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'me' } });
});

describe('AnnouncementCard', () => {
  it('renders author, badge, timestamp, title, and content', async () => {
    const screen = await render(<AnnouncementCard announcement={announcement()} />);
    expect(screen.getByText('Joe Smith')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
    expect(screen.getByText('5m ago')).toBeTruthy();
    expect(screen.getByText('Meeting Friday')).toBeTruthy();
    expect(screen.getByText('Mandatory meeting at the clubhouse, 7pm.')).toBeTruthy();
  });

  it('shows an Officer badge for officers and none for members', async () => {
    const officer = await render(<AnnouncementCard announcement={announcement({ authorRole: 'officer' })} />);
    expect(officer.getByText('Officer')).toBeTruthy();

    const member = await render(<AnnouncementCard announcement={announcement({ authorRole: 'member' })} />);
    expect(member.queryByText('Admin')).toBeNull();
    expect(member.queryByText('Officer')).toBeNull();
  });

  it('shows the pinned banner only for pinned announcements', async () => {
    const pinned = await render(<AnnouncementCard announcement={announcement({ isPinned: true })} />);
    expect(pinned.getByText('Pinned')).toBeTruthy();
    const plain = await render(<AnnouncementCard announcement={announcement()} />);
    expect(plain.queryByText('Pinned')).toBeNull();
  });

  it('shows the like count and fires onToggleLike', async () => {
    const onToggleLike = jest.fn();
    const screen = await render(
      <AnnouncementCard announcement={announcement({ likedBy: ['a', 'b', 'me'] })} onToggleLike={onToggleLike} />
    );
    await fireEvent.press(screen.getByText('3'));
    expect(onToggleLike).toHaveBeenCalledTimes(1);
  });

  it('opens the announcement link through Linking', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const screen = await render(
      <AnnouncementCard announcement={announcement({ link: 'https://club.example.com/rules' })} />
    );
    await fireEvent.press(screen.getByText('https://club.example.com/rules'));
    expect(openURL).toHaveBeenCalledWith('https://club.example.com/rules');
    openURL.mockRestore();
  });

  it('falls back to author initials when there is no avatar', async () => {
    const screen = await render(<AnnouncementCard announcement={announcement({ authorAvatar: '' })} />);
    expect(screen.getByText('JS')).toBeTruthy();
  });
});
