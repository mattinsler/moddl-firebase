(function() {
  var Firebase,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Firebase = require('./moddl-firebase').Firebase;

  module.exports = function(moddl) {
    var EventEmitter, Model, get_index_root, parallel, q;
    q = moddl.q, Model = moddl.Model;
    EventEmitter = require('events').EventEmitter;
    parallel = function(obj) {
      var res;
      res = {};
      return q.all(Object.keys(obj).map(function(k) {
        return q.when(obj[k]).then(function(v) {
          return res[k] = v;
        });
      })).then(function() {
        return res;
      });
    };
    get_index_root = function(root, model) {
      return root.root().child('--idx--/' + model.options.root);
    };
    return Model.Firebase = (function(_super) {
      __extends(Firebase, _super);

      function Firebase() {
        return Firebase.__super__.constructor.apply(this, [Model.Firebase].concat(__slice.call(arguments)));
      }

      Firebase.initialize = function(opts) {
        var k, v, _base, _base1;
        this.options = {};
        if (typeof opts === 'string') {
          this.options.root = opts;
          this.options.url = 'DEFAULT';
        } else {
          for (k in opts) {
            v = opts[k];
            this.options[k] = v;
          }
          if ((_base = this.options).url == null) {
            _base.url = 'DEFAULT';
          }
          if ((_base1 = this.options).index == null) {
            _base1.index = [];
          }
        }
        return Object.defineProperty(this, '__root__', {
          enumerable: true,
          get: function() {
            return Model.Firebase.provider.get_root(this.options.url, this.fix_key(this.options.root));
          }
        });
      };

      Firebase.load = function(instance, data) {
        var k, v, _results;
        _results = [];
        for (k in data) {
          v = data[k];
          _results.push(instance[k] = v);
        }
        return _results;
      };

      Firebase.connect = function(url) {
        return Model.Firebase.provider.connect({
          name: 'DEFAULT',
          url: url
        });
      };

      Firebase.escape_string = function(str) {
        return str.split('').map(function(c) {
          var _ref;
          if ((_ref = c[0]) === '.' || _ref === '$' || _ref === '[' || _ref === ']' || _ref === '#' || _ref === '/') {
            return '%' + Buffer([c.charCodeAt(0)]).toString('hex');
          }
          return c[0];
        }).join('');
      };

      Firebase.fix_key = function(key) {
        var _this = this;
        return key.split('/').map(function(k) {
          return _this.escape_string(k);
        }).join('/');
      };

      Firebase.exists = Model.defer(function(obj) {
        var _this = this;
        if (this.options.index.length === 0) {
          return false;
        }
        return this.__root__.then(function(root) {
          var exists, index_root;
          index_root = get_index_root(root, _this);
          exists = false;
          return q.all(_this.options.index.map(function(idx) {
            var d, idx_key;
            idx_key = _this.escape_string(idx) + '/' + _this.escape_string(obj[idx]);
            d = q.defer();
            index_root.child(idx_key).once('value', function(s) {
              if (s.val() != null) {
                exists = true;
              }
              return d.resolve();
            });
            return d.promise;
          })).then(function() {
            return exists;
          });
        });
      });

      Firebase.create = Model.defer(function(obj, opts) {
        var idx, _i, _len, _ref,
          _this = this;
        if (obj == null) {
          throw new Error('Nothing passed to create');
        }
        if (opts == null) {
          opts = {};
        }
        _ref = this.options.index;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          idx = _ref[_i];
          if (obj[idx] == null) {
            throw new Error('When creating an object you must supply all indexed fields: ' + this.options.index.join(', '));
          }
        }
        return q().then(function() {
          if (opts.overwrite === true) {
            return false;
          }
          return _this.exists(obj);
        }).then(function(exists) {
          if (exists) {
            throw new Error('Record already exists: ' + JSON.stringify(obj, null, 2));
          }
          return _this.__root__;
        }).then(function(root) {
          var id, index_root;
          index_root = get_index_root(root, _this);
          id = root.push(obj).name();
          return q.all(_this.options.index.map(function(idx) {
            return q.ninvoke(index_root.child(_this.escape_string(idx) + '/' + _this.escape_string(obj[idx])), 'set', id);
          })).then(function() {
            return root.child(id);
          });
        });
      });

      Firebase.get_id_from_index = Model.defer(function(query) {
        var keys, _ref,
          _this = this;
        if (query == null) {
          throw new Error('Queries must be of the form {key: value}');
        }
        keys = Object.keys(query);
        if (keys.length !== 1) {
          throw new Error('Queries must be of the form {key: value}');
        }
        if (_ref = keys[0], __indexOf.call(this.options.index, _ref) < 0) {
          throw new Error("There is no index for '" + keys[0] + "', cannot query without an index");
        }
        return this.__root__.then(function(root) {
          var d, index_root;
          index_root = get_index_root(root, _this);
          d = q.defer();
          index_root.child(_this.escape_string(keys[0]) + '/' + _this.escape_string(query[keys[0]])).once('value', function(ref) {
            return d.resolve(ref);
          });
          return d.promise;
        });
      });

      Firebase.get = Model.defer(function(query) {
        var _this = this;
        return parallel({
          id: this.get_id_from_index(query),
          root: this.__root__
        }).then(function(data) {
          var d;
          if (data.id.val() == null) {
            return data.id;
          }
          d = q.defer();
          data.root.child(data.id.val()).once('value', function(ref) {
            return d.resolve(ref);
          });
          return d.promise;
        });
      });

      Firebase.destroy = Model.defer(function(query) {
        var _this = this;
        return parallel({
          obj: this.get(query),
          root: this.__root__
        }).then(function(data) {
          var index_root;
          if (data.obj.val() == null) {
            return;
          }
          index_root = get_index_root(data.root, _this);
          return q.all([q.ninvoke(data.root.child(data.obj.name()), 'remove')].concat(_this.options.index.map(function(idx) {
            var idx_key;
            idx_key = _this.escape_string(idx) + '/' + _this.escape_string(data.obj.val()[idx]);
            return q.ninvoke(index_root.child(idx_key), 'remove');
          }))).then(function() {
            return data.obj;
          });
        });
      });

      Firebase.array = Model.defer(function() {
        var _this = this;
        return this.__root__.then(function(root) {
          var d;
          d = q.defer();
          root.once('value', function(ref) {
            var arr;
            arr = [];
            ref.forEach(function(child) {
              arr.push(child);
              return null;
            });
            return d.resolve(arr);
          });
          return d.promise;
        });
      });

      Firebase.subscribe = function() {
        var events, sub;
        sub = new EventEmitter();
        events = {
          add: function(ref) {
            if (ref.name() <= sub.__last_name__) {
              return;
            }
            sub.__last_name__ = ref.name();
            return sub.emit.apply(sub, ['add'].concat(__slice.call(arguments)));
          },
          remove: function() {
            return sub.emit.apply(sub, ['remove'].concat(__slice.call(arguments)));
          },
          change: function() {
            return sub.emit.apply(sub, ['change'].concat(__slice.call(arguments)));
          },
          move: function() {
            return sub.emit.apply(sub, ['move'].concat(__slice.call(arguments)));
          }
        };
        sub.cancel = function() {
          sub.ref.off('child_added', events.add);
          sub.ref.off('child_removed', events.remove);
          sub.ref.off('child_changed', events.change);
          return sub.ref.off('child_moved', events.move);
        };
        this.__root__.then(function(root) {
          var query;
          sub.ref = root;
          query = sub.ref.endAt().limit(1);
          sub.__last_name__ = q.defer();
          return query.once('value', function(ref) {
            sub.__last_name__ = ref.val() != null ? Object.keys(ref.val())[0] : '';
            sub.ref.on('child_moved', events.move);
            sub.ref.on('child_changed', events.change);
            sub.ref.on('child_removed', events.remove);
            return query.on('child_added', events.add);
          });
        });
        return sub;
      };

      return Firebase;

    })(Model);
  };

}).call(this);
