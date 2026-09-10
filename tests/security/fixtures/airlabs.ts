// Minimal, non-personal fields supplied in the manual validation request.
export const scheduleFixture = {
  flight_iata: 'G37656', dep_iata: 'GIG', arr_iata: 'AEP',
  dep_terminal: 2, dep_gate: 'C46', dep_time: '2026-09-06 22:45',
  dep_estimated: '2026-09-06 22:35', dep_actual: '2026-09-06 22:35', status: 'active',
};
export const liveFixture = {
  flight_iata: 'G37656', dep_iata: 'GIG', arr_iata: 'AEP', status: 'en-route', type: 'adsb',
};
// Synthetic temporal evidence for occurrence-matching tests, not a claimed provider capture.
export const timedScheduleFixture = { ...scheduleFixture, dep_actual_utc: '2026-09-07 01:35' };
export const timedLiveFixture = { ...liveFixture, updated: Date.parse('2026-09-07T02:00:00Z') / 1000 };
