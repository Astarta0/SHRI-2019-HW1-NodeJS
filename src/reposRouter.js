const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const rimraf = require('rimraf');
const junk = require('junk');
const Queue = require('better-queue');

const { NoDirectoryError, NoAnyRemoteBranchesError } = require('./errors');
const utils = require('./utils');
const gitUtils = require('./gitUtils');
const APP_DATA = require('./appData');

const router = express.Router();

// '/' === '/api/repos/'
// Возвращает массив репозиториев, которые имеются в папке.
router.get(
    '/',
    utils.wrapRoute(async (req, res) => {
        try {
            let files = await fs.readdir(APP_DATA.FOLDER_PATH);
            files = files.filter(junk.not);

            let statsArr = await Promise.all(
                files.map(file => {
                    return fs
                        .stat(path.join(APP_DATA.FOLDER_PATH, '/', file))
                        .then(stat => {
                            return {
                                file,
                                stat,
                            };
                        })
                        .catch(err => err);
                })
            );

            statsArr = statsArr
                .filter(sObj => !(sObj instanceof Error))
                .filter(sObj => sObj.stat.isDirectory())
                .map(sObj => sObj.file);

            res.json({ folders: statsArr });
        } catch (err) {
            console.error(err);
            res.status(501).json({
                error: 'An error occurred while trying to read the directory',
            });
        }
    })
);

// Добавляет репозиторий в список, скачивает его по переданной в теле запроса ссылке и добавляет в папку со всеми репозиториями.
router.post(
    '/:repositoryId',
    utils.wrapRoute(async (req, res) => {
        const { url } = req.body;
        const { repositoryId } = req.params;

        const targetDir = utils.getRepositoryPath(repositoryId);

        await gitUtils.clone(url, targetDir);
        res.json({ status: 'OK' });
    })
);

// Безвозвратно удаляет репозиторий
router.delete('/:repositoryId', (req, res) => {
    const { repositoryId } = req.params;

    const targetDir = utils.getRepositoryPath(repositoryId);

    rimraf(targetDir, function(error) {
        if (error) {
            res.status(501).json({
                error:
                    error.message ||
                    'An error occurred while trying to delete the directory',
            });
        } else {
            res.json({ status: 'OK' });
        }
    });
});

//Возвращает массив коммитов в данной ветке (или хэше коммита) вместе с датами их создания.
// router.get('/:repositoryId/commits/:commitHash', utils.wrapRoute(async (req, res) => {
//     const { repositoryId, commitHash } = req.params;
//     debugger;
//
//     const targetDir = utils.getRepositoryPath(repositoryId);
//
//     const gitDir = utils.getGitDir(repositoryId);
//
//     await utils.checkDir(targetDir);
//
//     const commits = await gitUtils.getCommits(commitHash, gitDir);
//
//     res.json({ commits });
// }));

// limit=10&offset=0
// Пагинация по массиву коммитов
router.get(
    '/:repositoryId/commits/:commitHash',
    utils.wrapRoute(async (req, res) => {
        const { repositoryId, commitHash } = req.params;
        let { limit, offset } = req.query;

        offset = offset < 0 ? 0 : offset;

        const targetDir = utils.getRepositoryPath(repositoryId);
        const gitDir = utils.getGitDir(repositoryId);

        await utils.checkDir(targetDir);

        const allCommitsNumber = await gitUtils.getNumberAllCommits(
            commitHash,
            gitDir
        );

        const skip = offset * limit;
        if (skip >= allCommitsNumber) {
            // все просмотрели, больше не запрашиваем
            res.json({
                commits: [],
                total: allCommitsNumber,
                limit,
                offset,
            });
        }

        const commits = await gitUtils.getCommitAccordingPagination({
            commitHash,
            gitDir,
            skip,
            maxCount: limit,
        });

        res.json({
            commits,
            total: allCommitsNumber,
            limit,
            offset,
        });
    })
);

