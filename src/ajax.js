/**
 * Ajax module, containing a workaround for errors when including protocols in
 * URLs.
 */

module.exports.applyProtocolWorkaround = () => {
  jQuery.ajaxPrefilter(function(options) {
    if (options.crossDomain && jQuery.support.cors) {
      options.url = HHM.proxyUrl + removeUrlProtocolWorkaround(options.url);
    }
  });
};

// TODO remove once no longer needed
function removeUrlProtocolWorkaround(url) {

  if (url.startsWith(`http://`)) {
    url = url.substr(7).replace(`/`, ':80/');
  } else if (url.startsWith(`https://`)) {
    url = url.substr(8);
  }

  return url;
}