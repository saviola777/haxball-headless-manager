"use strict";

global.HHM = global.HHM || {};
global.HHM.version = `0.7.1-git`;
global.HHM.log = require(`./src/log`)().getLogger(`plugins`);
global.$ = require(`jquery-browserify`);

// Stores global deferreds
global.HHM.deferreds = {};

// Inject CSS file
require(`./src/css`).injectCss();

const ui = require('./src/ui/index');

// Create plugin manager
const PluginManager = require(`./src/PluginManager`);
global.HHM.manager = new PluginManager();

// Provides the config, waits for captcha solution and starts the plugin
// manager
let room = {};
require(`./src/ui/config`).provideConfig()
  .then(() => room = HHM.manager.provideRoom())
  .then(() => HHM.config.dryRun ? ui.setHhmConfigAndIframeVisibility(true)
    : ui.waitForCaptchaResolution())
  .then(() => HHM.manager.start(room))
  .then(() => HHM.config.trueHeadless ? true
    : require(`./src/ui/plugins`).initialize());