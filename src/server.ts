import { Server } from "@hapi/hapi";
import Hapi, { Request, ResponseToolkit } from "@hapi/hapi";
import axios from "axios";
import Handlebars from "handlebars";
import ETL from "./libs/etl";
import { logger } from "./libs/logger";

export let server: Server;

export const init = async function (): Promise<Server> {
    server = Hapi.server({
        port: process.env.PORT || 4000,
        host: "0.0.0.0",
    });

    server.route({
        method: "POST",
        path: "/{transformerId}",
        handler: async (req: Request, h: ResponseToolkit) => {
            const { transformerId } = req.params;

            logger.info({ transformerId }, "received webhook request");

            try {
                const transformer = new ETL(transformerId);
                const payload = transformer.process(req.payload);
                const context = transformer.getContext();

                for (const target of transformer.getTargets()) {
                    const template = Handlebars.compile(target);
                    const url = template(context);
                    await axios.post(url, payload);
                }

                return h.response({ payload, targets: transformer.getTargets() });
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
