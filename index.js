/*
 * @Description: This is the core part of the module which will load all the modules specified in the config file
 * 
 * @Author: zhiquan <x.zhiquan@gmail.com>
 * @Date: 2021-08-03 08:42:06
 * @LastEditTime: 2023-03-07 14:47:08
 * @LastEditors: zhiquan
 */

const path = require("path");
const express = require(path.resolve('./') + "/node_modules/express");
const fs = require('fs');
const cookieParser = require("cookie-parser");
const logger = require(path.join(__dirname, "./lib/logger"));
const cache = require('memory-cache');
const morgan = require("morgan");

require('./lib/extend');
const builder = require('./builder');


/**
 * Load a module from the system.
 *
 * @param {Object} app the global app instancee
 * @param {String} name name of the module
 */
const _loadModule = function (app, md) {
    // load md and it's dependencies
    let mPath = "";
    let name = "";
    if (typeof md === "object") {
        mPath = md.path;
        name = md.name;
    } else {
        name = md;
    }

    if (app.moduleNames.findIndex(m => m === name) >= 0) return;

    // try to load module with the order: module in the modules folder, npm module, customer modules
    let mdl;
    let mdlFromConfig;
    let mdlPath;
    let errMsg = '';
    try {
        // in modules folder
        try{
            mdlFromConfig = require((mPath && `${mPath}/_freemodule.json`) || `${app.projectRoot}/modules/free-be-${name}/_freemodule.json`);
        } catch(ex){}
        
        mdl = require(mPath || `${app.projectRoot}/modules/free-be-${name}`);
        mdlPath = mPath || `${app.projectRoot}/modules/free-be-${name}`;
    } catch (ex) {
        errMsg += `\n${ex}\n`;

        try {
            if ([
                'core'
            ].indexOf(name) >= 0) {
                throw new Error('such module should not be loaded from here!')
            }

            // npm module
            try {
                mdlFromConfig = require((mPath && `${mPath}/_freemodule.json`) || `${app.projectRoot}/node_modules/free-be-${name}/_freemodule.json`);
            } catch (ex) { }

            mdl = require(mPath || `${app.projectRoot}/node_modules/free-be-${name}`);
            mdlPath = mPath || `${app.projectRoot}/node_modules/free-be-${name}`;
        } catch (exx) {
            errMsg += `${exx}\n`;

            try {
                // customer moduels in modules folder
                try {
                    mdlFromConfig = require((mPath && `${mPath}/_freemodule.json`) || `${app.projectRoot}/modules/${name}/_freemodule.json`);
                } catch (ex) { }

                mdl = require(mPath || `${app.projectRoot}/modules/${name}`);
                mdlPath = mPath || `${app.projectRoot}/modules/${name}`;
            } catch (exxx) {
                errMsg += `${exxx}`;

                app.logger.error(
                    `Failed to load module: ${name}. ${errMsg}`
                );
                return;
            }
        }
    }

    mdl = Object.merge({}, mdl, mdlFromConfig);
    // Object.assign(mdl, mdlFromConfig);

    if (!mdl) return;

    if (typeof mdl === 'function') mdl = mdl(app);
    mdl.path = mdlPath;

    // attach the app instance to the module instance.
    mdl.app = app;

    // set the name of the module, in case this name is different from the default one, which means the user changed the name in config.
    // so that we can get the real name of the module from any code of itself.
    mdl.name = name;

    // set the merged config, the final one, of the module to the module instance.
    mdl.config = Object.merge({}, mdl.config, app.config[name]);

    // add all i18n translations
    if (mdl.i18n) {
        mdl.t = (v, l) => {
            if (!l) l = app.ctx.locale || app.config['defaultLocale'] || 'zh-cn';
            if (typeof v === 'string')
                return mdl.i18n[l] ? (typeof mdl.i18n[l][v] === 'undefined' ? v : mdl.i18n[l][v]) : v;
            else if (typeof v === 'object') {
                const outObj = {};
                Object.keys(v).forEach(s => {
                    outObj[s] = mdl.t(v[s]);
                });
                return outObj;
            } else {
                return v;
            }
        }
    } else {
        mdl.t = (v) => {
            return v;
        }
    }

    // add the module to the modules list in the app instance.
    app.modules[name] = mdl;

    mdl.config &&
        mdl.config.dependencies &&
        mdl.config.dependencies.forEach(d => {
            _loadModule(app, d);
        });

    if (app.moduleNames.indexOf(name) < 0) {
        app.moduleNames.push(name);
    }

    app.logger.debug(`Loaded module ${name}.`);
};

/**
 * Run a specific hook function from all modules, in the order according to the dependency relationship.
 *
 * @param {Object} app the global app instance
 * @param {String} name the hook name to be called
 */
