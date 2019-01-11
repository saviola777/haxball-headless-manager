/**
 * Config module.
 *
 * If the config has not yet been loaded, display a form where the user can
 * upload or specify a config location.
 */

const form = require(`./form`);
const util = require(`../util`);
const ui = require(`./index`);

/**
 * Default postInit code, will set the FM 4v4 fs settings.
 */
const configManualDefaultPostInitCode = `
let room = HBInit();
room.setDefaultStadium(\`Big\`);
room.setScoreLimit(0);
room.setTimeLimit(7);
`;

/**
 * Form for configuration file upload.
 */
const configFormFileUpload = {
  view: `form`, id: `hhm-config-form-file`, elements: [
    {
      view: `fieldset`, label: `Upload file`, body: {
        rows: [
          {
            view: `uploader`,
            id: `hhm-config-file`, name: `hhm-config-file`,
            value: `Choose file`,
            multiple: false,
            link: `hhm-config-file-list`,
            autosend: false
          },
          { view: `list`, id: `hhm-config-file-list`, type: `uploader`,
            autoheight: true, borderless: true },
          { view: `button`, id: `hhm-config-submit-file`, type: `form`,
            label: `Load config from uploaded file`, click: loadFromFile },
        ]
      }
    }
  ]
};

/**
 * Form for loading a configuration file from a URL.
 */
const configFormUrl = {
  view: `form`, id: `hhm-config-form-url`, elements: [
    {
      view: `fieldset`, label: `Load from URL`, body: {
        rows: [
          { view: `text`, id: `hhm-config-url`, placeholder: `HHM config URL`,
            value: HHM.defaultConfigUrl},
          { view: `button`, id: `hhm-config-submit-url`, type: `form`,
            label: `Load`, click: loadFromUrl },
        ]
      }
    }
  ]
};

/**
 * Form for manually configuring HHM and the room.
 */
const configFormManual = {
  view: `form`, id: `hhm-config-form-manual`, elements: [
    { cols: [
        { view: `text`, id: `hhm-config-form-manual-roomName`, name: `roomName`,
          label: `Room name:`, labelWidth: 100, value: `HHM room`},
        { view: `text`, id: `hhm-config-manual-playerName`, name: `playerName`,
          labelWidth: 160, label: `Host player name:`, value: `HHM`},
      ]
    },
    { cols: [
        { view: `text`, id: `hhm-config-manual-password`, name: `password`,
          label: `Password:`, labelWidth: 100,
          placeholder: `Leave empty to disable password`},
        { view: `text`, id: `hhm-config-manual-maxPlayers`, name: `maxPlayers`,
          label: `Maximum players`, labelWidth: 160, value: `16`},
      ]
    },
    { cols: [
        { view: `checkbox`, id: `hhm-config-manual-public`, name: `public`,
          label: `Public:`, labelWidth: 100, value: 0 },
        { view: `checkbox`, id: `hhm-config-manual-dryRun`, name: `dryRun`,
          label: `Dry run (debug):`, labelWidth: 160, value: 0 },
      ]
    },

    { view: `fieldset`, label: `Geo settings`, body: {
        rows: [
          { cols: [
              { view: `text`, id: `hhm-config-manual-geoCode`, name: `geoCode`,
                label: `Code:`, value: `FI` },
              { view: `text`, id: `hhm-config-manual-geoLat`, name: `geoLat`,
                label: `Latitude:`, value: `60.192059` },
              { view: `text`, id: `hhm-config-manual-geoLon`, name: `geoLon`,
                label: `Longitude:`, value: `24.945831` },
            ]
          }
        ]
      }
    },
    {
      view: `fieldset`, label: `Code`, body: {
        rows: [
          { view: `textarea`, id: `hhm-config-manual-postInitCode`,
            name: `postInitCode`,
            label: `Code to be executed after initialization`,
            labelPosition: `top`, height: 300,
            value: configManualDefaultPostInitCode }
        ]
      }
    },
    { view: `button`, id: `hhm-config-submit-manual`, type: `form`,
      label: `Load`, click: loadManual },
  ]
};

/**
 * Configuration form tabview.
 */
