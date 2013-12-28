(function() {
  var Firebase, err, path;

  path = require('path');

  try {
    Firebase = require(path.join(process.cwd(), 'node_modules', 'firebase'));
  } catch (_error) {
    err = _error;
    console.log('\nYou must npm install firebase in order to use moddl-firebase\n');
    throw err;
  }

  module.exports = function(moddl) {
    require('./model')(moddl);
    return moddl.Model.Firebase.provider = require('./provider')(moddl);
  };

  module.exports.Firebase = Firebase;

}).call(this);
