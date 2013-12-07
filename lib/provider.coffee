Firebase = require 'firebase'

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
    unless opts.name?
      if typeof opts.url is 'string'
        opts.name = opts.url
      else
        opts.name = moddl.betturl.format(opts.url)
    
    return q(Provider.cache.connected[opts.name]) if Provider.cache.connected[opts.name]?
    return Provider.cache.connecting[opts.name] if Provider.cache.connecting[opts.name]?
    
    auth = opts.url.auth
    delete opts.url.auth
    
    d = q.defer()
    
    if opts.name? and not opts.url?
      Provider.on 'connect:' + opts.name, ->
        d.resolve(Provider.cache.connected[opts.name])
      return d.promise

    Provider.cache.connecting[opts.name] = d.promise
    
    base = new Firebase(moddl.betturl.format(opts.url))
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
