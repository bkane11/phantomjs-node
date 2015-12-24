// Generated by CoffeeScript 1.10.0
(function() {
  var cleanUp, dnode, http, i, len, onSignalClean, phanta, ref, shoe, signal, spawn, startPhantomProcess, wrap,
    slice = [].slice;

  dnode = require('dnode');

  http = require('http');

  shoe = require('shoe');

  spawn = require('win-spawn');

  phanta = [];

  startPhantomProcess = function(binary, port, hostname, args) {
    return spawn(binary, args.concat([__dirname + '/shim.js', port, hostname]));
  };

  cleanUp = function() {
    var i, len, phantom, results;
    results = [];
    for (i = 0, len = phanta.length; i < len; i++) {
      phantom = phanta[i];
      results.push(phantom.exit());
    }
    return results;
  };

  onSignalClean = function(signal) {
    return function() {
      if (process.listeners(signal).length === 1) {
        return process.exit(0);
      }
    };
  };

  process.on('exit', cleanUp);

  ref = ['SIGINT', 'SIGTERM'];
  for (i = 0, len = ref.length; i < len; i++) {
    signal = ref[i];
    process.on(signal, onSignalClean(signal));
  }

  wrap = function(ph) {
    ph.callback = function(fn) {
      return '__phantomCallback__' + fn.toString();
    };
    ph._createPage = ph.createPage;
    return ph.createPage = function(cb) {
      return ph._createPage(function(page) {
        page._evaluate = page.evaluate;
        page.evaluate = function() {
          var args, cb, fn;
          fn = arguments[0], cb = arguments[1], args = 3 <= arguments.length ? slice.call(arguments, 2) : [];
          return page._evaluate.apply(page, [fn.toString(), cb].concat(args));
        };
        page._onResourceRequested = page.onResourceRequested;
        page.onResourceRequested = function() {
          var args, cb, fn;
          fn = arguments[0], cb = arguments[1], args = 3 <= arguments.length ? slice.call(arguments, 2) : [];
          return page._onResourceRequested.apply(page, [fn.toString(), cb].concat(args));
        };
        return cb(page);
      });
    };
  };

  module.exports = {
    create: function() {
      var arg, args, cb, httpServer, j, key, len1, options, phantom, ps, ref1, sock, value;
      args = [];
      options = {};
      for (j = 0, len1 = arguments.length; j < len1; j++) {
        arg = arguments[j];
        switch (typeof arg) {
          case 'function':
            cb = arg;
            break;
          case 'string':
            args.push(arg);
            break;
          case 'object':
            options = arg;
        }
      }
      if (typeof options.parameters === 'object') {
        ref1 = options.parameters;
        for (key in ref1) {
          value = ref1[key];
          args.push('--' + key + '=' + value);
        }
      }
      if (options.path == null) {
        options.path = '';
      }
      if (options.binary == null) {
        options.binary = options.path + 'phantomjs';
      }
      if (options.port == null) {
        options.port = 0;
      }
      if (options.hostname == null) {
        options.hostname = 'localhost';
      }
      if (options.dnodeOpts == null) {
        options.dnodeOpts = {};
      }
      ps = null;
      phantom = null;
      httpServer = http.createServer();
      httpServer.listen(options.port, options.hostname);
      httpServer.on("error", function(err) {
        if (cb != null) {
          return cb(null, err);
        } else {
          throw err;
        }
      });
      httpServer.on('listening', function() {
        var hostname, port;
        port = httpServer.address().port;
        hostname = httpServer.address().address;
        ps = startPhantomProcess(options.binary, port, hostname, args);
        ps.stdout.on('data', options.onStdout || function(data) {
          return console.log("phantom stdout: " + data);
        });
        ps.stderr.on('data', options.onStderr || function(data) {
          return module.exports.stderrHandler(data.toString('utf8'));
        });
        ps.on('error', function(err) {
          httpServer.close();
          if ((err != null ? err.code : void 0) === 'ENOENT') {
            console.error("phantomjs-node: You don't have 'phantomjs' installed");
          }
          if (cb != null) {
            return cb(null, err);
          } else {
            throw err;
          }
        });
        return ps.on('exit', function(code, signal) {
          var p;
          httpServer.close();
          if (phantom) {
            if (typeof phantom.onExit === "function") {
              phantom.onExit();
            }
            phanta = (function() {
              var k, len2, results;
              results = [];
              for (k = 0, len2 = phanta.length; k < len2; k++) {
                p = phanta[k];
                if (p !== phantom) {
                  results.push(p);
                }
              }
              return results;
            })();
          }
          if (options.onExit) {
            return options.onExit(code, signal);
          } else {
            console.assert(signal == null, "signal killed phantomjs: " + signal);
            if (code !== 0) {
              return process.exit(code);
            }
          }
        });
      });
      sock = shoe(function(stream) {
        var d;
        d = dnode({}, options.dnodeOpts);
        d.on('remote', function(_phantom) {
          phantom = _phantom;
          wrap(phantom);
          phantom.process = ps;
          phanta.push(phantom);
          return typeof cb === "function" ? cb(phantom, null) : void 0;
        });
        d.pipe(stream);
        return stream.pipe(d);
      });
      return sock.install(httpServer, '/dnode');
    },
    stderrHandler: function(message) {
      var NON_ERROR_MESSAGE;
      NON_ERROR_MESSAGE = /No such method.*socketSentData|CoreText performance note/;
      if (NON_ERROR_MESSAGE.test(message)) {
        return;
      }
      return console.warn("phantom stderr: " + message);
    }
  };

}).call(this);
