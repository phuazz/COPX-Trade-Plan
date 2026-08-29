/* Edge-case tests for sessionsBehind() in index.html.
 *
 * The vault rule is that date arithmetic uses a date library and carries at
 * least two edge-case tests, one crossing a month boundary and one crossing a
 * year boundary. This page is a single static file with a strict no-external-
 * asset budget, so date-fns cannot be loaded into it; the arithmetic therefore
 * uses the platform Date API in UTC (whole-day addition to a UTC midnight, so
 * no local timezone or DST shift can move a bar across a date line) and the
 * required edge cases are pinned here instead.
 *
 * JavaScript months are 0-indexed: Date.UTC(2026, 0, 1) is 1 January 2026.
 *
 * Run:  node test_sessions_behind.mjs
 */
import fs from 'fs';

// Lift the function out of the page rather than restating it, so the test
// cannot drift away from the code it is meant to pin.
const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const from = html.indexOf('function _utcMidnight');
const to = html.indexOf('window.sessionsBehind');
if (from < 0 || to < 0 || to <= from) {
  console.error('FAIL: could not locate sessionsBehind in index.html — markers moved?');
  process.exit(1);
}
const sessionsBehind = new Function(html.slice(from, to) + '\nreturn sessionsBehind;')();

const U = (y, m, d, h = 12) => new Date(Date.UTC(y, m, d, h));   // m is 0-indexed
let failures = 0;

function check(name, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${got}, want ${want})`);
}

console.log('sessionsBehind — basics');
// 28 Aug 2026 is a Friday; 29 Aug a Saturday; 31 Aug the Monday after.
check('Friday bar read on the Saturday      ', sessionsBehind(U(2026, 7, 28), U(2026, 7, 29)), 0);
check('Friday bar read on the Sunday        ', sessionsBehind(U(2026, 7, 28), U(2026, 7, 30)), 0);
check('Friday bar read on the Monday        ', sessionsBehind(U(2026, 7, 28), U(2026, 7, 31)), 1);
check('Thursday bar read on the Saturday    ', sessionsBehind(U(2026, 7, 27), U(2026, 7, 29)), 1);
check('same day                             ', sessionsBehind(U(2026, 7, 28), U(2026, 7, 28)), 0);
check('bar ahead of now (clock skew)        ', sessionsBehind(U(2026, 7, 28), U(2026, 7, 27)), 0);

console.log('sessionsBehind — MONTH boundary');
// 31 Aug 2026 is a Monday, 1 Sep a Tuesday: the count must cross the month end.
check('Mon 31 Aug bar -> Tue 1 Sep          ', sessionsBehind(U(2026, 7, 31), U(2026, 8, 1)), 1);
check('Fri 28 Aug bar -> Tue 1 Sep          ', sessionsBehind(U(2026, 7, 28), U(2026, 8, 1)), 2);
// February in a non-leap year: 28 Feb 2026 is a Saturday, 2 Mar the Monday.
check('Sat 28 Feb bar -> Mon 2 Mar (no 29th)', sessionsBehind(U(2026, 1, 28), U(2026, 2, 2)), 1);
// And a leap year, where the 29th exists and is a Saturday in 2028.
check('Mon 28 Feb 2028 -> Wed 1 Mar (leap)  ', sessionsBehind(U(2028, 1, 28), U(2028, 2, 1)), 2);

console.log('sessionsBehind — YEAR boundary');
// 31 Dec 2026 is a Thursday, 1 Jan 2027 a Friday, 4 Jan 2027 the Monday.
check('Thu 31 Dec 2026 -> Fri 1 Jan 2027    ', sessionsBehind(U(2026, 11, 31), U(2027, 0, 1)), 1);
check('Thu 31 Dec 2026 -> Mon 4 Jan 2027    ', sessionsBehind(U(2026, 11, 31), U(2027, 0, 4)), 2);
check('Wed 30 Dec 2026 -> Mon 4 Jan 2027    ', sessionsBehind(U(2026, 11, 30), U(2027, 0, 4)), 3);

console.log('sessionsBehind — the case that matters here');
// The baked snapshot, read on the day the transport failed. Any figure well
// clear of 2 puts the page in its `stale` branch, which is the assertion.
const bakedAge = sessionsBehind(U(2026, 1, 28), U(2026, 7, 29));
console.log(`  baked 28 Feb 2026 read on 29 Aug 2026 = ${bakedAge} sessions`);
check('baked snapshot reads as clearly stale', bakedAge >= 2, true);
check('null bar returns null, not 0         ', sessionsBehind(null, U(2026, 7, 29)), null);
check('invalid Date returns null, not 0     ', sessionsBehind(new Date('nope'), U(2026, 7, 29)), null);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
