"use strict";

global.HHM = global.HHM || {};
global.HHM.version = `0.7.3-git`;
global.HHM.defaultConfigUrl = `https://haxplugins.tk/config/default.js`;
global.$ = global.jQuery = require(`jquery-browserify`);
jQuery.ajaxPrefilter(function(options) {
  if (options.crossDomain && jQuery.support.cors) {
    options.url = 'https://haxplugins.tk/proxy/'
        + removeUrlProtocolWorkaround(options.url);
  }
});

// TODO remove once no longer needed
function removeUrlProtocolWorkaround(url) {
  if (url.startsWith(`http://`)) {
    url = url.substr(7).replace(`/`, ':80/');
  } else if (url.startsWith(`https://`)) {
    url = url.substr(8);
  }

  return url;
}

global.HHM.log = $.extend(require(`./src/log`)().getLogger(`plugins`), {
  toRoom: (message, level) => {
    if (typeof level === `undefined`) {
      level = `info`;
    }

    if (HHM.log.hasOwnProperty(level)) {
      HHM.log[level](message);
    }

    if (this.hasOwnProperty(`room`)) {
      this.room.sendChat(`[${level}] ${message}`);
    }
  },

  setRoom: (room) => {
    this.room = room;
  }
});

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