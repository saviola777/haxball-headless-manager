/**
 * Module containing form helper functions
 */

/**
 * This function loads a single file from the given webix uploader and return
 * the plain text content.
 *
 * @return Plain text file content or `` if not file was uploaded.
 *
 * TODO distinguish between empty file and no file?
 */
module.exports.loadFileContent = async function($$uploader) {
  const fileId = $$uploader.files.getFirstId();

  // No files uploaded, abort
  if (typeof fileId === `undefined`) {
    //alert(`Please upload a file first`);
    return ``;
  }

  const file = $$uploader.files.getItem(fileId).file;

  const reader = new FileReader();
  const deferred = new $.Deferred();

  reader.onload = function() {
    deferred.resolve();
  };

  reader.readAsText(file);

  await deferred.promise();

  return reader.result;
};