"use strict";

global.$ = global.jQuery = require(`jquery-browserify`);
require(`./src/namespace`).populate();

require(`./src/ajax`).applyProtocolWorkaround();

// Inject CSS file
require(`./src/css`).injectCss();

const ui = require('./src/ui/index');

// Create plugin manager
global.HHM.manager = new HHM.classes.PluginManager();

// Provides the config, waits for captcha solution and starts the plugin
// manager
// TODO switch to room.onRoomLink
let room = {};
require(`./src/ui/config`).provideConfig()
  .then(() => room = HHM.manager.provideRoom())
  .then(() => HHM.config.dryRun ? ui.setHhmConfigAndIframeVisibility(true)
    : ui.waitForCaptchaResolution())
  .then(() => HHM.manager.start(room))
  .then(() => HHM.config.trueHeadless ? true
    : require(`./src/ui/plugins`).initialize());