/**
 * Ajax module, containing a workaround for errors when including protocols in
 * URLs.
 *
 * @module src/ajax
 */

/**
 * Automatically applies a workaround to any URLs accessed via Ajax.
 *
 * The problem is caused by a misconfigured CROS proxy which fails for any
 * URLs containing a protocol (`https://` or `http://`). The workaround removes
 * the protocol and uses the port instead (none for HTTPS, `80` for HTTP).
 *
 * @alias module:src/ajax.applyProtocolWorkaround
 */
function applyProtocolWorkaround() {
  jQuery.ajaxPrefilter(function(options) {
    if (options.crossDomain && jQuery.support.cors) {
      options.url = HHM.proxyUrl + removeUrlProtocolWorkaround(options.url);
    }
  });
}

// TODO remove once no longer needed
function removeUrlProtocolWorkaround(url) {

  if (url.startsWith(`http://`)) {
    url = url.substr(7).replace(`/`, ':80/');
  } else if (url.startsWith(`https://`)) {
    url = url.substr(8);
  }

  return url;
}

module.exports.applyProtocolWorkaround = applyProtocolWorkaround;