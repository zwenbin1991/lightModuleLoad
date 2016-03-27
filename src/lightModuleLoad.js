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

    var protocolExp = /(file:\/*?[a-z]:|http:\/+)/i; // 匹配模块绝对路径协议
    var moduleTagExp = /([^/?]*?)(\.(?:css|js))?(\?.*)?$/i; // 匹配模块名、后缀名和其他信息
    var errorTagExp = /(@|at)/i; // 错误信息chrome和ie>8是at，ff和opera是@
    var clearTrimExp = /^\s+|\s+$/g; // 清空开始和结尾空白
    var clearErrorLineAndStartExp = /(:\d+)?:\d+$/; // 清空错误行号和错误字符开始位置

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
        var results = [], each, proto, prop;

        for (var key in object) {
           hasOwnProperty.call(object, key) && results.push(key);
        }

        if (hasEnumBug) {
            proto = object.__proto__ || object.constructor.prototype;
            each =  forEach(noEnumProps);
            each(function (prop, i) {
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

    /* 模块加载器的配置对象，可通过开发人员自定义 */
    var moduleLoadConfig = {
        baseUrl: '', // 模块基础路径
        alias: {}, // 模块别名
        charset: 'utf-8' // 加载模块所使用的字符编码
    };

    /* 模块加载器 */
    var moduleLoadGeneralFuncObj = {

        //获取当前正在运行script文件的文件名(不带后缀名)
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
        }
    }

});