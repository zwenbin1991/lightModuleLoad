/**
 * @name jLoader
 * @description 轻量模块加载器
 * @author zengwenbin
 * @email zwenbin1991@163.com
 * @date 2016-3-27
 * @version 1.0.0
 */
;(function (root, factory) {
    root.jLoader = factory(this, {})
})(this, function (root, exports) {
    'use strict';

    var protocolExp = /(http:\/\/|file:\/\/\/[^/]:)/i;
    var tagExp = /([^\/.]+)(\.js)?(\?.*)?$/i;
    var stackExp = /@|at/i;
    var clearTrimExp = /^\s+|\s+$/;
    var clearErrorLineAndStartChar = /(:\d+)?:\d+$/;
    var readyStateExp = /loaded|complete/i;

    var nativeSlice = Array.prototype.slice;
    var nativeKeys = Object.keys;
    var nativeHasOwnProperty = Object.prototype.hasOwnProperty;
    var nativeToString = Object.prototype.toString;

    var headElement = document.head || document.getElementsByTagName('head')[0];
    var isSupportOnLoad = !!document.addEventListener;

    // 处理对象在ie6,7声明以下任何属性都不能被遍历的bug
    // 出自underscore.js
    var isEnumerBug = !{toString: null}.propertyIsEnumerable('toString');
    var enumBugProperties = [
        'toString', 'valueOf', 'toLocaleString',
        'isPrototypeOf', 'hasOwnProperty', 'propertyIsEnumerable'
    ];

    /**
     * 得到对象key数组
     *
     * @param {Object} object 对象
     * @return {Array}
     */
    function keys (object) {
        var result = [];
        var proto = object.__proto__ || Object.getPrototypeOf(object);
        var length, property;

        if (!!nativeKeys) return nativeKeys(object);

        for (var key in object) {
            nativeHasOwnProperty.call(object, key) && result.push(key);
        }

        if (isEnumerBug) {
            length = enumBugProperties.length;

            while(length--) {
                property = enumBugProperties[length];

                (property in object && object[key] !== proto[property]) && result.push(property);
            }
        }

        return result;
    }

    /**
     * 迭代器
     *
     * @param {Array|Object} obj 迭代对象
     * @param {Number} sign 使用原生forEach还是使用自定义迭代器 [可选] default: 0
     *   说明：0: 使用原生forEach；1: 使用自定义迭代器
     * @return {Function}
     */
    function each (obj, sign) {
        sign || (sign = 0);

        return function (fn) {
            var isObject = nativeToString.call(obj).slice(8, -1).toLowerCase() === 'object';
            var keyCollection;

            if (isObject) {
                keyCollection = keys(obj);
            }

            if (!sign) {
                return (isObject ? keyCollection : obj).forEach(function (value, index) {
                    isObject ? fn.call(root, obj[value], value, obj) : fn.call(root, value, index, obj);
                });
            }

            for (var index = 0, length = obj.length; index < length; index++) {
                if ((isObject ? fn.call(root, obj[keyCollection[index]], keyCollection[index], obj) : fn.call(root, obj[index], index, obj)) === false) return;
            }
        };
    }

    /**
     * 为对象赋予默认值
     *
     * @param {Object} object 对象
     * @param {Object} defaultObject 默认对象
     * @return {Object}
     */
    function defaults (object, defaultObject) {
        each(defaultObject)(function (value, key) {
            object[key] == void 0 && (object[key] = value);
        });

        return object;
    }

    // 模块加载器配置对象
    var moduleLoaderConf = {
        baseUrl: '',
        alias: {},
        charset: 'utf-8'
    };

    // 模块加载器通用方法
    var moduleLoaderGeneralFn = {

        /**
         * 获取当前正在运行的模块的script name(不带后缀)
         */
        getCurrentInvokeScriptName: function () {
            var script, stack;

            try {
                (void 0)();
            } catch (e) {
                stack = e.stack;
            }

            if (stack) {
                stack = stack.split(stackExp).pop().replace(clearTrimExp, '');
                script = stack.replace(clearErrorLineAndStartChar, '');

                return tagExp.test(script) ? RegExp.$1 : '';
            } else {
                each(headElement.getElementsByTagName('script'), 1)(function (scriptElement) {
                    if (scriptElement.readyState === 'interactive') {
                        script = scriptElement;

                        return false;
                    }
                });
            }

            return tagExp.test(script.src) ? RegExp.$1 : '';
        },

        /**
         * 获取模块加载器script dom
         */
        getLoaderScript: function () {
            return document.currentScript || nativeSlice.call(document.getElementsByTagName('script'), -1)[0];
        },

        /**
         * 获取模块加载器基础路径
         *
         * @param {String} tag 模块标识
         * @param {String} path 路径
         * @return {String}
         */
        getModuleBaseDir: function (tag, path) {
            var isRootDir = tag.charAt(0) === '/';
            var isAbsoluteDir = protocolExp.exec(path);
            var protocol = '';
            var domain = '';
            var tagDirs, pathDirs;

            // 如果路径是绝对路径，那么需要得到域名，并且如果模块标识是/开始，那需要返回清除根目录后面的路径
            if (isAbsoluteDir) {
                protocol = RegExp.$1;
                path = path.slice(protocol.length);

                // 如果通过http请求的模块，需要得到域名
                if (protocol.indexOf('http') === 0) {
                    domain = path.slice(0, protocol.indexOf('/') + 1);
                }

                path = isRootDir ? '' : path.slice(domain.length);
            }

            tagDirs = tag.split('/');
            tagDirs.pop();

            pathDirs = path.split('/');
            pathDirs.pop();

            isRootDir && tagDirs.shift();

            each(tagDirs)(function (tagDir) {
                if (tagDir === '..') {
                    pathDirs.pop();
                } else if (tagDir !== '.') {
                    pathDirs.push(tagDir);
                }
            });

            return protocol + domain + pathDirs.join('/') + '/';
        },

        /**
         * 获取模块名和模块真实路径
         *
         * @param {String} tag 模块标识
         * @param {String} baseUrl 基础路径
         * @return {String}
         */
        getModuleNameAndRealPath: function (tag, baseUrl) {
            var isAbsolutePath = protocolExp.test(tag);
            var tagMsg = tag.match(tagExp);
            var moduleName = tagMsg[1];
            var suffix = tagMsg[2] || '.js';
            var extra = tagMsg[3] || '';

            if (isAbsolutePath) {
                baseUrl = tag;
                tag = '';
            }

            var baseUrl = this.getModuleBaseDir(tag, baseUrl);

            return [moduleName, baseUrl + moduleName + suffix + extra];
        },

        traverseTags: function (fn) {
            var alias = moduleLoaderConf.alias;
            var self = this;
            var moduleSolid, moduleMsg, moduleName, moduleUrl;

            return function (tags) {
                var result = [];
                var baseUrl = moduleLoaderConf.baseUrl;
                var module = moduleLoader.module;

                each(tags)(function (tag) {
                    moduleMsg = self.getModuleNameAndRealPath(alias[tag] || tag, baseUrl);
                    moduleName = alias[tag] ? tag : moduleMsg[0];
                    moduleUrl = moduleMsg[1];
                    moduleSolid = module[moduleName];
                    fn.call(self, moduleSolid, moduleName, moduleUrl, result);
                });

                return result;
            }
        }
    };

    // 模块加载器
    var moduleLoader = {

        module: {},

        depModuleNameCache: [],

        /**
         * 模块加载器内部初始化
         * 分析模块加载器脚本DOM的data-main、data-baseurl得到入口模块标识和模块加载器基本路径
         * 加载入口模块
         */
        initialize: function () {
            var scriptElement = moduleLoaderGeneralFn.getLoaderScript();
            var currentPageUrl = root.location.href;

            // 分析模块加载器data-main、data-baseurl
            var main = scriptElement.getAttribute('data-main');
            var baseUrl = scriptElement.getAttribute('data-baseurl');

            // 设置模块加载器的基础路径
            moduleLoaderConf.baseUrl = baseUrl ? moduleLoaderGeneralFn.getModuleBaseDir(baseUrl, currentPageUrl) : currentPageUrl.slice(0, currentPageUrl.lastIndexOf('/') + 1);

            // 加载main模块
            main && exports.use(main);
        },

        /**
         * 模块加载错误输出
         *
         * @param {String} msg 错误信息
         */
        error: function (msg) {
            throw new Error(msg);
        },

        /**
         * 加载模块
         *
         * @param {Array} unloadedCache 依赖未加载模块信息
         * 说明：
         *       内部结构: {Object} object.name 模块名 object.url 模块真实路径
         *       方法: {Function} implementFactory  针对依赖模块全部加载完成的回调函数，用于加载依赖模块时，当依赖模块加载完成在调用 [可选]
         * @param {Object} moduleSolid 定义模块对象，如果存在就是需要加载模块的依赖模块，moduleSolid代表是定义模块的模块对象 [可选]
         */
        load: function (unloadedCache, moduleSolid) {
            var iteratee = each(unloadedCache);
            var self = this;
            var scriptElement;

            iteratee(function (msg) {
                scriptElement = self.getScript(msg.name, msg.url, unloadedCache, moduleSolid);
                headElement.insertBefore(scriptElement, headElement.firstChild);
            });
        },

        /**
         * 创建模块script dom，并且返回
         *
         * @param {String} name 模块名
         * @param {String} url 模块真实路径
         * @param {Array} unloadedCache 未加载模块信息
         * 说明：
         *       内部结构: {Object} object.name 模块名 object.url 模块真实路径
         *       方法: {Function} implementFactory  针对依赖模块全部加载完成的回调函数，用于加载依赖模块时，当依赖模块加载完成在调用 [可选]
         * @param {Object} moduleSolid 定义模块对象，如果存在就是需要加载模块的依赖模块，moduleSolid代表是定义模块的模块对象 [可选]
         * @return {HTMLScriptElement}
         */
        getScript: function (name, url, unloadedCache, moduleSolid) {
            var self = this;
            var loadEvent = isSupportOnLoad ? 'onload' : 'onreadystatechange';
            var scriptElement = document.createElement('script');
            var module = self.module, depModuleSolid;

            scriptElement.src = url;
            scriptElement.async = true;
            scriptElement.charset = moduleLoaderConf.charset;



            if (isSupportOnLoad) {
                scriptElement.onerror = function () {
                    scriptElement.onerror = null;
                    headElement.removeChild(scriptElement);
                    self.error(name + '加载失败，失败路径 ' + url);
                }
            }

            scriptElement[loadEvent] = function () {
                depModuleSolid = module[name];
                depModuleSolid.url = url;

                if (isSupportOnLoad || readyStateExp.test(scriptElement.readyState)) {
                    scriptElement[loadEvent] = null;
                    headElement.removeChild(scriptElement);
                    self.complete(depModuleSolid, unloadedCache, moduleSolid);
                }
            };

            return scriptElement;
        },

        /**
         * 模块加载完成执行函数
         *
         * @param {Object} depModuleSolid 依赖模块对象
         * @param {Array} unloadedCache 未加载模块信息
         * 说明：
         *       内部结构: {Object} object.name 模块名 object.url 模块真实路径
         *       方法: {Function} implementFactory  针对依赖模块全部加载完成的回调函数，用于加载依赖模块时，当依赖模块加载完成在调用
         * @param {Object} moduleSolid 定义模块对象，如果存在就是需要加载模块的依赖模块，moduleSolid代表是定义模块的模块对象 [可选]
         */
        complete: function (depModuleSolid, unloadedCache, moduleSolid) {
            var length, factory, moduleExports;

            if (!unloadedCache.implementFactory && (!moduleSolid || !moduleSolid.factory)) return;

            this.depModuleNameCache.push(unloadedCache.shift().name);
            depModuleSolid.status = 4;
            length = unloadedCache.length;

            // 所有待加载的模块全部加载完成
            if (!length) {
                factory = unloadedCache.implementFactory || moduleSolid.factory;
                moduleExports = this.getModuleExports(moduleSolid ? moduleSolid.deps : this.depModuleNameCache);
                this.depModuleNameCache = [];
                factory && factory.apply(null, moduleExports);
            }
        },

        /**
         * 触发模块的factory方法，为模块对象增加exports
         *
         * @param {Object} moduleSolid 模块对象
         */
        fireFactory: function (moduleSolid) {
            var unloadedMsg, moduleExports, deps;

            (deps || (deps = moduleSolid.deps)) && (unloadedMsg = this.getUnloadedMsg(deps));

            if (unloadedMsg && unloadedMsg.length) {
                this.load(unloadedMsg, moduleSolid);
                return;
            }

            moduleExports = deps ? this.getModuleExports(deps) : [];
            moduleSolid.exports = moduleSolid.factory.apply(null, moduleExports);
        },

        getUnloadedMsg: moduleLoaderGeneralFn.traverseTags(function (moduleSolid, moduleName, moduleUrl, unloadMsg) {
            if (!moduleSolid || moduleSolid.status !== 4) {
                !moduleSolid && (moduleLoader.module[moduleName] = {});
                unloadMsg.push({ name: moduleName, url: moduleUrl });
            }
        }),

        getModuleExports: moduleLoaderGeneralFn.traverseTags(function (moduleSolid, moduleName, moduleUrl, moduleExports) {
            if (moduleSolid && moduleSolid.status === 4) moduleExports.push(moduleSolid.exports);
        })
    };

    /**
     * 模块引用
     *
     * @param {String|Array} tags 模块标识集合
     * @param {Function} factory 模块内部函数
     */
    exports.use = function (tags, factory) {
        (typeof tags === 'string') && (tags = [tags]);

        var unloadedMsg = moduleLoader.getUnloadedMsg(tags), moduleExports;

        if (!unloadedMsg.length) {
            moduleExports = moduleLoader.getModuleExports(tags);
            factory && factory.apply(null, moduleExports);
            return;
        }

        unloadedMsg.implementFactory = factory;
        moduleLoader.load(unloadedMsg);
    };

    /**
     * 模块定义
     *
     * @param {String} tag 模块标识
     * @param {Array} deps 依赖模块
     * @param {Function} factory 模块内部函数
     */
    exports.define = function (tag, deps, factory) {
        // 支持4种模块定义方式: (1)、匿名无依赖模块; (2)、匿名依赖模块; (3)、具名无依赖模块; (4)、具名依赖模块;
        var module = moduleLoader.module;
        var moduleSolid = module[tag];

        if (typeof tag !== 'string') {
            if (typeof tag === 'function') {
                factory = tag;
                deps = void 0;
            } else {
                factory = deps;
                deps = tag;
            }

            tag = moduleLoaderGeneralFn.getCurrentInvokeScriptName();
        } else if (typeof deps === 'function') {
            factory = deps;
            deps = void 0;
        }

        if (!moduleSolid) {
            moduleSolid = module[tag] = {};
        }

        moduleSolid.deps = deps;
        moduleSolid.factory = factory;

        // 触发factory方法，生成exports属性
        moduleLoader.fireFactory(moduleSolid);
    };

    moduleLoader.initialize();

    return exports;
});