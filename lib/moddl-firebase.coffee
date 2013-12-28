path = require 'path'

try
  Firebase = require path.join(process.cwd(), 'node_modules', 'firebase')
catch err
  console.log '\nYou must npm install firebase in order to use moddl-firebase\n'
  throw err

module.exports = (moddl) ->
  require('./model')(moddl)
  moddl.Model.Firebase.provider = require('./provider')(moddl)

module.exports.Firebase = Firebase