// Возвращает diff коммита в виде строки.
router.get(
    '/:repositoryId/commits/:commitHash/diff',
    utils.wrapRoute(async (req, res) => {
        const { repositoryId, commitHash } = req.params;

        const targetDir = utils.getRepositoryPath(repositoryId);

        // await utils.checkDir(targetDir);
        // см вопрос в README
        await utils.checkAndChangeDir(targetDir);

        const gitDir = utils.getGitDir(repositoryId);

        const parent = await gitUtils.getParentCommit(commitHash, gitDir);

        gitUtils.diffStream({
            parent,
            commitHash,
            gitDir,
            res,
        });
    })
);

// GET /api/repos/:repositoryId(/tree/:commitHash/:path)
// Возвращает содержимое репозитория по названию ветки (или хэшу комита).
// Параметр repositoryId - название репозитория (оно же - имя папки репозитория).
// Eсли отсутствует и branchName, и path - отдать актуальное содержимое в корне в главной ветке репозитория.
router.get(
    /^\/([^\/]+)(?:\/tree(?:\/([^\/]+)(\/.*)?)?)?$/,
    utils.wrapRoute(async (req, res) => {
        let { '0': repositoryId, '1': commitHash, '2': repoPath } = req.params;

        const targetDir = utils.getRepositoryPath(repositoryId);

        await utils.checkDir(targetDir);
        const gitDir = utils.getGitDir(repositoryId);

        let mainBranch = commitHash;

        if (!commitHash) {
            mainBranch = await gitUtils.defineMainBranchName(gitDir);
        }

        // TODO: сделать очередь,
        // чтобы избежать конфликта, когда приходит другой запрос и выполняет чекаут на другую ветку,
        // а гит лог первого выводит информацию не по запрашиваемой ветке
        await gitUtils.checkout(mainBranch, gitDir);

        // если хеш коммита - нельзя выполнить pull, чтобы получить последнее актуальное состояние
        // получаем список веток и смотрим передали нам имя ветки или хеш коммита
        const remoteBranches = await gitUtils.getAllRemoteBranches(gitDir);

        const isBranchName = remoteBranches.includes(mainBranch);

        if (isBranchName) {
            await gitUtils.pull(gitDir);
        }

        repoPath = repoPath
            ? repoPath.endsWith('/')
                ? repoPath.slice(1)
                : repoPath.slice(1) + '/'
            : '';

        const content = await gitUtils.getWorkingTree(
            mainBranch,
            repoPath,
            gitDir
        );

        res.json({ content });
    })
);

// Возвращает содержимое конкретного файла, находящегося по пути pathToFile в ветке (или по хэшу коммита) branchName.
router.get(
    '/:repositoryId/blob/:commitHash/*',
    utils.wrapRoute(async (req, res) => {
        const { repositoryId, commitHash, '0': pathToFile } = req.params;

        const targetDir = utils.getRepositoryPath(repositoryId);

        // await utils.checkDir(targetDir);
        await utils.checkAndChangeDir(targetDir);

        // const gitDir = utils.getGitDir(repositoryId);

        await gitUtils.fetchOrigin();

        const remoteBranches = await gitUtils.getAllRemoteBranches();

        const isBranchName = remoteBranches.includes(commitHash);

        const command = isBranchName
            ? `origin/${commitHash}:${pathToFile}`
            : `${commitHash}:${pathToFile}`;

        gitUtils.showStream({
            command,
            res,
        });
    })
);

router.use(function(err, req, res, next) {
    console.log(err);

    if (err instanceof NoDirectoryError) {
        res.status(400).json({
            error: 'The provided parameter is not directory name!',
        });
        return;
    }

    if (err instanceof NoAnyRemoteBranchesError) {
        res.status(400).json({
            error: 'There are no any branches in you repository yet!',
        });
        return;
    }

    res.status(501).json({ error: err.message || 'Server error' });
});

module.exports = router;
