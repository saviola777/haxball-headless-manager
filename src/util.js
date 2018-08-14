/**
 * Function for loading an external script and calling a callback function on
 * completion.
 *
 * Taken from https://stackoverflow.com/questions/950087/how-do-i-include-a-javascript-file-in-another-javascript-file
 */
module.exports.loadScript = function(url, callback) {
  // Adding the script tag to the head as suggested before
  const head = document.getElementsByTagName(`head`)[0];
  const script = document.createElement(`script`);
  script.type = `text/javascript`;
  script.async = false;

  // Then bind the event to the callback function.
  // There are several events for cross browser compatibility.
  script.onreadystatechange = callback;
  script.onload = callback;
  // Set URL after registering callbacks, otherwise we might miss the event for
  // cached scripts
  script.src = url;

  // Fire the loading
  head.appendChild(script);
};