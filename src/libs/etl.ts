import { logger } from "./logger";
import fs from "fs";
import path from "path";

interface ExpressionGroup {
    expression: string;
    variable: string;
    type: "string" | "number";
}

interface Replacement {
    expression: string;
    value: string;
}

interface Extractor {
    type: "regex" | "path";
    path: string;
    regex: string;
    output: string;
}

interface Transformer {
    id: string;
    extractors: Extractor[];
    output: string;
    targets: string[];
}

interface Context {
    [key: string]: string;
}

const resolvePath = (object: Object, path: string, defaultValue: any = null): string =>
    path.split(".").reduce((o, p) => (o ? o[p] : defaultValue), object);

export default class ETL {
    transformer: Transformer;
    context: Context;

    constructor(jsonfile: string) {
        const relativePath = path.relative(process.cwd(), `src/transformers/${jsonfile}.json`);

        logger.debug({ path: relativePath }, "searching for transformer file in directory");

        if (!fs.existsSync(relativePath)) {
            logger.error({ path: relativePath }, "file not found in transformers directory");
            throw new Error(`Transformer ${jsonfile}.json does not exists in transformers directory`);
        }

        this.transformer = JSON.parse(fs.readFileSync(relativePath).toString());
        this.context = {};
    }

    getTargets = (): string[] => {
        if (!this.transformer.targets || this.transformer.targets.length === 0) return [];
        return this.transformer.targets;
    };

    getContext = (): Context => {
        return this.context;
    };

    process = (payload: Object) => {
        logger.debug({ transformer: this.transformer }, "using transformer");
        logger.debug({ payload }, "extracting data from payload");

        for (const extractor of this.transformer.extractors) {
            logger.debug({ extractor }, "processing extractor");

            const input = resolvePath(payload, extractor.path);
            logger.debug({ path: extractor.path, data: input }, "data in payload path");

            if (!input) {
                logger.error({ path: extractor.path }, "no data found in payload path");
                throw new Error(`no data found in payload path: ${extractor.path}`);
            }

            switch (extractor.type) {
                case "path": {
                    logger.debug("extracting using path");
                    this.context[extractor.output] = input;
                    logger.debug({ context: extractor.output, value: input }, "extraction result");
                    break;
                }

                case "regex": {
                    logger.debug("Extracting using Regex");
                    const regex = new RegExp(decodeURI(extractor.regex), "g");
                    const match = Array.from(input.matchAll(regex), (m) => m[1]);
                    logger.debug({ context: extractor.output, value: match[0] }, "extraction result");
                    this.context[extractor.output] = match[0] || null;
                    break;
                }

                default: {
                    logger.error({ type: extractor.type }, "invalid extractor type, expecting regex or path");
                    throw new Error("invalid extractor type, should be: path or regex");
                }
            }
        }

        logger.debug({ context: this.context }, "context from extraction");

        const outputString = JSON.stringify(this.transformer.output);
        const regex = /(?<expression>"{{(?<variable>\w+):(?<type>\w+)}}")/g;
        const replaceTargets = outputString.matchAll(regex);

        const replacements: Replacement[] = [];
        for (const replaceTarget of replaceTargets) {
            const exp: ExpressionGroup = replaceTarget.groups as unknown as ExpressionGroup;

            let value = "";
            if (exp.type === "string") value = `"${this.context[exp.variable]}"`;
            if (exp.type === "number") value = `${this.context[exp.variable]}`;

            if (!this.context[exp.variable]) value = "null";

            replacements.push({
                expression: exp.expression,
                value,
            });
        }

        logger.debug(
            { replacements, payload: this.transformer.output },
            "making the following replacements in output payload"
        );

        let output = outputString;
        for (const replacement of replacements) output = output.replace(replacement.expression, replacement.value);

        return JSON.parse(output);
    };
}
