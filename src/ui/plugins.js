/**
 * UI modules which displays loaded plugins, allows plugins to be loaded and
 * disabled, and displays plugin-specific UIs.
 */

const form = require(`./form`);
const ui = require(`./index`);

/**
 * Tabview for adding new plugins.
 */
const addPluginFormView = {
  view: `tabview`,
  cells: [
    {
      header: `Paste plugin script`, view: `form`, id: `code-plugin-form`,
      elements: [
        { view: `text`, name: `code-plugin-name`, label: `Plugin name:`,
          labelWidth: 200,
          placeholder: `Optional, may be auto-detected from plugin script` },
        { view: `textarea`,
          name: `code-plugin-text`,
          label: `Plugin script`,
          labelPosition: `top`, height: 400, },
        { view: `button`, type: `form`, name: `code-plugin-button`,
          label: `Load plugin from code` },
      ]
    },
    {
      header: `Load from repository`, view: `form`, id: `repository-plugin-form`,
      elements: [
        { view: `text`, name: `repository-plugin-name`, label: `Plugin name:`,
          labelWidth: 200, placeholder: `e.g. author/pluginName` },
        { view: `button`, type: `form`, name: `repository-plugin-button`,
          label: `Load plugin from repository` },
      ]
    },
    {
      header: `Upload plugin`, view: `form`, id: `upload-plugin-form`,
      elements: [
        { view: `text`, name: `upload-plugin-name`, label: `Plugin name:`,
          labelWidth: 200,
          placeholder: `Optional, may be auto-detected from plugin script` },
        {
          view: `uploader`,
          name: `upload-file`,
          value: `Choose file`,
          multiple: false,
          link: `upload-plugin-file-list`,
          autosend: false
        },
        { view: `list`, id: `upload-plugin-file-list`, isolate: true, type: `uploader`,
          autoheight: true, borderless: true },
        { view: `button`, type: `form`, name: `upload-plugin-button`,
          label: `Load plugin from uploaded file` },
      ]
    },

  ]
};

/**
 * Templates for the button used to toggle plugin state.
 */
const pluginTableViewToggleDisabledButtonTemplate = `
    <span class="webix_icon fa-power-off #toggleDisabledColor#" data-class="toggleDisabled"
        title="#toggleDisabledTitle#" data-id="#id#"></span>
`;

/**
 * Table view for displaying plugin information.
 */
const pluginTableView = {
  id: `hhm-plugins-tab-main-pluginTable`,
  view: `datatable`,
  columns: [
    { id: `name`, header: [`Name`, { content: `textFilter` }], adjust: `data`,
      fillspace: true},
    { id: `author`, header: `Author`},
    { id: `version`, header: `Version`},
    { id: `actions`, header: `Actions`,
      template: pluginTableViewToggleDisabledButtonTemplate, css: `button` },
  ]
};

/**
 * View for the plugins tab, displaying a table of plugin information.
 */
const pluginsTabView = {
  id: `hhm-plugins-tab-main`,
  rows: [
    pluginTableView,
    {
      id: `hhm-plugins-tab-main-button-addPlugin`, view: `button`,
      value: `Add plugin`, type: `form`, align: `right`, inputWidth: 150,
      click: createOrShowAddPluginView
    }
  ]
};

/**
 * Creates or shows the add plugin view.
 */
function createOrShowAddPluginView() {
  const $$tabview = $$(`hhm-tabview`);

  // Create and/or attach view if necessary
  if ($$(`hhm-plugins-tab-new-plugin`) === undefined) {
    $$tabview.addView({
      header: `New plugin`,
      body: { id: `hhm-plugins-tab-new-plugin`, rows: [
          // Deep copy
          JSON.parse(JSON.stringify(addPluginFormView)),
          { view: `button`, click: closeAddPluginView,
            value: `Cancel`, type: `danger`, align: `right`, inputWidth: 150 }
        ]
      },
    });

    // Attach button click handlers
    $$(`code-plugin-form`).elements[`code-plugin-button`]
      .attachEvent('onItemClick', loadFromCode);
    $$(`upload-plugin-form`).elements[`upload-plugin-button`]
      .attachEvent('onItemClick', loadFromFile);
    $$(`repository-plugin-form`).elements[`repository-plugin-button`]
      .attachEvent('onItemClick', loadFromRepository);
  }
  $$(`hhm-tabview`).setValue(`hhm-plugins-tab-new-plugin`);
}

