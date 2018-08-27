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
 *
 * Changelog:
 *
 * 1.1.0:
 * - add support for one-time cron jobs
 * - new jobs are picked up via observer pattern
 *
 * 1.0.0:
 * - initial version, support for game and real time cron jobs
 * - new jobs are picked up via polling
 *
 *  TODO keep track of and remove unused intervals
 */

const room = HBInit();

room.pluginSpec = {
  name: `saviola/cron`,
  author: `saviola`,
  version: `1.1.0`,
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

function createOneTimeCronJob(event, unit, pluginId) {
  const time = parseInt(event.substr(4, event.length - 4 - unit.length));

  if (isNaN(time)) return;

  const numSeconds = time * units[unit];

  const plugin = room.getManager().getPluginById(pluginId);
  const propertyName = `on${event}Once`;

  const fn = plugin[propertyName];
  delete plugin[propertyName];

  setTimeout(() => {
    // Either execute or re-queue function
    if (room.getManager().isPluginEnabled(pluginId)) {
      fn();
    } else {
      plugin[propertyName] = fn;
    }
  }, numSeconds * 1000);
}

function setupCronJobs() {
  gameTicks = room.pluginSpec.config.gameTicks;
  let eventNames = room.getManager().getHandlerNames()
    .filter(h => h.startsWith(`onCron`))
    .map(h => h.substr(2));

  for (let eventName of eventNames) {
    // Skip existing cron jobs
    if (realTimeCronJobs.indexOf(eventName) !== -1
        || Object.getOwnPropertyNames(gameTickCronJobs).indexOf(eventName)
        !== -1) {
      continue;
    }

    for (let unit of Object.getOwnPropertyNames(units)) {
      if (!eventName.endsWith(unit)) continue;

      if (eventName.endsWith(`Game${unit}`)) {
        createGameTimeCronJob(eventName, unit);
        break;
      }

      createCronJob(eventName, unit);
      break;
    }
  }

  // Handle one time cron jobs
  for (let plugin of room.getManager().getEnabledPluginIds()
    .map(id => room.getManager().getPluginById(id))) {

    eventNames = plugin.getHandlerNames()
      .filter(h => h.startsWith(`onCron`) && h.endsWith(`Once`))
      .map(h => h.substr(2, h.length - 6))
      .filter(h => Object.getOwnPropertyNames(units)
        .filter(u => { return h.endsWith(u) }).length === 1);

    if (eventNames.length === 0) {
      continue;
    }

    eventNames
      .map(e => createOneTimeCronJob(e, Object.getOwnPropertyNames(units)
        .filter(u => {return e.endsWith(u) })[0], plugin._id));
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

/**
 * Pick up initial cron jobs and register as room manager observer to pick up
 * future cron jobs immediately.
 */
room.onLoad = () => {
  room.getManager().getRoomManager().registerObserver(
      { update: () => setupCronJobs() });
  setupCronJobs();
};