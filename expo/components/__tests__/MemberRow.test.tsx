import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import MemberRow from '@/components/MemberRow';
import { CrewMember } from '@/types';

const member = (overrides: Partial<CrewMember> = {}): CrewMember => ({
  id: 'm1',
  name: 'John Smith',
  avatar: '',
  email: 'john@club.com',
  joinedAt: '2025-01-01T00:00:00.000Z',
  joinedCrewAt: '2025-02-01T00:00:00.000Z',
  role: 'member',
  ridesAttended: 12,
  milesTraveled: 1500,
  ...overrides,
});

describe('MemberRow', () => {
  it('shows the name, role label, and ride/mile stats', async () => {
    const screen = await render(<MemberRow member={member()} />);
    expect(screen.getByText('John Smith')).toBeTruthy();
    expect(screen.getByText('Member')).toBeTruthy();
    expect(screen.getByText('12 rides • 1.5k mi')).toBeTruthy();
  });

  it('falls back to initials when the member has no avatar', async () => {
    const screen = await render(<MemberRow member={member({ avatar: '' })} />);
    expect(screen.getByText('JS')).toBeTruthy();
  });

  it('labels admins and officers by role', async () => {
    const admin = await render(<MemberRow member={member({ role: 'admin' })} />);
    expect(admin.getByText('Admin')).toBeTruthy();
    const officer = await render(<MemberRow member={member({ role: 'officer' })} />);
    expect(officer.getByText('Officer')).toBeTruthy();
  });

  it('prefers a leadership title and then shows the role kind next to it', async () => {
    const screen = await render(
      <MemberRow member={member({ role: 'admin', leadershipTitle: 'President' })} />
    );
    expect(screen.getByText('President')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
  });

  it('hides stats when showStats is false', async () => {
    const screen = await render(<MemberRow member={member()} showStats={false} />);
    expect(screen.queryByText(/rides •/)).toBeNull();
  });

  it('fires onPress for the row', async () => {
    const onPress = jest.fn();
    const screen = await render(<MemberRow member={member()} onPress={onPress} />);
    await fireEvent.press(screen.getByText('John Smith'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
