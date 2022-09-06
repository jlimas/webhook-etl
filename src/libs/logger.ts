import pino from "pino";

export const logger = pino({
    level: process.env.LOGGER__LEVEL || "info",
});
