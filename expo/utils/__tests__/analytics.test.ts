/**
 * utils/analytics keeps module-level queue/disable state, so every test gets a
 * fresh module via jest.resetModules() + require().
 */

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.1.1', ios: { buildNumber: '15' } } },
}));

jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));

type AnalyticsModule = typeof import('@/utils/analytics');

let analytics: AnalyticsModule;
let callable: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetModules();
  callable = jest.fn(async () => ({ data: { ok: true } }));
  const { httpsCallable } = require('firebase/functions');
  (httpsCallable as jest.Mock).mockReturnValue(callable);
  analytics = require('@/utils/analytics');
});

afterEach(() => {
  jest.useRealTimers();
});

async function flushDebounce() {
  await jest.advanceTimersByTimeAsync(1300);
}

describe('trackAnalyticsEvent', () => {
  it('debounces, then sends one enriched batch', async () => {
    await analytics.trackAnalyticsEvent({
      eventName: 'ride_create_success',
      actorUserId: 'user-1',
      crewId: 'crew-1',
      properties: { paceLabel: 'Casual', dropped: undefined },
    });
    expect(callable).not.toHaveBeenCalled(); // debounced

    await flushDebounce();
    expect(callable).toHaveBeenCalledTimes(1);

    const { events } = callable.mock.calls[0][0];
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.eventName).toBe('ride_create_success');
    expect(event.actorUserId).toBe('user-1');
    expect(event.crewId).toBe('crew-1');
    expect(event.appVersion).toBe('1.1.1');
    expect(event.buildNumber).toBe('15');
    expect(event.platform).toBe('ios');
    expect(event.id).toMatch(/^evt_/);
    expect(event.installationId).toMatch(/^inst_/);
    // undefined properties must be stripped before hitting the function.
    expect(event.properties).toEqual({ paceLabel: 'Casual' });
  });

  it('flushes immediately when a full batch of 20 accumulates', async () => {
    for (let i = 0; i < 20; i++) {
      await analytics.trackAnalyticsEvent({ eventName: 'app_open' });
    }
    // No timer advance needed — the size threshold forces the flush.
    await jest.advanceTimersByTimeAsync(0);
    expect(callable).toHaveBeenCalledTimes(1);
    expect(callable.mock.calls[0][0].events).toHaveLength(20);
  });

  it('trackScreenView emits a screen_view event carrying the route', async () => {
    await analytics.trackScreenView('/ride/abc', 'user-1', 'crew-1');
    await flushDebounce();
    const event = callable.mock.calls[0][0].events[0];
    expect(event.eventName).toBe('screen_view');
    expect(event.route).toBe('/ride/abc');
    expect(event.properties).toEqual({ route: '/ride/abc' });
  });
});

describe('flush failure handling', () => {
  it('disables analytics permanently when the function is not deployed', async () => {
    callable.mockRejectedValueOnce({ code: 'functions/not-found' });
    await analytics.trackAnalyticsEvent({ eventName: 'app_open' });
    await flushDebounce();
    expect(callable).toHaveBeenCalledTimes(1);

    await analytics.trackAnalyticsEvent({ eventName: 'screen_view' });
    await flushDebounce();
    expect(callable).toHaveBeenCalledTimes(1); // still 1 — disabled
  });

  it('drops pre-auth events instead of retry-spamming before login', async () => {
    callable.mockRejectedValueOnce({ code: 'functions/unauthenticated' });
    await analytics.trackAnalyticsEvent({ eventName: 'auth_sign_up_requested' });
    await flushDebounce();
    expect(callable).toHaveBeenCalledTimes(1);

    // The failed batch was dropped, not re-queued: nothing further to send.
    await jest.advanceTimersByTimeAsync(5000);
    expect(callable).toHaveBeenCalledTimes(1);

    // Analytics stays enabled for future events.
    await analytics.trackAnalyticsEvent({ eventName: 'auth_sign_in_success' });
    await flushDebounce();
    expect(callable).toHaveBeenCalledTimes(2);
    expect(callable.mock.calls[1][0].events[0].eventName).toBe('auth_sign_in_success');
  });

  it('re-queues and retries after a transient failure', async () => {
    callable.mockRejectedValueOnce({ code: 'unavailable' });
    await analytics.trackAnalyticsEvent({ eventName: 'ride_create_success' });
    await flushDebounce();
    expect(callable).toHaveBeenCalledTimes(1);

    await flushDebounce(); // rescheduled flush fires with the re-queued batch
    expect(callable).toHaveBeenCalledTimes(2);
    expect(callable.mock.calls[1][0].events[0].eventName).toBe('ride_create_success');
  });

  it('gives up after three consecutive internal failures and clears the queue', async () => {
    callable.mockRejectedValue({ code: 'functions/internal' });
    await analytics.trackAnalyticsEvent({ eventName: 'app_open' });

    await flushDebounce(); // failure 1 (requeued)
    await flushDebounce(); // failure 2 (requeued)
    await flushDebounce(); // failure 3 → disabled + queue cleared
    expect(callable).toHaveBeenCalledTimes(3);

    await analytics.trackAnalyticsEvent({ eventName: 'app_open' });
    await flushDebounce();
    expect(callable).toHaveBeenCalledTimes(3);
  });
});
