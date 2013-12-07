(function() {
  module.exports = function(moddl) {
    require('./model')(moddl);
    return moddl.Model.Firebase.provider = require('./provider')(moddl);
  };

}).call(this);
