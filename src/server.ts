import express, {Express} from "express";
import cors from "cors";
import {readFile} from "fs/promises";
import {Config, configSchema} from "./config.js";
import {configDotenv} from "dotenv";
import swaggerUi from "swagger-ui-express";
// @ts-ignore
import swaggerDocument from "../swagger-output.json" assert {type: "json"};
import GPTCrawlerCore from "./core.js";
import {PathLike} from "fs";
import {randomUUID} from "node:crypto";

configDotenv();

const app: Express = express();
const port = Number(process.env.API_PORT) || 3000;
const hostname = process.env.API_HOST || "localhost";

app.use(cors());
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const completedJobs: {[uuid:string]: PathLike} = {}

// Define a POST route to accept config and run the crawler
app.post("/crawl", async (req, res) => {
    const config: Config = req.body;
    const id = randomUUID()
    config.outputFileName = id+'.json'
    try {
        const validatedConfig = configSchema.parse(config);
        const crawler = new GPTCrawlerCore(validatedConfig);
        crawler.crawl().then(() => crawler.write()).then((p => {
            completedJobs[config.outputFileName] = p
        }));
        return res.json({message: `Config is valid. Use GET /retrieve/${id} to get the results.`}).status(200);
    } catch (error) {
        return res
            .status(500)
            .json({message: "Error occurred during crawling", error});
    }
});

app.get("/retrieve/:id", async (req, res) => {
    const outputFileName = completedJobs[req.params.id];
    if (!outputFileName) {
        return res.json({message: "Job not yet completed or submitted."}).status(404);
    }
    try {
        const outputFileContent = await readFile(outputFileName, "utf-8");
        res.contentType("application/json");
        return res.send(outputFileContent);
    } catch (error) {
        return res
            .status(500)
            .json({message: "Error occurred during retrieving", error});

    }
});

app.listen(port, hostname, () => {
    console.log(`API server listening at http://${hostname}:${port}`);
});

export default app;
