"use strict";

global.$ = global.jQuery =
    typeof $ === `undefined` ? require(`jquery`) : $;

require(`./src/namespace`).populate();

if (typeof Storage !== `undefined`) {
  HHM.storage = HHM.storage || require(`./src/storage`);
}

// Create plugin manager
HHM.manager = new HHM.classes.PluginManager();

HHM.deferreds.managerStarted = new $.Deferred();
HHM.deferreds.roomLink = new $.Deferred();

// Provides the config, waits for captcha solution and starts the plugin
// manager
HHM.manager.start();