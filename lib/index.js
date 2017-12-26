'use strict';
/** Imports */
const pify = require('pify');
const fs = pify(require('fs'));
const { join } = require('path');
const net = require('net');
const co = require('co');
const moment = require('moment');
const execa = require('execa');

/** Constants */
const SOCK = '/tmp/tmux-status.sock';

const BATTERY_PATH        = '/sys/class/power_supply';
const BATTERY_STATUS_PATH = join(BATTERY_PATH, 'BAT1/status');
const BATTERY_FULL_PATH   = join(BATTERY_PATH, 'BAT1/charge_full');
const BATTERY_NOW_PATH    = join(BATTERY_PATH, 'BAT1/charge_now');

const COLOR_MAIN_BG              = '#626262'; // "colour241"
const COLOR_MAIN_FG              = '#121212'; // "colour233"

const COLOR_SPEC_BG              = '#1c1c1c'; // "colour234"
const COLOR_SPEC_FG              = '#af875f'; // "colour137"

const COLOR_TEMP_COOL            = '#0000ff'; // "colour021"
const COLOR_TEMP_NORMAL          = '#121212'; // "colour233"
const COLOR_TEMP_HOT             = '#ff0000'; // "colour196"

const COLOR_BAT_FULL             = '#005fff'; // "colour027"
const COLOR_BAT_CHARGING         = '#005fff'; // "$C_BAT_FULL"
const COLOR_BAT_DISCHARGING_HIGH = '#00af00'; // "colour034"
const COLOR_BAT_DISCHARGING_MED  = '#d7af00'; // "colour178"
const COLOR_BAT_DISCHARGING_LOW  = '#ff0000'; // "colour196"
const COLOR_BAT_EMPTY            = '#444444'; // "colour238"

const COLOR_WHOAMI               = '#870087'; // "colour090"
const COLOR_HOSTNAME             = '#870087'; // "$C_WHOAMI"


const RESET = `#[bg=${COLOR_MAIN_BG}]#[fg=${COLOR_MAIN_FG},none]`;

const makeBg = (color) => (str, mod) => `#[bg=${color}]${str}${RESET}`;
const makeFg = (color) => (str, mod) => `#[fg=${color}${mod ? ',' + mod : ''}]${str}${RESET}`;

const colorMainBG               = makeBg(COLOR_MAIN_BG);
const colorMainFG               = makeFg(COLOR_MAIN_FG);

const colorSpecBG               = makeBg(COLOR_SPEC_BG);
const colorSpecFG               = makeFg(COLOR_SPEC_FG);

const colorTempCool             = makeFg(COLOR_TEMP_COOL);
const colorTempNormal           = makeFg(COLOR_TEMP_NORMAL);
const colorTempHot              = makeFg(COLOR_TEMP_HOT);

const colorBatFullBg            = makeBg(COLOR_BAT_FULL);
const colorBatFullFg            = makeFg(COLOR_BAT_FULL);
const colorBatChargingBg        = makeBg(COLOR_BAT_CHARGING);
const colorBatChargingFg        = makeFg(COLOR_BAT_CHARGING);
const colorBatDischargingHighBg = makeBg(COLOR_BAT_DISCHARGING_HIGH);
const colorBatDischargingHighFg = makeFg(COLOR_BAT_DISCHARGING_HIGH);
const colorBatDischargingMedBg  = makeBg(COLOR_BAT_DISCHARGING_MED);
const colorBatDischargingMedFg  = makeFg(COLOR_BAT_DISCHARGING_MED);
const colorBatDischargingLowBg  = makeBg(COLOR_BAT_DISCHARGING_LOW);
const colorBatDischargingLowFg  = makeFg(COLOR_BAT_DISCHARGING_LOW);
const colorBatEmptyBg           = makeBg(COLOR_BAT_EMPTY);
const colorBatEmptyFg           = makeFg(COLOR_BAT_EMPTY);

