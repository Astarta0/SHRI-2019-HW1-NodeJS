const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const bodyParser = require('body-parser');

const util = require('util');
const { exec } = require('child_process');
const promisifyExec = util.promisify(exec);

const router = require('./src/server/reposRouter');
const APP_DATA = require('./src/server/appData');

const app = express();

function checkFolderPath(folderPath) {
    folderPath = path.normalize(folderPath);
    if (!path.isAbsolute(folderPath)) {
        throw new Error('Path to folder must be absolute!');
    }
    return folderPath;
}

const { path: folderPath } = require(`yargs`)
    .usage('Usage: node $0 --path <path>')
    .option('p', {
        alias: 'path',
        describe: 'Absolute path to folder with repositories',
        coerce: checkFolderPath,
        demandOption: true,
    })
    .fail(function(msg, err, yargs) {
        console.error(msg, '\n');

        if (err) {
            console.error(err.stack || err.message);
        }

        console.error(yargs.help());
        process.exit(1);
    })
    .help()
    .alias('h', 'help').argv;

// Проверяем, существует ли папка.
fs.stat(folderPath)
    .then(stats => {
        if (!stats.isDirectory()) {
            console.error('Provided path is not directory!', '\n');
            process.exit(1);
        }
    })
    .catch(error => {
        // Если папки нет - мы окажемся здесь и создадим ее.
        return fs.mkdir(folderPath, { recursive: true });
    })
    .then(() => {
        // Установлен ли гит
        return promisifyExec('which git');
    })
    .then(({ stdout }) => {
        if (!stdout) {
            console.error('Git is not installed!', '\n');
            process.exit(1);
        }

        APP_DATA.FOLDER_PATH = folderPath;

        // Успешный запуск
        app.listen(3000, () => {
            console.log('Server listening on port 3000!');
        });
    })
    .catch(error => {
        console.error('Folder cannot be created!');
        console.error(error.stack || error.message);
        process.exit(1);
    });

app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('hello :3 \n');
});

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use('/api/repos/', router);
