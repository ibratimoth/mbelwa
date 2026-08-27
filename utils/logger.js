// const pino = require('pino');
// const path = require('path');
// const fs = require('fs');

// // Safely ensure logs folder exists synchronously at boot time
// const logDirectory = path.join(__dirname, '..', 'logs');
// if (!fs.existsSync(logDirectory)) {
//   fs.mkdirSync(logDirectory, { recursive: true });
// }

// // Set up clean transports utilizing thread workers
// const transport = pino.transport({
//   targets: [
//     // STREAM 1: Output colorized pretty text logs directly to the live terminal console
//     {
//       level: process.env.LOG_LEVEL || 'info',
//       target: 'pino-pretty',
//       options: {
//         colorize: true,
//         translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
//         ignore: 'pid,hostname'
//       }
//     },
//     // STREAM 2: Pass plain text pretty logs to a daily rotating file destination
//     {
//       level: process.env.LOG_LEVEL || 'info',
//       target: 'pino-roll',
//       options: {
//         file: path.join(logDirectory, 'app'), // Becomes app.YYYY-MM-DD.log
//         frequency: 'daily',
//         ext: '.log',
//         mkdir: true,
//         limit: { count: 14 }, // Auto-deletes logs older than 2 weeks
        
//         // Tells pino-roll worker thread to apply text format printing right before appending bytes to file
//         transport: {
//           target: 'pino-pretty',
//           options: {
//             colorize: false, // Plain text is easier to search via tail, grep, or server text editors
//             translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
//             ignore: 'pid,hostname'
//           }
//         }
//       }
//     }
//   ]
// });

// // Construct the operational logger instance
// const logger = pino({
//   level: process.env.LOG_LEVEL || 'info',
//   base: { pid: false, hostname: false }
// }, transport);

// module.exports = logger;

const pino = require('pino');
const path = require('path');
const fs = require('fs');

const logDirectory = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

const transport = pino.transport({
  targets: [
    // STREAM 1: Human-readable colorized terminal output
    {
      level: process.env.LOG_LEVEL || 'info',
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname'
      }
    },
    // STREAM 2: Raw Line-by-Line JSON logs for ELK (Filebeat/Logstash) ingestion
    {
      level: process.env.LOG_LEVEL || 'info',
      target: 'pino-roll',
      options: {
        file: path.join(logDirectory, 'elk-json'), // Creates elk-json.YYYY-MM-DD.json
        frequency: 'daily',
        ext: '.json',
        mkdir: true,
        limit: { count: 7 } // Keeps a rolling 7 days of raw data
      }
    }
  ]
});

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Inject global fields so ELK can distinguish logs if you host multiple apps
  mix() {
    return {
      application: 'delle-gate-access-service',
      environment: process.env.NODE_ENV || 'production'
    };
  }
}, transport);

module.exports = logger;