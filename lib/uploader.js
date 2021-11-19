const path = require('path');

module.exports = (app) => {
    // file uploads
    app.post(
        `${app.config.baseUrl}/upload`,
        app.modules.filehelper ? app.modules.filehelper.fileUpload : (req, res, next) => { return next();},
        app.modules.filehelper ? app.modules.filehelper.imageThumb(app.config.ImageThumbWidth || 300) : (req, res, next) => { return next(); },
        (req, res, next) => {
            if(!app.modules.filehelper) {
                return next();
            }

            if (!req.file) {
                res.makeError(400, 'Cannot recognize the uploaded file!');
                if (next)
                    return next('route');
            }

            res.addData({
                id: path.join(req.file.myDir, req.file.filename)
            })

            return next();
        }
    );
}