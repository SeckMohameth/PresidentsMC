import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Crew, CrewAlbum, CrewMember, CrewStats, CrewStatsSnapshot, Ride } from '@/types';

export type ClubStatsExportFormat = 'pdf' | 'csv' | 'json';

type ClubStatsExportInput = {
  crew: Crew;
  members: CrewMember[];
  rides: Ride[];
  albums: CrewAlbum[];
  crewStats: CrewStats;
  statsHistory: CrewStatsSnapshot[];
};

function safeFilePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'club';
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n');
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildExportData(input: ClubStatsExportInput) {
  const generatedAt = new Date().toISOString();
  const completedRides = input.rides.filter((ride) => ride.status === 'completed');
  const upcomingRides = input.rides.filter((ride) => ride.status === 'upcoming');
  const cancelledRides = input.rides.filter((ride) => ride.status === 'cancelled');
  const checkedInCount = input.rides.reduce((sum, ride) => sum + (ride.checkedIn?.length || 0), 0);
  const bikeCount = input.members.reduce(
    (sum, member) => sum + (member.bikes?.length || (member.bike ? 1 : 0)),
    0
  );

  const summary = {
    clubName: input.crew.name,
    generatedAt,
    totalMembers: input.crewStats.totalMembers,
    admins: input.members.filter((member) => member.role === 'admin').length,
    officers: input.members.filter((member) => member.role === 'officer').length,
    members: input.members.filter((member) => member.role === 'member').length,
    totalRides: input.crewStats.totalRides,
    completedRides: completedRides.length,
    upcomingRides: upcomingRides.length,
    cancelledRides: cancelledRides.length,
    totalMiles: Number(input.crewStats.totalMiles.toFixed(1)),
    ridesThisMonth: input.crewStats.ridesThisMonth,
    milesThisMonth: Number(input.crewStats.milesThisMonth.toFixed(1)),
    totalPhotos: input.crewStats.totalPhotos,
    albums: input.albums.length,
    bikeProfiles: bikeCount,
    totalCheckIns: checkedInCount,
  };

  const members = input.members
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((member) => ({
      name: member.name,
      email: member.email,
      role: member.role,
      leadershipTitle: member.leadershipTitle || '',
      joined: member.joinedCrewAt || member.joinedAt,
      ridesAttended: member.ridesAttended || 0,
      milesTraveled: Number((member.milesTraveled || 0).toFixed(1)),
      bikes: member.bikes?.map((bike) => bike.name).join('; ') || member.bike || '',
    }));

  const rides = input.rides
    .slice()
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
    .map((ride) => ({
      title: ride.title,
      status: ride.status,
      dateTime: ride.dateTime,
      pace: ride.pace,
      start: ride.startLocation?.name || '',
      end: ride.endLocation?.name || '',
      estimatedMiles: Number((ride.estimatedDistance || 0).toFixed(1)),
      attendees: ride.attendees?.length || 0,
      checkedIn: ride.checkedIn?.length || 0,
      photos: ride.photos?.length || 0,
      createdBy: ride.createdByName || '',
    }));

  const history = input.statsHistory.map((item) => ({
    period: item.period,
    periodStart: item.periodStart,
    periodEnd: item.periodEnd,
    totalRides: item.totalRides,
    totalMiles: Number((item.totalMiles || 0).toFixed(1)),
    totalPhotos: item.totalPhotos,
    totalMembers: item.totalMembers,
  }));

  return { summary, members, rides, history };
}

function buildCsv(input: ClubStatsExportInput) {
  const data = buildExportData(input);
  return [
    'Summary',
    toCsv([data.summary]),
    '',
    'Members',
    toCsv(data.members),
    '',
    'Rides',
    toCsv(data.rides),
    '',
    'Stats History',
    toCsv(data.history),
  ].join('\n');
}

function buildJson(input: ClubStatsExportInput) {
  return JSON.stringify(buildExportData(input), null, 2);
}

function renderTable(rows: Array<Record<string, unknown>>, columns: Array<[string, string]>) {
  if (rows.length === 0) return '<p class="muted">No records.</p>';

  return `
    <table>
      <thead>
        <tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${columns.map(([key]) => `<td>${escapeHtml(row[key])}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function buildPdfHtml(input: ClubStatsExportInput) {
  const data = buildExportData(input);
  const summaryRows = Object.entries(data.summary).map(([key, value]) => ({ metric: key, value }));

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; color: #111; padding: 28px; }
          h1 { font-size: 28px; margin: 0 0 4px; }
          h2 { font-size: 18px; margin: 28px 0 10px; }
          p { margin: 0; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
          th { text-align: left; background: #111; color: #fff; padding: 7px; }
          td { border-bottom: 1px solid #ddd; padding: 7px; vertical-align: top; }
          .muted { color: #777; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(input.crew.name)} Club Stats</h1>
        <p>Generated ${escapeHtml(formatDateTime(data.summary.generatedAt))}</p>

        <h2>Summary</h2>
        ${renderTable(summaryRows, [['metric', 'Metric'], ['value', 'Value']])}

        <h2>Members</h2>
        ${renderTable(data.members.map((member) => ({
          ...member,
          joined: formatDate(member.joined),
        })), [
          ['name', 'Name'],
          ['role', 'Role'],
          ['leadershipTitle', 'Title'],
          ['joined', 'Joined'],
          ['ridesAttended', 'Rides'],
          ['milesTraveled', 'Miles'],
          ['bikes', 'Bikes'],
        ])}

        <h2>Rides</h2>
        ${renderTable(data.rides.map((ride) => ({
          ...ride,
          dateTime: formatDateTime(ride.dateTime),
        })), [
          ['title', 'Ride'],
          ['status', 'Status'],
          ['dateTime', 'Date'],
          ['pace', 'Pace'],
          ['estimatedMiles', 'Miles'],
          ['attendees', 'Attendees'],
          ['checkedIn', 'Check-ins'],
          ['photos', 'Photos'],
        ])}
      </body>
    </html>
  `;
}

async function shareFile(uri: string, mimeType: string) {
  if (Platform.OS === 'web') {
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType });
  }
}

export async function exportClubStats(format: ClubStatsExportFormat, input: ClubStatsExportInput) {
  const basename = `${safeFilePart(input.crew.name)}-club-stats-${new Date().toISOString().slice(0, 10)}`;

  if (format === 'pdf') {
    const result = await Print.printToFileAsync({
      html: buildPdfHtml(input),
      base64: false,
    });
    await shareFile(result.uri, 'application/pdf');
    return result.uri;
  }

  const extension = format === 'csv' ? 'csv' : 'json';
  const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
  const content = format === 'csv' ? buildCsv(input) : buildJson(input);
  const uri = `${FileSystem.cacheDirectory}${basename}.${extension}`;

  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await shareFile(uri, mimeType);
  return uri;
}
