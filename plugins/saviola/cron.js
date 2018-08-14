/**
 * A simple, convenient cronjob plugin.
 *
 * Supports setting up game and real time cron job based on seconds, minutes,
 * and hours. For more frequent jobs simply use onGameTick oder set up your own
 * setInterval cronjob.
 *
 * Cronjobs will automatically be picked up, polling is done every 10 seconds to
 * see if new cronjobs were added.
 *
 * Available handlers:
 *
 * - onCronXXSeconds / onCronXXGameSeconds
 * - onCronXXMinutes / onCronXXGameMinutes
 * - onCronXXHours / onCronXXGameHours
 *
 * Insert any number for XX, it can have more than two digits. There are no
 * singular version of the units, so always use Seconds, Minutes or
 * Hours (uppercase).
 *
 * Usage:
 *
 * Simply add `saviola/cron` to your dependencies, then start registering cronjobs:
 *
 * room.onCron10GameSeconds = () => room.sendChat("10 ingame seconds have passed");
 * room.onCron10Minutes = () => room.sendChat("10 minutes have passed");
 *
 * Configuration:
 *
 * - gameTicks: Cronjob scheduling will be checked after every X game ticks.
 *  Setting this lower than 60 makes little sense since cronjobs can't be
 *  scheduled more often than once per second. Keeping this a multiple of 60 is
 *  recommended but not required.
 *
 *  TODO keep track of and remove unused intervals
 *  TODO add support for cron jobs that are only executed once
 */

const room = HBInit();

room.pluginSpec = {
  name: `saviola/cron`,
  author: `saviola`,
  version: `1.0.0`,
  config: {
    gameTicks: 60,
  }
};

const units = {
  Seconds: 1,
  Minutes: 60,
  Hours: 60*60,
};

const gameTickCronJobs = {};
const realTimeCronJobs = [];
let gameTicks = 60;

function createGameTimeCronJob(event, unit) {
  const time = parseInt(event.substr(4, event.length - 8 - unit.length));

  if (isNaN(time) || time <= 0) return;

  const numTicks = time * units[unit] * 60;

  let tickCounter = 1;

  gameTickCronJobs[event] = function() {
    if (tickCounter === 0) {
      room.triggerEvent(event);
    }

    tickCounter = Math.min(tickCounter + gameTicks, numTicks) % numTicks;
  };
}

function createCronJob(event, unit) {
  const time = parseInt(event.substr(4, event.length - 4 - unit.length));

  if (isNaN(time)) return;

  const numSeconds = time * units[unit];

  realTimeCronJobs.push(event);

  setInterval(() => room.triggerEvent(event), numSeconds * 1000);
}

function setupCronJobs() {
  gameTicks = room.pluginSpec.config.gameTicks;
  const handlerNames = room.getHandlerNames();

  for (let handlerName of handlerNames) {
    if (!handlerName.startsWith(`onCron`)) continue;

    let gameTickCronJob;
    let event = handlerName.substr(2);

    // Skip existing cron jobs
    if (realTimeCronJobs.indexOf(event) !== -1
        || Object.getOwnPropertyNames(gameTickCronJobs).indexOf(event) !== -1) {
      continue;
    }

    for (let unit of Object.getOwnPropertyNames(units)) {
      gameTickCronJob = false;
      if (!handlerName.endsWith(unit)) continue;

      if (handlerName.endsWith(`Game${unit}`)) {
        createGameTimeCronJob(event, unit);
        break;
      }

      createCronJob(event, unit);
    }
  }
}

let globalTickCount = 0;
room.onGameTick = function() {
  if (globalTickCount === 0) {
    gameTicks = room.pluginSpec.config.gameTicks;
    for (let event of Object.getOwnPropertyNames(gameTickCronJobs)) {
      gameTickCronJobs[event]();
    }
  }

  globalTickCount = Math.min(globalTickCount + 1, gameTicks) % gameTicks;
};

// Set up our own cron job to find and setup new cron jobs
room.onCron10Seconds = setupCronJobs;


// Trigger cron job setup once so that above job is picked up
// TODO this is a bit arbitrary?
setTimeout(setupCronJobs, 10000);