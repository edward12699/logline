class Logline {
    // static set _config(value) {     throw new Error('不允许设置') } static get _config
    // () {     return Logline.Logline }
    /**
     * 设置自定义属性
     * @param {obj} customConfig
     */
    static setConfig(customConfig) {
        Logline._config = Object.assign(Logline._config, customConfig)
    }

    static initPerformance() {

        class badPerformance {
            constructor(performanceNavigationTiming) {
                this.time = new Date()
                this.appversion = navigator.appVersion
                this.performanceNavigationTiming = performanceNavigationTiming
            }
        }
        window.addEventListener('load', () => {
            console.log('load')
            let performanceNavigationTiming = performance.getEntries()[0]
            if (performanceNavigationTiming.domComplete > Logline._config.loadEventEnd) {
                Logline.uploadBadPerformances(new badPerformance(performanceNavigationTiming))
            }
        })

    }

    static initJsErrorPlayback() {
        class UserOperation {
            constructor(target) {
                this.tagName = target.tagName
                this.className = target.className
                this.id = target.id
            }
        }
        window.addEventListener('click', (e) => {
            Logline.userOperations.push(new UserOperation(e.target))
            console.log(Logline.userOperations)
            if (Logline.userOperations.length > Logline._config.jsErrorSteps) {
                Logline
                    .userOperations
                    .shift()
            }
        })
        window.onerror = function(message, source, lineno, colno, error) {
           let errorMessage = {
                message: message,
                source: source,
                lineno: lineno,
                colno: colno,
                error: error
           }
           Logline.uploadJsErrorPlayback(Logline.userOperations.concat([errorMessage]))
        }
    }

    static init() {
        localStorage.badPerformances = ''
        localStorage.UserOperations = ''
        Logline.wrapper()//是否需要包裹跨域引用链接
        Logline.initPerformance()
        Logline.initJsErrorPlayback()
    }

    static wrapper() {
        let global = window
        var tryJs = {}
        // function or not
        var _isFunction = function (foo) {
            return typeof foo === "function";
        };
        var _onthrow = function (errObj) {
            Logline.uploadJsErrorPlayback(Logline.userOperations.concat([errObj]))
        };
        /**
         * makeObjTry
         * wrap a object's all value with try & catch
         * @param {Function} foo
         * @param {Object} self
         * @returns {Function}
         */
        var makeObjTry = function (obj) {
            var key,
                value;
            for (key in obj) {
                value = obj[key];
                if (_isFunction(value))
                    obj[key] = cat(value);
                }
            return obj;
        };
        // before: foo(cb,timeout) after: catTimeout(foo)(cb,timeout)
        // 好像还是保护了foo的作用域，并且拓展了setTimeout具有了throw的功能
        var catTimeout = function (foo) {
            return function (cb, timeout) {
                // for setTimeout(string, delay)
                if (typeof cb === "string") {
                    try {
                        cb = new Function(cb);
                    } catch (err) {
                        throw err;
                    }
                }
                var args = []
                    .slice
                    .call(arguments, 2);
                // for setTimeout(function, delay, param1, ...)
                cb = cat(cb, args.length && args);
                return foo(cb, timeout);
            };
        };
        // 本来的调用方式是： foo(func1,func2,func3) 现在的调用方式是：catArgs(foo)(func1,func2,func3...)
        // 作用是：保护了foo的作用域 并且本来foo是外链中的，但是catArgs我们同源中的东西，使得包装后返回的函数，能够正确被try-catch err
        var catArgs = function (foo) {
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
        var cat = function (foo, args) {
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
        }

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
        }
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
       tryJs.spyModules = function() {
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
            global.define = function() {
                var arg, args = [];
                for (var i = 0, l = arguments.length; i < l; i++) {
                    arg = arguments[i];
                    if (_isFunction(arg)) {
                        arg = cat(arg);
                        //seajs should use toString parse dependencies , so rewrite it
                        arg.toString = (function(orgArg) {
                            return function() {
                                return orgArg.toString();
                            };
                        }(arguments[i]));
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
        tryJs.spyModules()
            .spySystem();
        return tryJs;
    }
    tryJs.spyAll()
    }

    /**
     *
     * @param {object} badPerformance
     */
    static uploadBadPerformances(badPerformance) {
        localStorage.badPerformances = JSON.stringify(badPerformance)
    }

    static uploadJsErrorPlayback(userOperations) {
        localStorage.userOperations = JSON.stringify(userOperations)
    }

}

Logline._config = {
    loadEventEnd: 2000,
    jsErrorSteps: 5
}
Logline.timeoutkey

Logline.userOperations = new Array(Logline._config.jsErrorSteps)

window.Logline = Logline

export default Logline
