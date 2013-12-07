module.exports = (moddl) ->
  require('./model')(moddl)
  moddl.Model.Firebase.provider = require('./provider')(moddl)
