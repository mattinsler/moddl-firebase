(function() {
  var Firebase;

  Firebase = require('./moddl-firebase').Firebase;

  module.exports = function(moddl) {
    var EventEmitter, Provider, q;
    q = moddl.q;
    EventEmitter = require('events').EventEmitter;
    Provider = new EventEmitter();
    Provider.cache = {
      connected: {},
      connecting: {}
    };
    Provider.get_root = function(url, root) {
      return Provider.connect({
        name: url
      }).then(function(conn) {
        return conn.child(root);
      });
    };
    Provider.connect = function(opts) {
      var auth, base, d, finish;
      if (opts.name == null) {
        if (typeof opts.url === 'string') {
          opts.name = opts.url;
        } else {
          opts.name = moddl.betturl.format(opts.url);
        }
      }
      if (Provider.cache.connected[opts.name] != null) {
        return q(Provider.cache.connected[opts.name]);
      }
      if (Provider.cache.connecting[opts.name] != null) {
        return Provider.cache.connecting[opts.name];
      }
      auth = opts.url.auth;
      delete opts.url.auth;
      d = q.defer();
      if ((opts.name != null) && (opts.url == null)) {
        Provider.on('connect:' + opts.name, function() {
          return d.resolve(Provider.cache.connected[opts.name]);
        });
        return d.promise;
      }
      Provider.cache.connecting[opts.name] = d.promise;
      base = new Firebase(moddl.betturl.format(opts.url));
      finish = function(err) {
        delete Provider.cache.connecting[opts.name];
        if (err != null) {
          return d.reject(err);
        }
        Provider.cache.connected[opts.name] = base;
        d.resolve(base);
        return Provider.emit('connect:' + opts.name);
      };
      if ((auth != null ? auth.password : void 0) != null) {
        base.auth(auth.password, function(err, res) {
          if (err != null) {
            return finish(err);
          }
          return finish();
        });
      } else {
        finish();
      }
      return d.promise;
    };
    return Provider;
  };

}).call(this);
