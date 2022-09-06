import fs from "fs";

import ETL from "../libs/etl";

describe("sample transformer", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should transform the payload correctly", () => {
        const payload = {
            level1: {
                level2: {
                    string: "sample data 1",
                    number: "1",
                    regex: "there is {valuable data} inside this string",
                },
            },
        };

        const etl = new ETL("sample");
        const result = etl.process(payload);

        expect(result).toStrictEqual({
            data: {
                string: "sample data 1",
                number: 1,
                regex: "valuable data",
            },
        });

        expect(etl.getContext()).toStrictEqual({
            pathString: "sample data 1",
            pathNumber: "1",
            regex: "valuable data",
        });

        expect(etl.getTargets()).toContain("https://other-webhook.site/");
    });

    it("should return null in output when regex does not match with data", () => {
        const payload = {
            level1: {
                level2: {
                    string: "sample data 1",
                    number: "1",
                    regex: "empty",
                },
            },
        };

        const etl = new ETL("sample");
        const result = etl.process(payload);

        expect(result).toStrictEqual({
            data: {
                string: "sample data 1",
                number: 1,
                regex: null,
            },
        });
    });

    it("should handle invalid paths in payload with no data", () => {
        const payload = {
            level1: {
                string: "sample data 1",
                number: "1",
                regex: "there is {valuable data} inside this string",
            },
        };

        expect(() => {
            const etl = new ETL("sample");
            etl.process(payload);
        }).toThrow("no data found in payload path: level1.level2.string");
    });

    it("should handle invalid extractor types in the transformer JSON file", () => {
        const mockdata = {
            extractors: [
                {
                    type: "invalid-type",
                    path: "user.name",
                    output: "user",
                },
            ],
        };

        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "readFileSync").mockReturnValue({
            toString: jest.fn().mockReturnValue(JSON.stringify(mockdata)),
        } as any);

        const payload = {
            user: {
                id: 1,
                name: "transformers",
            },
        };

        expect(() => {
            const etl = new ETL("mocked");
            etl.process(payload);
        }).toThrow("invalid extractor type, should be: path or regex");
    });

    it("should throw an error if the transformer file does not exists", () => {
        expect(() => {
            new ETL("not-existing-file");
        }).toThrow("not-existing-file.json does not exists");
    });
});
