const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

// All helpers work in UTC to match DB
function nowUtc() {
  return dayjs.utc();
}

function toISODate(d = undefined) {
  return (d ? dayjs.utc(d) : dayjs.utc()).format('YYYY-MM-DD');
}

function toISOTime(d = undefined) {
  return (d ? dayjs.utc(d) : dayjs.utc()).format('HH:mm:ss');
}

function toISOString(d = undefined) {
  return (d ? dayjs.utc(d) : dayjs.utc()).toISOString();
}

function addMinutes(d, mins) {
  return dayjs.utc(d).add(mins, 'minute').toDate();
}

function isPast(d) {
  return dayjs.utc(d).isBefore(dayjs.utc());
}

function startOfDayUTC(d = undefined) {
  return (d ? dayjs.utc(d) : dayjs.utc()).startOf('day').toDate();
}

function endOfDayUTC(d = undefined) {
  return (d ? dayjs.utc(d) : dayjs.utc()).endOf('day').toDate();
}

module.exports = {
  nowUtc,
  toISODate,
  toISOTime,
  toISOString,
  addMinutes,
  isPast,
  startOfDayUTC,
  endOfDayUTC,
};