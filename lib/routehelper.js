const path = require('path');
const fs = require('fs');

function _createServiceObj (app, p) {
    try {
        return require(p);
    } catch (e) {
        app.logger.error(e);
        return undefined;
    }
}

module.exports = {
    routeGenerator: (app, mdl, api_root, service_root_path, route_name) => {
        return function read_router_folder (p, o) {
            if (!fs.existsSync(p)) return;

            const files = fs.readdirSync(p, {
                withFileTypes: true
            });

            for (let i = 0; i < files.length; i += 1) {
                const f = files[i];

                if (f.isDirectory()) {
                    const folder_path = path.join(p, f.name);
                    let folder_service = _createServiceObj(app, folder_path);

                    read_router_folder(folder_path, folder_service);

                    if (o)
                        o[f.name] = o[f.name] ? Object.merge(o[f.name], folder_service) : folder_service;
                    else
                        o = folder_service
                } else {
                    if (path.extname(f.name) === '.js' && f.name !== 'index.js') {
                        const api_path = p.slice(service_root_path.length);

                        let router = require(path.join(p, f.name));
                        if (router.isRouterFunc) {
                            router = router(app, mdl);
                        }

                        if (router) {
                            Object.defineProperty(router, 'name', { value: route_name || `${mdl.name}_router` });
                            Object.defineProperty(router, 'mdl', { value: mdl });
                            router.Config = (n) => {
                                if (mdl.config) return mdl.config[n];
                            }
                            router.Model = (n) => {
                                if (mdl.models) return mdl.models[n];
                            }

                            const routePath = ('/' + api_root + api_path).replace(/\\/g, '/').replace(/\/\//g, '/');

                            app.logger.debug(`Adding route: ${mdl.name}${path.join(p, f.name).substr(mdl.path.length)} ==> ${routePath}`);

                            app.use(routePath === '/' ? '' : routePath, router);

                            // TODO: register interface to the app
                        }
                    }
                }
            }
        };
    }
};
