/**
 * This is the default HHM config. If you are using haxroomie, please consider
 * using one of the configurations provided by the haxroomie project, this
 * configuration will _not_ work with haxroomie.
 */

// Do not edit this block unless you know what you are doing

HHM = typeof HHM === `undefined` ? {} : HHM;
HHM.config = HHM.config || {};

// Start editing here

/**
 * Choose your HHM version here, by default it points to the latest stable
 * version.
 *
 * Possible values:
 *
 * - 'X.X.X': stable version
 * - 'latest': always the latest stable version
 * - 'git': some recent git build, likely to be broken
 *
 * This value is only taken into account if the HHM has not yet been loaded
 * when this config is loaded.
 */
HHM.config.version = `1.0.0`;

/**
 * Include your room config here (the object that will be passed to HBInit).
 *
 * If set to false, you will have to call PluginManager#start manually with a
 * room instance to start the plugin system.
 */
HHM.config.room = {
  roomName: `haxroomie`,
  playerName : `host`,
  maxPlayers: 16,
  noPlayer: true,
  public : false,
  password: ``,
  geo: { code: `FI`, lat: 60.192059, lon: 24.945831 },
  token: `insert your token here`
};

/**
 * This function is executed after the plugin system was loaded and the room has
 * been started.
 *
 * Can be used to set initial room parameters or add custom event handlers.
 *
 * It is parsed like any other plugin, so it can have a plugin specification
 * with dependencies etc, or it can be a vanilla headless script.
 *
 * You can also pass the code as a string instead of a function.
 */
HHM.config.postInit = HBInit => {
  var room = HBInit();

  room.onRoomLink = () => {
    // Put your changes here
    room.setDefaultStadium(`Big`);
    room.setScoreLimit(0);
    room.setTimeLimit(7);
  }
};

/**
 * This is the heart of the HHM config: a collection of plugins to load and
 * their corresponding configurations.
 *
 * The properties of this object should be plugin names, the values should be
 * configuration objects or an empty object if you want to use the default
 * configuration.
 */
HHM.config.plugins = {
  'sav/roles': {
    roles: {
      'host': `hostpass CHANGE ME`,
      'admin': 'adminpass CHANGE ME'
    },
  },
  'sav/core': {},
  'sav/plugin-control': {},
  'hr/spam': {},
};

/**
 * List of plugin repositories.
 *
 * When resolving plugin dependencies, the plugin manager will try to find a
 * JS file with the name of the plugin under each of these URLs. It will load
 * the first one it finds. Must include trailing slash if you want to directly
 * load JS files (as opposed to use a PHP script to serve the plugins, for
 * example).
 *
 * Each entry can either be a URL or an object containing the following
 * base properties:
 *
 *  - type: string identifying the repository type, default is 'plain'. See
 *    below for possible values
 *  - suffix: string that will be appended to the plugin name (optional,
 *    defaults to `.js`), may be ignored depending on the repository type
 *
 * Additionally, each repository type can define further properties. The
 * possible repository types are:
 *
 *  - plain: plain HTTP(s) repository. Additional properties:
 *    - url: base URL for the repository
 *  - local: local repository. Additional properties:
 *    - plugins: mapping of plugin name to plugin code (string or function)
 *  - github: GitHub repository. Plugins must be organized like
 *    /${path}/auth/plugin-name.js in the repository. Additional
 *    properties:
 *    - repository: GitHub repository identifier, i.e. username/repoName
 *    - version: commit, tag, or branch within the repository, defaults to
 *      `master`
 *    - path: path to the repository root within the GitHub repository, no
 *      leading slash (optional, defaults to `src`)
 *
 * Plugins are loaded as text via $.ajax and then executed in a
 * new Function() context that receives a HBInit function, which can be used to
 * get a room instance like in a vanilla headless script.
 */
HHM.config.repositories = [
  {
    type: `github`,
    repository: `saviola777/hhm-plugins`
  },
  {
    type: `github`,
    repository: `morko/hhm-sala-plugins`,
  },
];

/**
 * Log level for HHM, change this if you want more or less output.
 *
 * One of: trace, debug, info, warn, error, silent
 */
HHM.config.logLevel = `info`;

// Do not edit anything after this

// Load HHM if it has not already been loaded
if (HHM.manager === undefined) {
  let s = document.createElement(`script`);
  s.src = `https://hhm.surge.sh/releases/hhm-${HHM.config.version}.js`;
  document.head.appendChild(s);
}