/**
 * Loads a plugin from an uploaded file.
 */
async function loadFromFile() {
  const code = await form.loadFileContent(
      $$(`upload-plugin-form`).elements[`upload-file`]);
  const name = $$(`upload-plugin-form`).elements[`upload-plugin-name`].getValue();

  await loadPlugin(code, name) ? closeAddPluginView() : {};
}

/**
 * Loads a plugin from pasted code.
 */
async function loadFromCode() {
  const code = $$(`code-plugin-form`).elements[`code-plugin-text`].getValue();
  const name = $$(`code-plugin-form`).elements[`code-plugin-name`].getValue();

  await loadPlugin(code, name) ? closeAddPluginView() : {};
}

/**
 * Loads a plugin from the given code and name.
 */
async function loadPlugin(code, name) {
  if (code === undefined || code === ``) {
    alert(`Unable to load plugin: no or invalid plugin code provided`);
    return false;
  }

  const pluginId = await HHM.manager.addPluginByCode(code);

  if (pluginId < 0) {
    alert(`Unable to load plugin, see dev console for more info`);
    return false;
  }

  const pluginRoom = HHM.manager.getPluginById(pluginId);

  if (name !== `` &&
      (!pluginRoom.hasOwnProperty(`pluginSpec`)
          || !pluginRoom.pluginSpec.hasOwnProperty(`name`))) {
    pluginRoom.pluginSpec = $.extend(pluginRoom.pluginSpec || {}, { name: name});
  }

  return true;
}

/**
 * Loads a plugin from a repository.
 */
async function loadFromRepository() {
  const pluginName = $$(`repository-plugin-form`)
      .elements[`repository-plugin-name`].getValue();

  if (pluginName === ``) {
    alert(`Unable to load plugin: No plugin name provided`);
    return;
  }

  try {
    let pluginId = await HHM.manager.addPluginByName(pluginName);

    if (pluginId < 0) {
      alert(`Unable to load plugin, not available in configured repositories?
            (see dev console for further info)`);
      return;
    }

    closeAddPluginView();
  } catch (e) {
    alert(`Unable to load plugin: ${e.message} (see dev console for further info)`);
  }
}

/**
 * Closes (removes) the add plugin view.
 */
function closeAddPluginView() {
  if (typeof $$(`hhm-plugins-tab-new-plugin`) !== `undefined`) {
    $$(`hhm-tabview`).setValue(`hhm-plugins-tab-main`);
    $$(`hhm-tabview`).removeView(`hhm-plugins-tab-new-plugin`);
  }
}

/**
 * Called when the plugin manager reports changes (e.g. new plugins, plugins
 * disabled etc.).
 */
module.exports.updatePluginView = function() {
  $$table = $$(`hhm-plugins-tab-main-pluginTable`);

  // Do nothing if the plugin table doesn't exist yet
  if ($$table === undefined) {
    return;
  }

  $$table.clearAll();

  const plugins = HHM.manager.room._plugins;

  let name, author, version, buttonId, enabled;
  for (let id of Object.getOwnPropertyNames(plugins)) {
    name = plugins[id]._name || plugins[id]._id;
    author = plugins[id].getPluginSpec().author || `n/a`;
    version = plugins[id].getPluginSpec().version || `n/a`;
    enabled = HHM.manager.isPluginEnabled(id);

    $$table.add({
      id: id,
      name: name,
      author: author,
      version: version,
      toggleDisabledTitle: enabled ? `Disable plugin` : `Enable plugin`,
      toggleDisabledColor: enabled ? `green` : `red`,
    });
  }

  // Attach button click event handler
  $(`[data-class*=toggleDisabled]`).click(function() {
    const id = $(this).attr(`data-id`);
    const name = HHM.manager.getPluginName(id);
    const enabled = HHM.manager.isPluginEnabled(id);

    if (enabled) {
      if (!HHM.manager.disablePluginById(id)) {
        alert(`Could not disable plugin ${name}, because other plugins `
            + `depend on it`);
      }
    } else {
      HHM.manager.enablePluginById(id);
    }
  });
};

/**
 * Initialize the plugin view.
 */
module.exports.initialize = function() {
  $$(`hhm-tabview`).addView({
    header: `Plugins`,
    body: pluginsTabView,
  },);

  ui.registerViewChangeHandler(module.exports.updatePluginView);

  HHM.manager.registerObserver({ update: () => module.exports.updatePluginView()});
  module.exports.updatePluginView();
};

