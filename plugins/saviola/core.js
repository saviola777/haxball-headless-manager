/**
 * Meta plugin for loading a set of basic plugins.
 */

const room = HBInit();

room.pluginSpec = {
  name: `saviola/core`,
  author: `saviola`,
  version: `1.0.0`,
  dependencies: [
    `saviola/commands`,
    `saviola/cron`,
    `saviola/help`,
    `saviola/players-helper`,
    `saviola/roles`,
  ],
};