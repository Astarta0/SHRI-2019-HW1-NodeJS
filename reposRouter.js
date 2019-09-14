const express = require('express');
const path = require("path");
const fs = require("fs").promises;
const { exec, spawn } = require('child_process');
const util = require('util');
const rimraf = require('rimraf');
const junk = require('junk');

const promisifyExec = util.promisify(exec);

const APP_DATA = require('./appData');

const router = express.Router();

// '/' === '/api/repos/'
// Возвращает массив репозиториев, которые имеются в папке.
router.get('/', async (req, res) => {

    try {
        let files = await fs.readdir(APP_DATA.FOLDER_PATH);
        files = files.filter(junk.not);

        let statsArr = await Promise.all(files.map(file => {
            return fs.stat(path.join(APP_DATA.FOLDER_PATH, '/', file))
                .then(stat => {
                    return {
                        file,
                        stat
                    };
                })
                .catch(err => err)
        }));

        statsArr = statsArr.filter(sObj => !(sObj instanceof Error))
            .filter(sObj => sObj.stat.isDirectory())
            .map(sObj => sObj.file);

        res.json({ folders: statsArr });

    } catch (err) {
        console.error(err);
        res.status(501).json({ error: err.message || "An error occurred while trying to read the directory" });
    }

});

// Добавляет репозиторий в список, скачивает его по переданной в теле запроса ссылке и добавляет в папку со всеми репозиториями.
router.post('/:repositoryId', async (req, res) => {

    const { url } = req.body;
    const { repositoryId } = req.params;

    const targetDir = path.join(APP_DATA.FOLDER_PATH, '/', repositoryId);

    // TODO https://serverfault.com/a/665959
    // но у меня такое не воспроизводилось
    try {
        const { stdout, stderr } = await promisifyExec(`GIT_TERMINAL_PROMPT=0 git clone ${url} ${targetDir}`);
        res.json({ status: 'OK' });
    } catch (error) {
        console.error(error);
        res.status(501).json({ error: error.message || "An error occurred while trying to clone the repository" });
    }
});

// Безвозвратно удаляет репозиторий
router.delete('/:repositoryId', (req, res) => {
    const { repositoryId } = req.params;

    const targetDir = path.join(APP_DATA.FOLDER_PATH, '/', repositoryId);

    rimraf(targetDir, function(error) {
        if (error) {
            res.status(501).json({ error: error.message || "An error occurred while trying to delete the directory" });
        } else {
            res.json({ status: 'OK' });
        }
    });
});

// GET /api/repos/:repositoryId/commits/:commitHash
// Возвращает массив коммитов в данной ветке (или хэше коммита) вместе с датами их создания.
router.get('/:repositoryId/commits/:commitHash', async (req, res) => {
    const { repositoryId, commitHash } = req.params;

    const targetDir = path.join(APP_DATA.FOLDER_PATH, '/', repositoryId);

    // TODO: сделать очередь,
    // чтобы избежать конфликта, когда приходит другой запрос и выполняет чекаут на другую ветку,
    // а гит лог первого выводит информацию не по запрашиваемой ветке

    // Проверим, что папка существует
    try {
        const stats = await fs.stat(targetDir);

        if (!stats.isDirectory()) {
            res.status(400).json({ error: "The provided parameter is not directory name!" });
            return;
        }

        process.chdir(targetDir);

        await promisifyExec(`git checkout ${commitHash}`);

        const { stdout, stderr } = await promisifyExec(`git log --pretty=format:'{%n%h%n%s%n%aN%n%cN%n%at%n}%n'`);

        const commits = stdout.match(/\{\n([\s\S]*?)\n\}/g);
        if (!commits) {
            res.json({ commits: [] });
            return;
        }

        const resultCommits = commits.map(commit => commit.match(/\{\n(.*?)\n(.*?)\n(.*?)\n(.*?)\n(.*?)\n\}/))
            .map(([all, hash, subject, author, commiter, date]) => ({
                hash, subject, author, commiter, date
            }));

        // TODO: сейчас дата в timestamp, преобразование будет на стороне клиента
        res.json({ commits: resultCommits });

    } catch (err) {
        // TODO:
        // При попытке чекаута в несуществующую ветку/коммит, будет ошибка вида:
        // err.message: "Command failed: git checkout feature2\nerror: pathspec 'feature2' did not match any file(s) known to git\n"
        // в этом случае - возвращать 400 - bad request и сообщение об ошибке более корректное
        console.error(err);
        res.status(501).json({ error: err.message || "No such file or directory!" });
    }
});

