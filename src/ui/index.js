/**
 * UI module which contains functions pertaining to the HHM UI.
 */

/**
 * HHM main and config container. The config container will be removed once
 * the config has been loaded.
 */
const hhmContainer =
    `<div id="hhm-main-container" class="hhm-container hidden"></div>
     <div id="hhm-config-container" class="hhm-container hidden"></div>`;

/**
 * Main HHM tab view.
 *
 * Initially contains a room info tab.
 */
const tabview = {
  id: `hhm-tabview`,
  autoheight: true,
  minHeight: 600,
  view: `tabview`,
  multiview: {
    keepViews: true,
    on: {
      'onViewChange': () => viewChangeHandler(),
    }
  },
  cells: [
    {
      header: `Room info`,
      body: {
        id: `hhm-tab-roomInfo`,
        rows: [],
      },
    },
  ]
};

const hhmView = {
  id: `hhm-mainView`,
  container: `hhm-main-container`,
  rows: [
    {
      type: `header`,
      template: `Haxball Headless Manager version ${HHM.version}`,
    },
    tabview,
  ]

};

/**
 * Displays the room link from the iframe in the room info tab.
 */
function displayRoomLinkInHhmContainer() {
  const roomLink = module.exports.getRoomLink();

  $$(`hhm-tab-roomInfo`).addView({
    autoheight: true,
    view: `layout`,
    rows: [
      { view: `template`, template: `Room Link`, type: `header` },
      { view: `template`, template: `<a href="${roomLink}">${roomLink}</a>`}
    ]
  });
}

/**
 * Initializes the UI by adding the HHM containers and the main tabview.
 */
module.exports.initialize = function() {
  // If webix is not loaded then skip UI initialization
  if (typeof webix === `undefined`) {
    return;
  }

  $(`body`).append($(hhmContainer));

  webix.ui(hhmView);

  module.exports.setHhmConfigAndIframeVisibility(false);
};

/**
 * Toggles the visibility of both the HHM config container and the headless iframe.
 */
module.exports.setHhmConfigAndIframeVisibility = function(hhmVisible) {
  if (hhmVisible) {
    $(`#hhm-config-container`).removeClass(`hidden`);
    $(`iframe`).addClass(`hidden`);
  } else {
    $(`#hhm-config-container`).addClass(`hidden`);
    $(`iframe`).removeClass(`hidden`);
  }
};

/**
 * Sets up an interval which checks each second if the captcha has been resolved
 * (which is, by definition, the case when the room link appears).
 *
 * TODO rename to waitForRoomLink or something?
 */
module.exports.waitForCaptchaResolution = function() {
  const deferred = new $.Deferred();

  const interval = setInterval(function() {
    if (module.exports.isRoomLinkAvailable()) {
      clearInterval(interval);
      deferred.resolve();
      displayRoomLinkInHhmContainer();
      $(`iframe`).addClass(`hidden`);
      $(`#hhm-main-container`).removeClass(`hidden`);
      $$(`hhm-tabview`).resize(true);
      require(`./plugins`).updatePluginView();
    }
  }, 1000);

  return deferred.promise();
};

/**
 * Returns the room link from the iframe.
 */
module.exports.getRoomLink = function() {
  return $(`iframe`).contents().find(`#roomlink a`).attr(`href`);
};

/**
 * Returns whether the room link is available in the iframe.
 */
module.exports.isRoomLinkAvailable = function() {
  return typeof module.exports.getRoomLink() !== `undefined`;
};

/**
 * Contains a list of functions which will be called when the tab is changed
 * in the main tabview.
 */
const viewChangeHandlers = [];

/**
 * Registers a new view change handler.
 */
module.exports.registerViewChangeHandler = function(viewChangeHandler) {
  if (typeof viewChangeHandler !== `function`) {
    HHM.log.warn(`Invalid view change handler ${viewChangeHandler} ignored`);
    return;
  }

  viewChangeHandlers.push(viewChangeHandler);
};

/**
 * Called when the view is changed on the main tabview.
 */
function viewChangeHandler() {
  for (let handler of viewChangeHandlers) {
    try {
      handler();
    } catch (e) {
      HHM.log.warn(`Error during view change handler execution: ${e.message}`);
    }
  }
}