const configForm = {
  container: `hhm-config-form-container`,
  rows:[
    { type: `header`, template: `Load HHM config`},
    { view: `tabview`, cells: [
        { header: `Upload file`, body: configFormFileUpload },
        { header: `Load from URL`, collapsed: true, body: configFormUrl },
        { header: `Manual configuration`, collapsed: true, body: configFormManual },
      ]
    }
  ]
};

/**
 * Configuration form container.
 */
const configFormContainer = `<div id="hhm-config-form-container"></div>`;

/**
 * Creates and shows the configuration form.
 */
function createForm() {
  ui.initialize();

  const $html = $(configFormContainer);

  $(`#hhm-config-container`).append($html);

  webix.ui(configForm);

  ui.setHhmConfigAndIframeVisibility(true);
}

/**
 * Loads the HHM config from an uploaded file.
 */
async function loadFromFile() {

  const result = await form.loadFileContent($$(`hhm-config-file`));

  try {
    // Indirect eval in global scope
    eval.call(null, result);
  } catch (e) {
    alert(`Unable to load config: ${e.message}`);
    return;
  }

  if (!HHM.hasOwnProperty(`config`)) {
    alert(`Unable to load config: Config not initialized by uploaded file`);
    return;
  }

  HHM.deferreds.configLoaded.resolve();
}

/**
 * Loads the HHM config from a specified URL.
 */
function loadFromUrl() {

  // Load config and hide form
  util.loadScript($$(`hhm-config-url`).getValue(),
      () => HHM.deferreds.configLoaded.resolve());
}

/**
 * Initializes the HHM config from the manual configuration form.
 */
function loadManual() {
  const $$form = $$(`hhm-config-form-manual`);

  const config = {
    room: {
      roomName: $$form.elements.roomName.getValue(),
      playerName: $$form.elements.playerName.getValue(),
      maxPlayers: parseInt($$form.elements.maxPlayers.getValue()) || 16,
      public: Boolean($$form.elements.public.getValue()),
      geo: {
        code: $$form.elements.geoCode.getValue(),
        lat: parseFloat($$form.elements.geoLat.getValue()) || 60.192059,
        lon: parseFloat($$form.elements.geoLon.getValue()) || 24.945831,
      }
    },
    dryRun: Boolean($$form.elements.dryRun.getValue()),
    repositories: [
      {
        url: `https://haxplugins.tk/plugins/`,
      }
    ]
  };

  if ($$form.elements.password.getValue() !== ``) {
    config.room.password = $$form.elements.password.getValue();
  }

  if ($$form.elements.postInitCode.getValue() !== ``) {
    config.postInit = $$form.elements.postInitCode.getValue();
  }

  HHM.config = config;

  HHM.deferreds.configLoaded.resolve();
}

/**
 * Makes sure a HHM config is available.
 *
 * Creates the deferred HHM.deferreds.configLoaded which is resolved if and when
 * a configuration is available. If a config was loaded prior to calling this
 * function, it will immediately resolve the deferred.
 *
 * @returns {Promise} Promise that is resolved after the configuration becomes
 *  available.
 */
module.exports.provideConfig = function() {
  let deferred = new $.Deferred();
  HHM.deferreds.configLoaded = deferred;

  $(`iframe`).removeAttr(`style`);

  // Only create config form if config was not yet loaded
  if (!module.exports.isLoaded()) {
    util.loadScript(`https://cdn.webix.com/edge/webix.js`, createForm);
  } else {
    if (!HHM.config.trueHeadless) {
      util.loadScript(`https://cdn.webix.com/edge/webix.js`,
          () => {
            ui.initialize();
            deferred.resolve()
          });
    } else {
      deferred.resolve();
    }
  }

  return deferred.promise()
    .then(() => ui.setHhmConfigAndIframeVisibility(false))
    .then(() => $(`#hhm-config-container`).remove());
};

/**
 * Checks if a configuration is available.
 *
 * A configuration is loaded if the HHM.config global has been set.
 *
 * @returns {boolean} Whether config has been loaded.
 */
module.exports.isLoaded = function() {
  return !(HHM.config === undefined);
};