// GET /api/repos/:repositoryId/commits/:commitHash/diff
// Возвращает diff коммита в виде строки.
router.get('/:repositoryId/commits/:commitHash/diff', async (req, res) => {
    const { repositoryId, commitHash } = req.params;

    const targetDir = path.join(APP_DATA.FOLDER_PATH, '/', repositoryId);

    try {
        const stats = await fs.stat(targetDir);

        if (!stats.isDirectory()) {
            res.status(400).json({error: "The provided parameter is not directory name!"});
            return;
        }

        process.chdir(targetDir);

        const { stdout: commitParent, stderr } = await promisifyExec(`git show ${commitHash} --pretty=format:'{%p}' --quiet`);

        const parent = /\{.+\}/i.test(commitParent) ? `${commitHash}~` : `4b825dc642cb6eb9a060e54bf8d69288fbee4904`;

        const gitProcess = spawn('git', ['diff', parent, commitHash ]);

        res.setHeader("Content-Type", "text/plain; charset=utf-8");

        gitProcess.stderr.setEncoding('utf8');
        gitProcess.stdout.setEncoding('utf8');

        gitProcess.stderr.on('data', data => {
            console.error(data);
            res.status(404).json({error: data});
        });

        gitProcess.stdout.pipe(res);

        gitProcess.stdout
            .on('error', err => {
                res.statusCode = 500;
                res.end("Server Error");
                console.error(err);
            });

        res.on('close', function(){
            gitProcess.stdout.destroy();
            gitProcess.stderr.destroy();
        });

    } catch (err) {
        console.error(err);
        res.status(501).json({error: err.message || "No such file or directory!"});
    }
});


// GET /api/repos/:repositoryId(/tree/:commitHash/:path)
// Возвращает содержимое репозитория по названию ветки (или хэшу комита).
// Параметр repositoryId - название репозитория (оно же - имя папки репозитория).
// Eсли отсутствует и branchName, и path - отдать актуальное содержимое в корне в главной ветке репозитория.
router.get(/^\/([^\/]+)(?:\/tree(?:\/([^\/]+)(\/.*)?)?)?$/, async (req, res) => {

    let { '0': repositoryId, '1': commitHash, '2': repoPath } = req.params;

    const targetDir = path.join(APP_DATA.FOLDER_PATH, '/', repositoryId);

    try {
        const stats = await fs.stat(targetDir);

        if (!stats.isDirectory()) {
            res.status(400).json({ error: "The provided parameter is not directory name!" });
            return;
        }

        process.chdir(targetDir);

        let mainBranch = commitHash;

        if(!commitHash) {
            const { stdout: mainBranchName, stderr } = await promisifyExec(`git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`);

            if (!mainBranchName) {
                res.status(400).json({error: "There are no any branches in you repository yet!"});
                return;
            }
            mainBranch = mainBranchName;
        }

        const { stdout: stdoutCheckout, stderr: stderrCheckout } = await promisifyExec(`git checkout ${mainBranch}`);

        // если хеш коммита - нельзя выполнить pull, чтобы получить последнее актуальное состояние
        // получаем список веток и смотрим передали нам имя ветки или хеш коммита
        let { stdout: remoteBranches, stderr: stderrRemoteBranches } = await promisifyExec(`git branch --remotes --format='%(refname:lstrip=-1)' | grep -v '^HEAD$'`);

        remoteBranches = remoteBranches.split('\n');
        const isBranchName = remoteBranches.includes(commitHash);

        if(isBranchName) {
            const { stdout: stdoutPull, stderr: stderrPull } = await promisifyExec(`git pull`);
        }

        repoPath = repoPath || '';
        repoPath = repoPath.endsWith('/') ? repoPath.slice(1) : repoPath.slice(1) + '/';

        const { stdout: stdoutLstree, stderr: stderrLstree } = await promisifyExec(`git ls-tree ${mainBranch} ${repoPath}`);

        const content = stdoutLstree.split('\n').filter(str => str).map(str => {
            const [, type,, name] = str.split(/\s/g);
            return {
                type,
                name
            };
        });

        res.json({ content });
    } catch(err) {
        console.error(err);
        res.status(501).json({error: err.message || "No such file or directory!"});
    }
});

//GET /api/repos/:repositoryId/blob/:commitHash/:pathToFile
// Возвращает содержимое конкретного файла, находящегося по пути pathToFile в ветке (или по хэшу коммита) branchName.
router.get('/:repositoryId/blob/:commitHash/*', async (req, res) => {
    const { repositoryId, commitHash, '0': pathToFile } = req.params;

    const targetDir = path.join(APP_DATA.FOLDER_PATH, '/', repositoryId);

    try {
        const stats = await fs.stat(targetDir);

        if (!stats.isDirectory()) {
            res.status(400).json({ error: "The provided parameter is not directory name!" });
            return;
        }

        process.chdir(targetDir);

        const { stdout, stderr } = await promisifyExec(`git fetch origin`);

        let { stdout: remoteBranches, stderr: stderrRemoteBranches } = await promisifyExec(`git branch --remotes --format='%(refname:lstrip=-1)' | grep -v '^HEAD$'`);
        remoteBranches = remoteBranches.split('\n');
        const isBranchName = remoteBranches.includes(commitHash);

        const command = isBranchName ? `origin/${commitHash}:${pathToFile}` : `${commitHash}:${pathToFile}`;

        const gitProcess = spawn('git', ['show', command]);

        gitProcess.stderr.setEncoding('utf8');

        gitProcess.stderr.on('data', data => {
            console.error(data);
            res.status(404).json({error: data});
        });

        gitProcess.stdout.pipe(res);

        gitProcess.stdout
            .on('error', err => {
                res.statusCode = 500;
                res.end("Server Error");
                console.error(err);
            });

        res.on('close', function(){
            gitProcess.stdout.destroy();
            gitProcess.stderr.destroy();
        });

    } catch(err) {
        console.error(err);
        res.status(501).json({error: err.message || "No such file or directory!"});
    }
});

module.exports = router;
