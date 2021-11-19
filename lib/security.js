module.exports = (app) => {
    // security
    const helmet = require('helmet');
    app.use(helmet());
    app.disable('x-powered-by');
    app.set('trust proxy', true);
}