const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

let logger = createLogger({});

const simpleFormat = printf(info => {
    return `${info.timestamp} [${info.level}]: ${info.message}`;
});

if (process.env.NODE_ENV === 'production') {
    const prodctionFormat = printf(info => {
        const logObj = {};
        logObj.time = info.timestamp || new Date();
        logObj.level = info.level || 'unknown';
        logObj.msg = (info.message && info.message.toString()) || '';

        return JSON.stringify(logObj);
    });

    logger.add(new transports.File({
        format: prodctionFormat,
        filename: 'logs/error.log', level: 'error'
    }));

    logger.add(new transports.File({
        format: prodctionFormat,
        filename: 'logs/all_log.log', level: 'debug'
    }));

    logger.add(new transports.Console({
        format: combine(
            colorize(),
            timestamp(),
            simpleFormat,
        ),
        level: 'debug'
    }));
}
else if (process.env.NODE_ENV === 'development') {
    logger.add(new transports.Console({
        format: combine(
            colorize(),
            timestamp(),
            simpleFormat,
        ),
        level: 'debug'
    }));
}
// else if(process.env.NODE_ENV === 'test')
// {
//     logger.add(new transports.Console({
//         format: combine(
//             colorize(),
//             timestamp(),
//             simpleFormat,
//         ),
//         level:'debug'
//     }));
// }
else {
    logger.add(new transports.Console({
        format: combine(
            colorize(),
            timestamp(),
            simpleFormat,
        ),
        level: 'debug'
    }));
}

module.exports = logger;
