/**
 * CSS module which injects custom CSS into the headless iframe.
 */

/**
 * Custom CSS.
 */
const cssCode = `
body, html {
  background-color: #393939;
}

a, a:visited, a:hover {
  color: #EEEEEE;
}

h2 {
  border-bottom: thin solid #000000;
}

.hidden {
  display: none;
}

.button {
  cursor: pointer; 
}

.green {
  color: #00FF00;
}

.red {
  color: #FF0000;
}

iframe {
  height: 100%;
  width: 100%;
}

#hhm-config-form-container, #hhm-main-container {
  height: 100%;
  width: 100%;
}
`;

/**
 * Inject CSS into the iframe.
 */
module.exports.injectCss = function() {
  $head = $(`head`);
  $head.append(`<link rel="stylesheet" type="text/css" media="screen"
    href="https://cdn.rawgit.com/webix-hub/tracker/7593dd49/codebase/skins/contrast.css" />`);
  $head.append(`<style type="text/css">${cssCode}</style>`);
};