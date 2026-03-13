import pino from 'pino';

const env = process.env.NODE_ENV ?? 'development';
const level = process.env.LOG_LEVEL ?? 'info';

function buildLogger() {
  if (env === 'test') {
    return pino({ level: 'silent' });
  }

  if (env === 'production') {
    return pino({ level });
  }

  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
    },
  });
}

export const logger = buildLogger();