const _runHook = function (app, name) {
    for (let i = 0; i < app.moduleNames.length; i += 1) {
        const m = app.modules[app.moduleNames[i]];
        m && m.hooks && m.hooks[name] && m.hooks[name](app, m);
    }
};

module.exports = {
    onBegin: app => {
        app.logger = logger;
        app.cache = cache;
        app.projectRoot = path.resolve('./');

        // application context, all context related information can be stored here.

        app.ctx = {
            version: require(path.resolve('./') + "/package.json").version || '0.0.1',
            serviceList: {}
        };

        app.utils = require(path.resolve('./') + '/utils');

        // all configurations stored in app.config, include config for each module which will overwrite the config in the module itself.
        app.config = Object.merge(
            {},
            require(require('path').resolve('./') + "/config/config.default"),
            require(`${require('path').resolve('./')}/config/config.${process.env.NODE_ENV}`)
        );

        // injection
        require('./lib/injection')(app);

        // load modules, merge configurations, get ordered modules according to the dependency relationship, etc.
        app.config.modules = app.config.modules || [];
        app.modules = {};
        app.moduleNames = [];
        app.config.modules.forEach(m => {
            _loadModule(app, m);
        });

        // check each module that we have all the 'followedBy' in the module list
        Object.keys(app.modules).forEach(mk => {
            const m = app.modules[mk];
            let followedBy = [];
            m && m.config && (followedBy = m.config.followedBy || []);

            const mIndex = app.moduleNames.indexOf(mk);
            followedBy.forEach(f => {
                if (app.moduleNames.indexOf(f) < mIndex) {
                    throw new Error(`${f} should be after ${mk} to be loaded!`);
                }
            });
        });

        // run onBegin hook of each module, include their dependencies
        _runHook(app, "onBegin");
    },
    loadModules: () => {
        // make a complete list of the dependencies and injections of each module
        // app.logger.debug(JSON.stringify(app.config.modules));

    },
    onModulesReady: app => {
        // hook!
        _runHook(app, "onModulesReady");

        // setup global middleware
        app.use(morgan("dev"));

        app.use(express.json({ limit: app.config['bodySizeLimit'] || "10mb" }));
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());
        (app.config['staticFolders'] || []).forEach(s => {
            app.use(app.config['assetsUrlPrefix'] || '/assets', express.static(s, app.config['staticOptions'] || {}));
        })

        // security
        require("./lib/security")(app);

        // add some common function to response
        app.use(async function (req, res, next) {
            res.locals = res.locals || {};
            res.locals.data = res.locals.data || {};
            res.locals.filter = res.locals.filter || {};
            res.locals.options = res.locals.options || {};
            res.locals.fields = res.locals.fields || [];

            // add some function to the response
            res.endWithErr = async function (code, msg) {
                if (typeof msg === 'number') msg = { code: msg };
                this.status(code).send({ msg: msg });
            };

            res.endWithData = function (data, msg = app.config['defaultResponseMessage'] || "OK") {
                this.status(200).send({ data, msg: msg });
            };

            res.addData = function (data, overwrite = true) {
                if (overwrite) {
                    res.locals.data = data;
                } else {
                    if (typeof data !== 'object' || Array.isArray(data)) {
                        app.logger.error(`Data should be an object! (${req.originalUrl})`)
                    }

                    Object.merge(res.locals.data, data);
                }
            };

            res.Module = (n) => {
                if (!n) return undefined;
                return res.app.modules && res.app.modules[n];
            }

            res.makeError = function (code, msg = "", mdl) {
                if (typeof msg === 'number') msg = { code: msg };
                res.locals.err = { code: code, msg: msg, mdl: mdl };
            };

            res.logger = logger;

            return next();
        });

        // Handle unhandledRejection and pass error to next middleware
        app.use(function (req, res, next) {
            function unhandledRejection (reason) {
                logger.error("Uncaught exception: " + reason.message || reason);

                res.makeError(
                    500,
                    req.app.get("env") === "production"
                        ? "System error, please contact with the system administrator!"
                        : reason.message || reason
                );
                next("route");
            }

            if (process.env.NODE_ENV === "test") {
                // Un-limit event listeners for testing env only.
                // Don't set this for production environment due to potential memory leak.
                process.setMaxListeners(0);
            }

            process.on("unhandledRejection", unhandledRejection);

            // Manage to get information from the response too, just like Connect.logger does:
            const end = res.end;
            res.end = function (chunk, encoding) {
                // Prevent MaxListener on process.events
                process.removeListener("unhandledRejection", unhandledRejection);
                res.end = end;
                res.end(chunk, encoding);
            };

            return next();
        });

        // by default canI will always return true;
        app.post(`${app.config['baseUrl'] || ''}/can_i`,
            (req, res, next) => {
                res.addData({ can: true });

                return next();
            }
        );

        // file upload
        require("./lib/uploader")(app);
    },
    onAppReady: app => {
        const { buildData } = app.freeBuilder || builder;
        // hook!
        _runHook(app, "onAppReady");

        // init the database table schema if the module has.
        Object.keys(app.modules).forEach(k => {
            const m = app.modules[k];
            if (!m) return;

            // build from config
            buildData(m);

            m.data && app.db && app.db.initModuleSchema && app.db.initModuleSchema(app, m);
        })

        _runHook(app, "onDBSchemaReady");

        // init the database models if the module has.
        Object.keys(app.modules).forEach(k => {
            const m = app.modules[k];
            if (!m) return;

            m.data && app.db && app.db.initModuleModel && app.db.initModuleModel(app, m);
        })

        _runHook(app, "onDBReady");
    },
    onLoadRouters: app => {
        // hook!
        _runHook(app, "onLoadRouters");
    },
    loadRouters: app => {
        const { buildPreData, buildApis, buildActions, buildStore, buildForConfig } = app.freeBuilder || builder;

        // load router from all the modules, according to the dependency relationship and the order in the config file.
        const routeGenerator = require("./lib/routehelper").routeGenerator;

        let service_list = [];

        for (let i = 0; i < app.moduleNames.length; i += 1) {
            const m = app.modules[app.moduleNames[i]];
            let moduleServiceList = {};
            let moduleService = {};
            let mInfo = {};

            if (!m) continue;

            // build from config
            buildPreData(m);

            const routeFolderPath = path.join(m.path, "routers");

            let routeRoot = (m.config && m.config["routeRoot"]);
            if (typeof routeRoot === 'undefined')
                routeRoot = m.name || "";

            const existRouteRootIndex = service_list.findIndex(s => s.service[routeRoot]);

            if (fs.existsSync(routeFolderPath)) {
                mInfo = require(routeFolderPath);
                // if this module is not a route service and we don't have any other route service with the same route root
                // we don't need to load these routers.
                if ((!m.config || !m.config['asRouteService']) && existRouteRootIndex < 0) {
                    continue;
                }

                const generator = routeGenerator(
                    app,
                    m,
                    `${app.config['baseUrl']}/${routeRoot}`,
                    routeFolderPath
                );

                generator(routeFolderPath, moduleServiceList);
            }

            // build from config
            buildApis(m, moduleServiceList, `${app.config['baseUrl']}/${routeRoot}`);
            buildActions(m);
            buildStore(m);
            buildForConfig(m);

            // wrap the service list with the module, and set the module level service name if needed.
            moduleService[routeRoot] = {
                ...moduleServiceList
            };

            if (m.config && m.config['asRouteService']) {
                // this module is the service root (for routers), so we set the service title as this module
                Object.merge(moduleService[routeRoot], {
                    title: (mInfo && mInfo.title) || m.name || app.moduleNames[i],
                    description: (mInfo && mInfo.description) || ''
                });
            }

            // if we already have service with the same route root, we need to merge.
            if (existRouteRootIndex >= 0) {
                const existRouteRoot = service_list[existRouteRootIndex].service;
                service_list[existRouteRootIndex].service = Object.merge(existRouteRoot, moduleService);
            } else {
                // merge the module level service list to the app level service list
                service_list.push({ service: moduleService, mdl: m });
            }
        }

        app.service_list = service_list;
        app.ctx.serviceList = () => {
            const list = {};
            const sl = app.service_list;
            for (let i = 0; i < sl.length; i += 1) {
                const s = sl[i];
                Object.merge(list, s.mdl.t(s.service));
            }
            return list;
        };
    },
    onRoutersReady: app => {
        // hook!
        _runHook(app, "onRoutersReady");

        // real db operations
        app.db && app.use(app.db.dataProcessMiddleware);

        // hook!
        _runHook(app, "beforeLastMiddleware");

        // return data to client or catch error and forward to error handler
        app.use(function last_catch_middleware (req, res, next) {
            // return client request
            if (res._headerSent) {
                return next();
            }

            let code = 0,
                msg = "",
                data = {};

            if (res.locals.err) {
                code = res.locals.err.code;
                msg = res.locals.err.msg;
            } else if (res.locals.data) {
                code = 200;
                data = res.locals.data;
                msg = res.locals.msg;
            }

            code = code || 404;

            if (code === 404) {
                if (req.originalUrl.startsWith(app.config['assetsUrlPrefix'] ? app.config['assetsUrlPrefix'] + '/' : '/assets/')) code = 200;
            }

            let returnData = (code === 200)
                ? { data, msg: (msg || app.config['defaultResponseMessage'] || "OK") }
                : { msg };

            returnData = Object.assign({}, returnData, res.locals.persData);

            res.status(code).send(returnData);

            res.locals.return = {
                code, returnData
            }

            return next();
        });

        // hook!
        _runHook(app, "afterLastMiddleware");
    }
};