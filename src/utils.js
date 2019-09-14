const path = require("path");
const fs = require("fs").promises;

const { NoDirectoryError } = require('./errors');
const APP_DATA = require('./appData');

module.exports = {

    getRepositoryPath(id) {
        return path.join(APP_DATA.FOLDER_PATH, '/', id);
    },

    async checkAndChangeDir(path) {
        const stats = await fs.stat(path);

        if (!stats.isDirectory()) {
            throw new NoDirectoryError();
        }

        process.chdir(path);
    },

    pipe({ from, to, onStderrData, onStdoutError }) {
        from.stderr.on('data', onStderrData);
        from.stdout.pipe(to);
        from.stdout.on('error', onStdoutError);
        to.on('close', function(){
            from.stdout.destroy();
            from.stderr.destroy();
        });
    },

    wrapRoute: fn => (...args) => fn(...args).catch(args[2])

};
