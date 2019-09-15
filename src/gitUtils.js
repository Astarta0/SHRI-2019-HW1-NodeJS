const util = require('util');
const child = require('child_process');

const { NoAnyRemoteBranchesError } = require('./errors');
const { pipe, getGitDirParam, getWorkTreeParam, logify } = require('./utils');

const exec = logify(util.promisify(child.exec));
const spawn = logify(child.spawn);

const gitUtils = {
    clone: (url, targetDir) =>
        exec(`GIT_TERMINAL_PROMPT=0 git clone ${url} ${targetDir}`),

    checkout: (repositoryId, commitHash) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);
        return exec(`git ${gitDir} ${workTree} checkout --force ${commitHash}`);
    },

    pull: (repositoryId) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);
        return exec(`git ${gitDir} ${workTree} pull`);
    },

    fetchOrigin: (repositoryId) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);
        return exec(`git ${gitDir} ${workTree} fetch origin`);
    },

    getCommits: async (repositoryId, commitHash) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);

        // дата в timestamp, преобразование будет на стороне клиента
        const { stdout } = await exec(
            `git ${gitDir} ${workTree} log ${commitHash} --pretty=format:'{%n%h%n%s%n%aN%n%cN%n%at%n}%n'`
        );

        const commits = stdout.match(/\{\n([\s\S]*?)\n\}/g);
        if (!commits) {
            return [];
        }

        return commits
            .map(commit =>
                commit.match(/\{\n(.*?)\n(.*?)\n(.*?)\n(.*?)\n(.*?)\n\}/)
            )
            .map(([all, hash, subject, author, committer, date]) => ({
                hash,
                subject,
                author,
                committer,
                date,
            }));
    },

    getCommitAccordingPagination: async ({
        repositoryId,
        commitHash,
        skip,
        maxCount,
    }) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);

        const { stdout } = await exec(
            `git ${gitDir} ${workTree} rev-list ${commitHash} --skip=${skip} --max-count=${maxCount} --pretty=format:'{%n%h%n%s%n%aN%n%cN%n%at%n}%n'`
        );
        const commits = stdout.match(/\{\n([\s\S]*?)\n\}/g);
        if (!commits) {
            return [];
        }

        return commits
            .map(commit =>
                commit.match(/\{\n(.*?)\n(.*?)\n(.*?)\n(.*?)\n(.*?)\n\}/)
            )
            .map(([all, hash, subject, author, committer, date]) => ({
                hash,
                subject,
                author,
                committer,
                date,
            }));
    },

    getNumberAllCommits: async (repositoryId, commitHash) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);
        let { stdout: total } = await exec(
            `git ${gitDir} ${workTree} rev-list ${commitHash} --count`
        );
        return total.trim();
    },

    getParentCommit: async (repositoryId, commitHash) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);

        const { stdout: commitParent } = await exec(
            `git ${gitDir} ${workTree} show ${commitHash} --pretty=format:'{%p}' --quiet`
        );

        // Проверяем есть ли у коммита родительский коммит
        return /\{.+\}/i.test(commitParent)
            // если есть, то просто используем синтаксис для взятия родителя
            // относительно которого построим дифф
            ? `${commitHash}~`
            // если нет, то значит это первый коммит в репозитории
            // и для того чтобы взять дифф в качестве parent коммита
            // мы укажем hash пустого дерева
            : `4b825dc642cb6eb9a060e54bf8d69288fbee4904`;
    },

    defineMainBranchName: async (repositoryId) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);

        const { stdout: mainBranchName } = await exec(
            `git ${gitDir} ${workTree} symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`
        );
        if (!mainBranchName) throw new NoAnyRemoteBranchesError();
        return mainBranchName.trim();
    },

    getAllRemoteBranches: async (repositoryId) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);

        let { stdout: remoteBranches } = await exec(
            `git ${gitDir} ${workTree} branch --remotes --format='%(refname:lstrip=-1)' | grep -v '^HEAD$'`
        );
        return remoteBranches.split('\n');
    },

    getWorkingTree: async (repositoryId, commitHash, path = '') => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);

        const { stdout: stdoutLstree } = await exec(
            `git ${gitDir} ${workTree} ls-tree ${commitHash} ${path}`
        );

        return stdoutLstree
            .split('\n')
            .filter(str => str)
            .map(str => {
                const [, type, , name] = str.split(/\s/g);
                return {
                    type,
                    name,
                };
            });
    },

    diffStream: ({ repositoryId, parent, commitHash, res }) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);

        const gitProcess = spawn('git', [ gitDir, workTree, 'diff', parent, commitHash ]);

        gitProcess.stderr.setEncoding('utf8');
        gitProcess.stdout.setEncoding('utf8');

        pipe({
            from: gitProcess,
            to: res,
            onStderrData(data) {
                console.error(data);
                gitProcess.stdout.unpipe(res);
                res.status(404).json({ error: data });
            },
            onStdoutError(err) {
                res.statusCode = 500;
                res.end('Server Error');
                console.error(err);
            },
        });
    },

    showStream: ({ repositoryId, command, res }) => {
        const gitDir = getGitDirParam(repositoryId);
        const workTree = getWorkTreeParam(repositoryId);

        const gitProcess = spawn('git', [ gitDir, workTree, 'show', command ]);

        gitProcess.stderr.setEncoding('utf8');

        pipe({
            from: gitProcess,
            to: res,
            onStderrData(data) {
                console.error(data);
                gitProcess.stdout.unpipe(res);
                res.status(404).json({ error: data });
            },
            onStdoutError(err) {
                res.statusCode = 500;
                res.end('Server Error');
                console.error(err);
            },
        });
    },
};

module.exports = gitUtils;
