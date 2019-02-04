"use strict";

global.$ = global.jQuery =
    typeof $ === `undefined` ? require(`jquery-browserify`) : $;

require(`./src/namespace`).populate();

require(`./src/ajax`).applyProtocolWorkaround();

// Inject CSS file
require(`./src/css`).injectCss();

HHM.ui = require('./src/ui/index');

// Create plugin manager
HHM.manager = new HHM.classes.PluginManager();

HHM.deferreds.managerStarted = new $.Deferred();
HHM.deferreds.roomLink = new $.Deferred();

// Provides the config, waits for captcha solution and starts the plugin
// manager
let room = {};
require(`./src/ui/config`).provideConfig()
  .then(() => room = HHM.manager.provideRoom())
  .then(() => HHM.manager.start(room))
  .then(() => HHM.deferreds.managerStarted.promise())
  .then(() => HHM.config.dryRun ? true : HHM.deferreds.roomLink.promise())
  .then(() => HHM.ui.setHhmConfigAndIframeVisibility(true))
  .then(() => HHM.config.trueHeadless ? true
    : require(`./src/ui/plugins`).initialize());