{Firebase} = require './moddl-firebase'

module.exports = (moddl) ->
  {q} = moddl
  {EventEmitter} = require 'events'

  Provider = new EventEmitter()
  
  Provider.cache =
    connected: {}
    connecting: {}
  
  Provider.get_root = (url, root) ->
    Provider.connect(name: url)
    .then (conn) ->
      conn.child(root)
  
  Provider.connect = (opts) ->
    opts.name ?= opts.url
    opts.name = opts.name.toLowerCase()
    
    return q(Provider.cache.connected[opts.name]) if Provider.cache.connected[opts.name]?
    return Provider.cache.connecting[opts.name] if Provider.cache.connecting[opts.name]?
    
    d = q.defer()
    
    unless opts.url?
      Provider.on 'connect:' + opts.name, ->
        d.resolve(Provider.cache.connected[opts.name])
      return d.promise
    
    parsed = moddl.betturl.parse(opts.url) if opts.url?
    
    auth = parsed.auth
    delete parsed.auth
    
    Provider.cache.connecting[opts.name] = d.promise
    
    base = new Firebase(moddl.betturl.format(parsed))
    finish = (err) ->
      delete Provider.cache.connecting[opts.name]
      return d.reject(err) if err?
      Provider.cache.connected[opts.name] = base

      d.resolve(base)
      Provider.emit('connect:' + opts.name)
    
    if auth?.password?
      base.auth auth.password, (err, res) ->
        return finish(err) if err?
        finish()
    else
      finish()
    
    d.promise
  
  Provider