const colorWhoami               = makeFg(COLOR_WHOAMI);
const colorHostname             = makeFg(COLOR_HOSTNAME);

const ICON_CPU       = 'c';
const ICON_RAM       = 'r';
const ICON_TEMP      = '🌡';
const ICON_BAT_FULL  = '⚡';
const ICON_BAT_EMPTY = '!';

const COLUMN = colorSpecBG(' ');

/** Helpers */
const isExistsSync = (path) => !!tryStatsSync(path);

const tryStatsSync = (path) => {
  try {
    return fs.statSync(path);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }

    throw err;
  }
}

const tryUnlinkSock = () => {
  const stats = tryStatsSync(SOCK);

  if (stats === null) {
    return;
  }

  if (!stats.isSocket()) {
    throw new Error(`Cannot unlink: ${SOCK}. File is not a socket`);
  }

  fs.unlinkSync(SOCK);
};

const close = () => {
  server.close();
  tryUnlinkSock();
};


/** Hooks */
process.on('exit',              () => close());
process.on('SIGINT',            () => process.exit(130));
process.on('SIGUSR1',           () => process.exit());
process.on('SIGUSR2',           () => process.exit());
process.on('uncaughtException', (err) => {
  console.error(err.stack);
  process.exit(1);
});

const server = net.createServer({
  allowHalfOpen: true
}, (socket) => {
  let data = '';

  socket.on('data', (buf) => {
    data += buf.toString('utf-8');
  });

  socket.on('end', () => {
    const [position, whoami] = data.trim().split(" ");

    switch (position.toLowerCase()) {
      case 'right': return socket.end(getStatusRight(whoami) + '\n');
      default: return socket.end();
    }
  });
});

server.on('error', (err) => {
  throw err;
});

tryUnlinkSock();
server.listen(SOCK);
fs.chmodSync(SOCK, 755);


const hasBattery = isExistsSync(BATTERY_PATH);

const getTemperature = co.wrap(function * getTemperature() {
  const { stdout: sensors } = yield execa('sensors');

  const matches = sensors.match(/Core\ 0:\s*\+(\d+\.\d+)/);
  if (matches === null) {
    throw new Error('Cannot detect temperature');
  }
  const temperature = parseInt(matches[1], 10);

  const color = temperature <= 50
              ? colorTempCool
              : temperature >= 75
              ? colorTempHot
              : colorTempNormal;

  return color(ICON_TEMP) + ': ' + color(temperature, 'bold') + '°c';
});

