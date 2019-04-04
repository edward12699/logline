(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Logline = factory());
}(this, (function () { 'use strict';

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var Logline = function () {
    function Logline() {
        classCallCheck(this, Logline);
    }

    createClass(Logline, null, [{
        key: 'setConfig',

        // static set _config(value) {     throw new Error('不允许设置') } static get _config
        // () {     return Logline.Logline }
        /**
         * 设置自定义属性
         * @param {obj} customConfig
         */
        value: function setConfig(customConfig) {
            Logline._config = _extends(Logline._config, customConfig);
        }
    }, {
        key: 'initPerformance',
        value: function initPerformance() {
            var badPerformance = function badPerformance(performanceNavigationTiming) {
                classCallCheck(this, badPerformance);

                this.time = new Date();
                this.appversion = navigator.appVersion;
                this.performanceNavigationTiming = performanceNavigationTiming;
            };

            window.addEventListener('load', function () {
                console.log('load');
                var performanceNavigationTiming = performance.getEntries()[0];
                if (performanceNavigationTiming.domComplete > Logline._config.loadEventEnd) {
                    Logline.uploadBadPerformances(new badPerformance(performanceNavigationTiming));
                }
            });
        }
    }, {
        key: 'initJsErrorPlayback',
        value: function initJsErrorPlayback() {
            var UserOperation = function UserOperation(target) {
                classCallCheck(this, UserOperation);

                this.tagName = target.tagName;
                this.className = target.className;
                this.id = target.id;
            };

            window.addEventListener('click', function (e) {
                Logline.userOperations.push(new UserOperation(e.target));
                console.log(Logline.userOperations);
                if (Logline.userOperations.length > Logline._config.jsErrorSteps) {
                    Logline.userOperations.shift();
                }
            });
            window.onerror = function (message, source, lineno, colno, error) {
                var errorMessage = {
                    message: message,
                    source: source,
                    lineno: lineno,
                    colno: colno,
                    error: error
                };
                Logline.uploadJsErrorPlayback(Logline.userOperations.concat([errorMessage]));
            };
        }
    }, {
        key: 'init',
        value: function init() {
            localStorage.badPerformances = '';
            localStorage.UserOperations = '';
            Logline.wrapper(); //是否需要包裹跨域引用链接
            Logline.initPerformance();
            Logline.initJsErrorPlayback();
        }
    }, {
        key: 'wrapper',
        value: function wrapper() {
            var global = window;
            var tryJs = {};
            // function or not
            var _isFunction = function _isFunction(foo) {
                return typeof foo === "function";
            };
            var _onthrow = function _onthrow(errObj) {
                Logline.uploadJsErrorPlayback(Logline.userOperations.concat([errObj]));
            };
            /**
             * makeObjTry
             * wrap a object's all value with try & catch
             * @param {Function} foo
             * @param {Object} self
             * @returns {Function}
             */
            var makeObjTry = function makeObjTry(obj) {
                var key, value;
                for (key in obj) {
                    value = obj[key];
                    if (_isFunction(value)) obj[key] = cat(value);
                }
                return obj;
            };
            // before: foo(cb,timeout) after: catTimeout(foo)(cb,timeout)
            // 好像还是保护了foo的作用域，并且拓展了setTimeout具有了throw的功能
            var catTimeout = function catTimeout(foo) {
                return function (cb, timeout) {
                    // for setTimeout(string, delay)
                    if (typeof cb === "string") {
                        try {
                            cb = new Function(cb);
                        } catch (err) {
                            throw err;
                        }
                    }
                    var args = [].slice.call(arguments, 2);
                    // for setTimeout(function, delay, param1, ...)
                    cb = cat(cb, args.length && args);
                    return foo(cb, timeout);
                };
            };
            // 本来的调用方式是： foo(func1,func2,func3) 现在的调用方式是：catArgs(foo)(func1,func2,func3...)
            // 作用是：保护了foo的作用域 并且本来foo是外链中的，但是catArgs我们同源中的东西，使得包装后返回的函数，能够正确被try-catch err
            var catArgs = function catArgs(foo) {
                return function () {
                    var arg,
                        args = [];
                    for (var i = 0, l = arguments.length; i < l; i++) {
                        arg = arguments[i];
                        _isFunction(arg) && (arg = cat(arg));
                        args.push(arg);
                    }
                    return foo.apply(this, args);
                };
            };
            //目的：包装函数，使得包装后的函数具有throw的能力 参数是函数
            var cat = function cat(foo, args) {
                return function () {
                    try {
                        return foo.apply(this, args || arguments);
                    } catch (error) {

                        _onthrow(error);

                        // some browser throw error (chrome) , can not find error where it throw,  so
                        // print it on console;
                        if (error.stack && console && console.error) {
                            console.error("[BJ-REPORT]", error.stack);
                        }

                        // hang up browser and throw , but it should trigger onerror , so rewrite
                        // onerror then recover it
                        if (!Logline.timeoutkey) {
                            var orgOnerror = global.onerror;
                            global.onerror = function () {};
                            Logline.timeoutkey = setTimeout(function () {
                                global.onerror = orgOnerror;
                                Logline.timeoutkey = null;
                            }, 50);
                        }
                        throw error;
                    }
                };
            };

            /**
             * wrap custom of function ,
             * @param obj - obj or  function
             * @returns {Function}
             */
            tryJs.spyCustom = function (obj) {
                if (_isFunction(obj)) {
                    return cat(obj);
                } else {
                    return makeObjTry(obj);
                }
            };
            /**
             * wrap async of function in window , exp : setTimeout , setInterval
             * @returns {Function}
             */
            tryJs.spySystem = function () {
                global.setTimeout = catTimeout(global.setTimeout);
                global.setInterval = catTimeout(global.setInterval);
                return tryJs;
            };

            /**
            * wrap amd or commonjs of function  ,exp :  define , require ,
            * @returns {Function}
            */
            tryJs.spyModules = function () {
                var _require = global.require,
                    _define = global.define;
                if (_define && _define.amd && _require) {
                    global.require = catArgs(_require);
                    _merge(global.require, _require);
                    global.define = catArgs(_define);
                    //对比下global.define = _define，区别是什么呢？
                    //global.define能直接引用到_define.，那么就具有修改_define变量的功能
                    //包装后的函数是一个匿名函数，保护住了_define的私有性
                    _merge(global.define, _define);
                }

                if (global.seajs && _define) {
                    global.define = function () {
                        var arg,
                            args = [];
                        for (var i = 0, l = arguments.length; i < l; i++) {
                            arg = arguments[i];
                            if (_isFunction(arg)) {
                                arg = cat(arg);
                                //seajs should use toString parse dependencies , so rewrite it
                                arg.toString = function (orgArg) {
                                    return function () {
                                        return orgArg.toString();
                                    };
                                }(arguments[i]);
                            }
                            args.push(arg);
                        }
                        return _define.apply(this, args);
                    };

                    global.seajs.use = catArgs(global.seajs.use);

                    _merge(global.define, _define);
                }

                return tryJs;
            };
            tryJs.spyAll = function () {
                tryJs.spyModules().spySystem();
                return tryJs;
            };
            tryJs.spyAll();
        }

        /**
         *
         * @param {object} badPerformance
         */

    }, {
        key: 'uploadBadPerformances',
        value: function uploadBadPerformances(badPerformance) {
            localStorage.badPerformances = JSON.stringify(badPerformance);
        }
    }, {
        key: 'uploadJsErrorPlayback',
        value: function uploadJsErrorPlayback(userOperations) {
            localStorage.userOperations = JSON.stringify(userOperations);
        }
    }]);
    return Logline;
}();

Logline._config = {
    loadEventEnd: 2000,
    jsErrorSteps: 5
};
Logline.userOperations = new Array(Logline._config.jsErrorSteps);

window.Logline = Logline;

return Logline;

})));
