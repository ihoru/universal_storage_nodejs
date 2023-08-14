import fs from "fs";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import {ArgumentParser} from "argparse";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const {version} = require("./package.json");


const parser = new ArgumentParser({
    description: "Universal data store server",
});
parser.add_argument("-v", "--version", {action: "version", version});
parser.add_argument("-p", "--port", {help: "Listen to port", default: 9995});
parser.add_argument("-d", "--data", {help: "Data file", default: "data.json"});

const args = parser.parse_args();

const app = express();
const PORT = args.port;
const FILE_NAME = args.data;

app.use(bodyParser.json());
app.use(cors());

app.get("/", (req, res) => {
    res.json({
        ok: true,
        version,
        description: parser.description,
        details: "GET /[key]?timestamp=[timestamp]\n" +
            "POST /[key]/[timestamp] BODY",
    });
});

app.get("/:key", (req, res) => {
    const data = readDataFromFile();
    const item = data[req.params.key];
    if (!item) {
        res.json({ok: false, status: 404, error: "not_found"});
        return;
    }
    const localTimestamp = parseInt(item.timestamp) || 0;
    const externalTimestamp = parseInt(req.query.timestamp) || 0;
    if (localTimestamp && externalTimestamp && localTimestamp === externalTimestamp) {
        res.status(304).json({ok: true});
        return;
    }
    res.json({ok: true, timestamp: item.timestamp, data: item.data});
});

app.post("/:key/:timestamp", (req, res) => {
    const data = readDataFromFile();
    const timestamp = parseInt(req.params.timestamp) || 0;
    const oldTimestamp = parseInt(req.query.oldTimestamp) || 0;
    const item = data[req.params.key];
    if (item && item.timestamp > oldTimestamp) {
        res.json({ok: false, timestamp: item.timestamp, data: item.data, error: "timestamp_too_old"});
        return;
    }
    data[req.params.key] = {data: req.body, timestamp: timestamp};
    saveDataToFile(data);
    res.json({ok: true});
});

app.use((req, res, next) => {
    res.status(404).json({ok: false, status: 404, error: "unknown_path", path: req.path});
});

app.delete("/:key", (req, res) => {
    const data = readDataFromFile();
    if (!data[req.params.key]) {
        res.json({ok: false, status: 404, error: "not_found"});
        return;
    }
    delete data[req.params.key];
    saveDataToFile(data);
    res.json({ok: true});
});

function readDataFromFile() {
    try {
        const data = fs.readFileSync(FILE_NAME, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error(error);
        return {};
    }
}

function saveDataToFile(data) {
    fs.writeFileSync(FILE_NAME, JSON.stringify(data, null, 4), "utf8");
}

app.listen(PORT, () => {
    console.log(`Server started: http://localhost:${PORT}/`);
});