const getBattery = co.wrap(function * getBattery() {
  const batStatus = (yield fs.readFile(BATTERY_STATUS_PATH, 'utf-8')).trim().toLowerCase();
  const batFull   = parseInt(yield fs.readFile(BATTERY_FULL_PATH, 'utf-8'), 10);
  const batNow    = parseInt(yield fs.readFile(BATTERY_NOW_PATH, 'utf-8'), 10);

  let val = 100 * batNow / batFull;

  if (val > 100) {
    val = 100;
  } else if (val < 0) {
    val = 0;
  }

  let icon  = ICON_BAT_FULL;
  let colorBg = colorBatFullBg;
  let colorFg = colorBatFullFg;

  switch (batStatus) {
    case 'full': break;

    case 'discharging':
      icon = ' ';

      if (val > 50) {
        colorBg = colorBatDischargingHighBg;
        colorFg = colorBatDischargingHighFg;
        break;
      }

      if (val > 20) {
        colorBg = colorBatDischargingMedBg;
        colorFg = colorBatDischargingMedFg;
        break;
      }

      icon  = ICON_BAT_EMPTY;
      colorBg = colorBatDischargingLowBg;
      colorFg = colorBatDischargingLowFg;
      break;

    case 'charging':
      colorBg = colorBatChargingBg;
      colorFg = colorBatChargingFg;
      break;
  }

  const strVal = val === 100
               ? '' + val
               : val >= 10
               ? ' ' + val
               : '  ' + val;

  const defaultPart0 = '⏹';
  const defaultPart1 = ' ';
  const defaultPart2 = icon;
  const defaultPart3 = strVal[0];
  const defaultPart4 = strVal[1];
  const defaultPart5 = strVal[2];
  const defaultPart6 = '%';
  const defaultPart7 = ' ';

  let p0 = colorSpecBG(colorFg(defaultPart0));
  let p1 = colorBg(defaultPart1);
  let p2 = colorBg(defaultPart2);
  let p3 = colorBg(defaultPart3);
  let p4 = colorBg(defaultPart4);
  let p5 = colorBg(defaultPart5);
  let p6 = colorBg(defaultPart6);
  let p7 = colorBg(defaultPart7);

  if (val < 95) { p0 = colorSpecBG(colorBatEmptyFg(defaultPart0)); }
  if (val < 80) { p1 = colorBatEmptyBg(defaultPart1); }
  if (val < 70) { p2 = colorBatEmptyBg(defaultPart2); }
  if (val < 60) { p3 = colorBatEmptyBg(defaultPart3); }
  if (val < 50) { p4 = colorBatEmptyBg(defaultPart4); }
  if (val < 40) { p5 = colorBatEmptyBg(defaultPart5); }
  if (val < 20) { p6 = colorBatEmptyBg(defaultPart6); }
  if (val < 10) { p7 = colorBatEmptyBg(defaultPart7); }

  return p0 + p1 + p2 + p3 + p4 + p5 + p6 + p7;
});

const getCPU = co.wrap(function * getCPU() {
  const procStat = yield fs.readFile('/proc/stat', 'utf-8');

  const matches = procStat.match(/cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
  if (matches === null) {
    throw new Error('Cannot detect CPU');
  }

  const cpu = (parseInt(matches[1], 10) + parseInt(matches[3], 10)) * 100
            / (parseInt(matches[1], 10) + parseInt(matches[3], 10) + parseInt(matches[4], 10));

  return ICON_CPU + ': ' + colorMainFG(cpu.toFixed(0), 'bold') + '%';
});

const getRAM = co.wrap(function * getRAM() {
  const { stdout: free } = yield execa('free');

  const matches = free.match(/Mem:\s*(\d+)\s+(\d+)/);
  if (matches === null) {
    throw new Error('Cannot detect RAM');
  }

  const ram = parseInt(matches[2], 10) / parseInt(matches[1], 10) * 100;

  return ICON_RAM + ': ' + colorMainFG(ram.toFixed(0), 'bold') + '%';
});

const getClock = co.wrap(function * getClock() {
  return moment().format('DD/MM HH:mm:ss');
});

const getHostname = co.wrap(function * getHostname() {
  const { stdout: hostname } = yield execa('hostname');

  return colorHostname(hostname);
});

let temperature = '';
let cpu = '';
let ram = '';
let clock = '';
let battery = '';
let hostname = '';
const update = co.wrap(function * update() {
  temperature = yield getTemperature();
  cpu = yield getCPU();
  ram = yield getRAM();
  clock = yield getClock();
  battery = hasBattery
          ? yield getBattery()
          : '';
  hostname = yield getHostname();
});

const tick = () => {
  update()
    .then(() => setTimeout(tick, 1000).unref())
    .catch((err) => {
      console.error(err.stack);
      process.exit(1);
    });
};

tick();

const getStatusRight = (whoami) => {
  let res = ' ';
  res += colorWhoami(whoami) + '@' + hostname + ' ' + COLUMN;

  if (hasBattery) {
    res += battery + COLUMN + ' ';
  }

  res += cpu + ' ';
  res += ram + ' ';
  res += temperature + ' ' + COLUMN + ' ';
  res += clock + ' ';

  return colorMainBG(colorMainFG(res));
};
