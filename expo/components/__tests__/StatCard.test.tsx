import React from 'react';
import { render } from '@testing-library/react-native';
import { Gauge } from 'lucide-react-native';
import StatCard from '@/components/StatCard';

describe('StatCard', () => {
  it('renders the value, label, and subtitle', async () => {
    const screen = await render(
      <StatCard icon={Gauge} label="Total Miles" value="1.2k" subtitle="this month" />
    );
    expect(screen.getByText('1.2k')).toBeTruthy();
    expect(screen.getByText('Total Miles')).toBeTruthy();
    expect(screen.getByText('this month')).toBeTruthy();
  });

  it('omits the subtitle row when none is given', async () => {
    const screen = await render(<StatCard icon={Gauge} label="Rides" value={42} />);
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.queryByText('this month')).toBeNull();
  });
});
