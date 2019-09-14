const express = require('express');
const path = require("path");
const fs = require("fs").promises;
const bodyParser = require("body-parser");

const router = require('./src/reposRouter');
const APP_DATA = require('./src/appData');

const app = express();

function checkFolderPath(folderPath) {
    folderPath = path.normalize(folderPath);
    if (!path.isAbsolute(folderPath)) {
        throw new Error('Path to folder must be absolute!');
    }
    return folderPath;
}

const { path: folderPath } = require(`yargs`)
    .usage("Usage: node $0 --path <path>")
    .option("p", {
        alias: "path",
        describe: "Absolute path to folder with repositories",
        coerce: checkFolderPath,
        demandOption: true
    })
    .fail(function (msg, err, yargs) {
        console.error(msg, "\n");

        if (err) {
            console.error(err.stack || err.message);
        }

        console.error(yargs.help());
        process.exit(1);
    })
    .help()
    .alias("h", "help")
    .argv;

// Проверяем, существует ли папка. Если нет - создаем.
fs.stat(folderPath)
    .then(stats => {
        if (!stats.isDirectory()) {
            console.error("Provided path is not directory!", "\n");
            process.exit(1);
        }
    })
    .catch(error => {
        return fs.mkdir(folderPath, { recursive: true });
    })
    .then(() => {

        APP_DATA.FOLDER_PATH = folderPath;

        // Успешный запуск
        app.listen(3000, () => {
            console.log('Server listening on port 3000!');
        });
    })
    .catch(error => {
        console.error("Folder cannot be created!");
        console.error(error.stack || error.message);
        process.exit(1);
    });

app.use(bodyParser.json());

app.get('/', (req, res) => {
    // Send the rendered page back to the client
    res.send('hello\n');
});

app.use('/api/repos/', router);
