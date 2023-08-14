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
        details: "GET /[key]?hash=[hash]\n" +
            "POST /[key]/[hash] BODY",
    });
});

app.get("/:key", (req, res) => {
    const data = readDataFromFile();
    const item = data[req.params.key];
    if (!item) {
        res.status(404).json({ok: true, error: "Not found"});
        return;
    }
    if (item.hash === req.query.hash) {
        res.status(304).json({ok: true});
        return;
    }
    res.json({ok: true, hash: item.hash, data: item.data});
});

app.post("/:key/:hash", (req, res) => {
    const data = readDataFromFile();
    data[req.params.key] = {data: req.body, hash: req.params.hash};
    saveDataToFile(data);
    res.json({ok: true});
});

app.delete("/:key", (req, res) => {
    const data = readDataFromFile();
    if (!data[req.params.key]) {
        res.status(404).json({ok: false, error: "Not found"});
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
