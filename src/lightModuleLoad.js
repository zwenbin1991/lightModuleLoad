/**
 * @name lightModuleLoad
 * @description 轻量模块加载器
 * @author zengwenbin
 * @email zwenbin1991@163.com
 * @date 2016-3-27
 * @version 1.0.0
 */

;(function (root, factory) {
    root.lightModuleLoad = factory(root);
})(this, function (root) {
    'use strict';

    var protocolExp = /(file:\/*?[a-z]:\/|http:\/+)/i; // 匹配模块绝对路径协议
    var moduleTagExp = /([^/?]*?)(\.(?:css|js))?(\?.*)?$/i; // 匹配模块名、后缀名和其他信息
    var errorTagExp = /(@|at)/i; // 错误信息chrome和ie>8是at，ff和opera是@
    var clearTrimExp = /^\s+|\s+$/g; // 清空开始和结尾空白
    var clearErrorLineAndStartExp = /(:\d+)?:\d+$/; // 清空错误行号和错误字符开始位置

    // 出自underscore.js里的方法
    var hasEnumBug = !{ toString: null }.propertyIsEnumerable('toString'); // ie < 9情况下存在对象遍历不到某些值的bug
    var noEnumProps = [
        'toString', 'valueOf', 'hasOwnProperty',
        'toLocaleString', 'constructor', 'propertyIsEnumerable'
    ]; // 遍历不到的属性集合

    var headElement = document.head || document.getElementsByTagName('head')[0];

    /* 快捷方法(向上兼容) */
    // 数组遍历
    var forEach = function (array) {
        var each = array.forEach;

        return function (iteratee) {
            if (each) return each.call(array, iteratee);

            for (var i = 0, length = array.length; i < length; i++) {
                iteratee.call(root, array[i], i, array);
            }
        };
    };

    // 数组是否包含值
    var isContains = function (array, value) {
        var each, result;

        if (array.indexOf) return array.indexOf(value) >= 0;

        each = forEach(array);
        each(function (value, i) {
            if (array[i] === value) result = true;
        });

        return !!result;
    };

    // 获取对象key集合
    var nativeKeys = Object.keys || function (object) {
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        var results = [], each, proto;

        for (var key in object) {
           hasOwnProperty.call(object, key) && results.push(key);
        }

        if (hasEnumBug) {
            proto = object.__proto__ || object.constructor.prototype;
            each = forEach(noEnumProps);
            each(function (prop) {
                !isContains(results, prop) && object[prop] !== proto[prop] && results.push(prop);
            });
        }

        return results;
    };

    // 如果对象不存在key，则使用默认对象key补充
    var defaults = function (object, defaultObject) {
        forEach(nativeKeys(defaultObject))(function (key, i) {
            object[key] == void 0 && (object[key] = defaultObject[key]);
        });
    };

    /* 模块加载器配置对象，可通过开发人员自定义 */
    var moduleLoadConfig = {
        baseUrl: '', // 模块基础路径
        alias: {}, // 模块别名
        charset: 'utf-8' // 加载模块所使用的字符编码
    };

    /* 模块加载器通用方法 */
    var moduleLoadGeneralFuncObj = {

        // 获取当前正在运行script文件的文件名(不带后缀名)
        getCurrentScriptName: function () {
            // 两种情况：
            // ie6-8可以通过script.readyState为interactive来得到当前正在运行的script文件名
            // firefox、chrome script.readyState为undefined，可通过异常捕获出错的方法然后使用正则匹配出错对象的stack出错信息得到出错的script文件名
            var stack, scriptName;

            try {
                (void 0)();
            } catch (e) {
                stack = e.stack;
            }

            // ie6-8的错误对象不存在stack属性，可以通过这个属性进行浏览器判断
            if (stack) {
                // 得到出错的文件名和错误行号和错误开始字符并且清空开始结尾空白字符
                stack = stack.split(errorTagExp).pop().replace(clearTrimExp, '');
                // 过滤掉错误行号和清空错误行号和错误字符开始位置
                return stack.replace(clearErrorLineAndStartExp, '').match(moduleTagExp)[1];
            }

            forEach(headElement.getElementsByTagName('script'))(function (scriptElement) {
                scriptElement.readyState === 'interactive' && (scriptName = scriptElement.src);
            });

            return scriptName.match(moduleTagExp)[1];
        },

        /**
         * 将模块标识(相对路径)和基础路径合并成真正的模块路径(不包括模块名和后缀名及其版本信息)
         *
         * @param {String} tag 模块标识
         * @param {String} url 路径
         * @return {String}
         * ===============================================
         * 合并规则
         * (tag = xx/md; url = aa/bb) => aa/bb/xx/md/
         * (tag = /xx/md; url = aa/bb) => aa/xx/md/
         * (tag = xx/md; url = http://www.xxoo.com/static/js/) => http://www.xxoo.com/static/js/xx/md/
         * (tag = /xx/md; url = http://www.xxoo.com/static/js/) => http://www.xxoo.com/static/xx/md/
         * ===============================================
         */
        mergeModulePath: function (tag, url) {
            var isRootDir = tag.charAt(0) === '/'; // 模板标识为/的相对路径
            var isAbsoluteUrl = protocolExp.test(url); // 基础路径是否是绝对路径
            var protocol = '', domain = '';
            var urlDirs, tagDirs;

            if (isAbsoluteUrl) {
                protocol = RegExp.$1;
                url = url.slice(protocol.length);

                if (protocol.indexOf('http') >= 0) {
                    domain = url.slice(protocol.length, url.indexOf('/') + 1);
                }

                url = isRootDir ? '' : url.slice(domain.length + 1);
            }

            // 将基础路径url以分隔符/拆分成数组
            urlDirs = url.split('/');
            urlDirs.pop();

            // 将模块标识(相对路径)以分隔符/拆分成数组
            tagDirs = tag.split('/');
            tagDirs.pop();

            isRootDir && tagDirs.shift();

            for (var i = 0, length = tagDirs.length; i < length; i++) {
                if (tagDirs[i] === '..') {
                    urlDirs.pop();
                } else if (tagDirs[i] !== '.') {
                    urlDirs.push(tagDirs[i]);
                }
            }

            // 将基础路径转化成字符串
            (urlDirs = (urlDirs.join('/'))) || (urlDirs = urlDirs + '/');

            return protocol + domain + urlDirs;
        },

        /*
        * 解析模块标识得到模块名及其后缀，在与baseUrl合并成模块路径，包括模块名和后缀名以及版本信息
        *
        * @param {String} tag 模块标识
        * @param {String} absoluteUrl 绝对路径
        * @return {String}
        * ===============================================
        * 合并规则
        * (tag = xx/md; absoluteUrl = http://www.xxoo.com/) => [md, http://www.xxoo.com/xx/md.js]
        * */
        getRealModulePathByTag: function (tag, absoluteUrl) {
            var isAbsoluteUrl = protocolExp.test(tag);
            var moduleTag = tag.match(moduleTagExp);
            var moduleName = moduleTag[1];
            var moduleSuffix = moduleTag[2] || '.js';
            var moduleQueryString = moduleTag[3] || '';
            var modulePath;

            if (isAbsoluteUrl) {
                absoluteUrl = tag;
                tag = '';
            }

            modulePath = this.mergeModulePath(tag, absoluteUrl);

            return [moduleName, modulePath + moduleName + moduleSuffix + moduleQueryString];
        }
    };

    /* 定义模块加载器 */
    var moduleLoad = {

        module: {},

        /**
         * 初始化模块加载器，获取data-main、data-baseurl
         */
        initialize: function () {
            var script, appModule, baseUrl;
            var currentPageUrl = root.location.href;

            if (document.currentScript) { // ie9、10、ff、chrome都支持通过document.currentScript获取当前正在运行的js文件，通过这种方式获取模块加载器
                script = document.currentScript;
            } else { // ie6-8
                script = Array.prototype.slice.call(document.getElementsByTagName('script'), -1)[0];
            }

            appModule = script.getAttribute('data-main'); // 获取入口模块
            baseUrl = script.getAttribute('data-baseurl'); // 获取基础路径

            moduleLoadConfig.baseUrl = baseUrl ?
                moduleLoadGeneralFuncObj.mergeModulePath(baseUrl, currentPageUrl) :
                currentPageUrl.slice(0, currentPageUrl.lastIndexOf('/') + 1); // 设置模块加载器的baseUrl，如果模块加载器属性节点提供了data-baseurl，就将data-baseurl和当前页面地址合并，反之直接取当前页面路径

            // 如果存在入口模块，则开始加载
            appModule && exports.use(appModule);
        }
    };

    var exports = {

        version: '1.0.0',

        use: function (tags, factory) {
            typeof tags === 'string' && (tags = [ tags ]);


        },

        define: function () {

        }
    };

    moduleLoad.initialize();

    return exports;
});