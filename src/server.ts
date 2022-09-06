import { logger } from "./libs/logger";
import Hapi, { Request, ResponseToolkit } from "@hapi/hapi";
import { Server } from "@hapi/hapi";
import ETL from "./libs/etl";

export let server: Server;

export const init = async function (): Promise<Server> {
    server = Hapi.server({
        port: process.env.PORT || 4000,
        host: "0.0.0.0",
    });

    server.route({
        method: "POST",
        path: "/{transformerId}",
        handler: (req: Request, h: ResponseToolkit) => {
            const { transformerId } = req.params;

            logger.info({ transformerId }, "received webhook request");

            try {
                return h.response(new ETL(transformerId).process(req.payload));
            } catch (error) {
                return h.response({ error: error.message, payload: req.payload }).code(400);
            }
        },
    });

    return server;
};

export const start = async function (): Promise<void> {
    console.log(`Listening on ${server.settings.host}:${server.settings.port}`);
    return server.start();
};

process.on("unhandledRejection", (err) => {
    console.error("unhandledRejection");
    console.error(err);
    process.exit(1);
});
