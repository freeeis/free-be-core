module.exports = (app) => {
    app.__containers = [];
    app.__interfaces = [];


    /**
     * get content of a specified container
     */
    app.getContainerContent = (n) => {
        const ctn = app.__containers.find(c => c.name === n);
        return (ctn && ctn.content) || [];
    }


    /**
     * call a specific interface
     */
    app.callInterface = (n, ...args) => {
        const interface = app.__interfaces.find(i => i.name === n);

        if(interface) {
            return interface(...args)
        }
    }

    /**
     * register a container to the app, any other modules can insert elements to the container
     * 
     * mdl: the module which is the owner of the container
     * n: name of the container
     * d: description of the container
     * v: validators
     */
    app.registerContainer = (mdl, n, d, v) => {
        if (!n) {
            app.logger.error(`Failed to register container (${mdl ? mdl.name : ''} - ${n})`);
            return;
        }

        const existC = app.__containers.find(c => c.name === n);
        if (existC) {
            app.logger.error(`Container (${mdl ? mdl.name : ''} - ${n}) is already exist (${existC.mdl.name}).`);
            return;
        }

        if (app[`add${n.replace(/\s/g, '')}`]) {
            app.logger.error(`Container name is used already (${mdl ? mdl.name : ''} - ${n}).`);
            return;
        }

        const container = {
            module: mdl,
            name: n,
            description: d,
            content: []
        }

        app.__containers.push(container);

        /**
         * function for adding container content
         */
        app[`add${n.replace(/\s/g, '')}`] = (cts) => {
            if (!Array.isArray(cts)) cts = [cts];
            contentO: for (let i = 0; i < cts.length; i += 1) {
                const o = cts[i];

                const validators = [];
                if (typeof v === 'function') {
                    validators.push(v);
                } else if (Array.isArray(v)) {
                    v.forEach(vv => {
                        if (typeof vv === 'function') {
                            validators.push(vv);
                        }
                    })
                }

                for (let i = 0; i < validators.length; i += 1) {
                    const validator = validators[i];

                    if (!(validator(container, o))) {
                        // app.logger.error(`Add container content failed (${mdl ? mdl.name : ''} - ${n}).`);
                        // return;
                        continue contentO;
                    }
                }

                container.content.push(o);
            }
        }

        /**
         * get content of a specified container
         */
        app[`get${n.replace(/\s/g, '')}Content`] = (n) => {
            return container.content || [];
        }
    }


    /**
     * register public interface
     * 
     * mdl: the owner of the interface
     * n: name of the interface
     * f: the interface function
     * d: description of the interface
     */
    app.registerInterface = (mdl, n, f, d) => {
        if (!n || !f || typeof f !== 'function') {
            app.logger.error(`Failed to register interface (${mdl ? mdl.name : ''} - ${n})`);
            return;
        }

        const existC = app.__interfaces.find(c => c.name === n);
        if (existC) {
            app.logger.error(`Interface (${mdl ? mdl.name : ''} - ${n}) is already exist (${existC.mdl.name}).`);
            return;
        }

        if (app[`call${n.replace(/\s/g, '')}`]) {
            app.logger.error(`Interface name is used already (${mdl ? mdl.name : ''} - ${n}).`);
            return;
        }

        const interface = {
            module: mdl,
            name: n,
            description: d,
            func: f
        }

        app.__interfaces.push(interface);

        // function for calling an interface
        app[`call${n.replace(/\s/g, '')}`] = (...args) => {
            f(...args)
        }
    }
}
