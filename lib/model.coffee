Firebase = require 'firebase'

INDEX_PREFIX = '--idx--'

module.exports = (moddl) ->
  {q, Model} = moddl
  {EventEmitter} = require 'events'
  
  parallel = (obj) ->
    res = {}
    q.all(
      Object.keys(obj).map (k) ->
        q.when(obj[k]).then (v) ->
          res[k] = v
    ).then ->
      res
  
  class Model.Firebase extends Model
    constructor: ->
      return super(Model.Firebase, arguments...)
  
    @initialize: (opts) ->
      @options = {}
      if typeof opts is 'string'
        @options.root = opts
        @options.url = 'DEFAULT'
      else
        @options[k] = v for k, v of opts
        @options.url ?= 'DEFAULT'
        @options.index ?= []
      
      Object.defineProperty @, '__root__',
        enumerable: true
        get: ->
          Model.Firebase.provider.get_root(@options.url, @fix_key(@options.root))
  
    @load: (instance, data) ->
      instance[k] = v for k, v of data
  
    @connect: (url) ->
      Model.Firebase.provider.connect(name: 'DEFAULT', url: url)
    
    @fix_key: (key) ->
      a = key.split('/').map (k) ->
        k.split('').map (c) ->
          return '%' + Buffer([c.charCodeAt(0)]).toString('hex') if c[0] in ['.', '$', '[', ']', '#', '/']
          c[0]
        .join('')
      .join('/')
      
      a
    
    @exists: Model.defer (obj) ->
      return false if @options.index.length is 0
      
      @__root__.then (root) =>
        index_root = root.root().child(INDEX_PREFIX)
        
        exists = false
        q.all(
          @options.index.map (idx) =>
            idx_key = @fix_key(idx + '/' + obj[idx])
            
            d = q.defer()
            index_root.child(idx_key).once 'value', (s) ->
              exists = true if s.val()?
              d.resolve()
            d.promise
        )
        .then ->
          exists
    
    @create: Model.defer (obj, opts) ->
      throw new Error('Nothing passed to create') unless obj?
      opts ?= {}
      
      for idx in @options.index
        throw new Error('When creating an object you must supply all indexed fields: ' + @options.index.join(', ')) unless obj[idx]?
      
      q()
      .then =>
        return false if opts.overwrite is true
        @exists(obj)
      .then (exists) =>
        throw new Error('Record already exists: ' + JSON.stringify(obj, null, 2)) if exists
        
        @__root__
      .then (root) =>
        index_root = root.root().child(INDEX_PREFIX)
        
        id = root.push(obj).name()
        q.all(
          @options.index.map (idx) =>
            q.ninvoke(index_root.child(@fix_key(idx + '/' + obj[idx])), 'set', id)
        )
        .then ->
          root.child(id)
    
    @get_id_from_index: Model.defer (query) ->
      throw new Error('Queries must be of the form {key: value}') unless query?
      keys = Object.keys(query)
      throw new Error('Queries must be of the form {key: value}') unless keys.length is 1
      throw new Error("There is no index for '#{keys[0]}', cannot query without an index") unless keys[0] in @options.index
      
      @__root__.then (root) =>
        index_root = root.root().child(INDEX_PREFIX)
        
        d = q.defer()
        
        index_root.child(@fix_key(keys[0] + '/' + query[keys[0]])).once 'value', (ref) ->
          d.resolve(ref)
        
        d.promise
    
    @get: Model.defer (query) ->
      parallel
        id: @get_id_from_index(query)
        root: @__root__
      .then (data) =>
        return data.id unless data.id.val()?
        
        d = q.defer()
        data.root.child(data.id.val()).once 'value', (ref) ->
          d.resolve(ref)
        d.promise
    
    @destroy: Model.defer (query) ->
      parallel
        obj: @get(query)
        root: @__root__
      .then (data) =>
        return unless data.obj.val()?
        
        index_root = data.root.root().child(INDEX_PREFIX)
        
        q.all(
          [
            q.ninvoke(data.root.child(data.obj.name()), 'remove')
          ].concat(
            @options.index.map (idx) =>
              idx_key = @fix_key(idx + '/' + data.obj.val()[idx])
              q.ninvoke(index_root.child(idx_key), 'remove')
          )
        )
        .then ->
          data.obj
    
    @array: Model.defer ->
      @__root__.then (root) =>
        d = q.defer()
        
        root.once 'value', (ref) =>
          arr = []
          ref.forEach (child) ->
            arr.push(child)
            null
          d.resolve(arr)
        
        d.promise
    
    @subscribe: ->
      sub = new EventEmitter()
      
      events =
        add: (ref) ->
          return if ref.name() <= sub.__last_name__
          sub.__last_name__ = ref.name()
          sub.emit('add', arguments...)
        remove: -> sub.emit('remove', arguments...)
        change: -> sub.emit('change', arguments...)
        move: -> sub.emit('move', arguments...)
      
      sub.cancel = ->
        sub.ref.off('child_added', events.add)
        sub.ref.off('child_removed', events.remove)
        sub.ref.off('child_changed', events.change)
        sub.ref.off('child_moved', events.move)
      
      @__root__.then (root) ->
        sub.ref = root
        
        query = sub.ref.endAt().limit(1)
        sub.__last_name__ = q.defer()
        query.once 'value', (ref) ->
          sub.__last_name__ = if ref.val()? then Object.keys(ref.val())[0] else ''
          
          sub.ref.on('child_moved', events.move)
          sub.ref.on('child_changed', events.change)
          sub.ref.on('child_removed', events.remove)
          query.on('child_added', events.add)
      
      sub
