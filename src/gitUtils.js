const util = require('util');
const child = require('child_process');

const { NoAnyRemoteBranchesError } = require('./errors');
const { pipe, defineGitDirParam, logify } = require('./utils');

const exec = logify(util.promisify(child.exec));
const spawn = logify(child.spawn);

const gitUtils = {
    clone: (url, targetDir) =>
        exec(`GIT_TERMINAL_PROMPT=0 git clone ${url} ${targetDir}`),

    checkout: (commitHash, gitDir = '') => {
        gitDir = defineGitDirParam(gitDir);
        return exec(`git ${gitDir} checkout ${commitHash}`);
    },

    pull: (gitDir = '') => {
        gitDir = defineGitDirParam(gitDir);
        return exec(`git ${gitDir} pull`);
    },

    fetchOrigin: (gitDir = '') => {
        gitDir = defineGitDirParam(gitDir);
        return exec(`git ${gitDir} fetch origin`);
    },

    getCommits: async (commitHash, gitDir = '') => {
        gitDir = defineGitDirParam(gitDir);

        // дата в timestamp, преобразование будет на стороне клиента
        const { stdout } = await exec(
            `git ${gitDir} log ${commitHash} --pretty=format:'{%n%h%n%s%n%aN%n%cN%n%at%n}%n'`
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
        commitHash,
        gitDir,
        skip,
        maxCount,
    }) => {
        gitDir = defineGitDirParam(gitDir);

        const { stdout } = await exec(
            `git ${gitDir} rev-list ${commitHash} --skip=${skip} --max-count=${maxCount} --pretty=format:'{%n%h%n%s%n%aN%n%cN%n%at%n}%n'`
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

    getNumberAllCommits: async (commitHash, gitDir = '') => {
        gitDir = defineGitDirParam(gitDir);
        let { stdout: total } = await exec(
            `git ${gitDir} rev-list ${commitHash} --count`
        );
        return total.trim();
    },

    getParentCommit: async (commitHash, gitDir = '') => {
        gitDir = defineGitDirParam(gitDir);

        const { stdout: commitParent } = await exec(
            `git ${gitDir} show ${commitHash} --pretty=format:'{%p}' --quiet`
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

    defineMainBranchName: async (gitDir = '') => {
        gitDir = defineGitDirParam(gitDir);

        const { stdout: mainBranchName } = await exec(
            `git ${gitDir} symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`
        );
        if (!mainBranchName) throw new NoAnyRemoteBranchesError();
        return mainBranchName.trim();
    },

    getAllRemoteBranches: async (gitDir = '') => {
        gitDir = defineGitDirParam(gitDir);

        let { stdout: remoteBranches } = await exec(
            `git ${gitDir} branch --remotes --format='%(refname:lstrip=-1)' | grep -v '^HEAD$'`
        );
        return remoteBranches.split('\n');
    },

    getWorkingTree: async (commitHash, path = '', gitDir = '') => {
        gitDir = defineGitDirParam(gitDir);

        const { stdout: stdoutLstree } = await exec(
            `git ${gitDir} ls-tree ${commitHash} ${path}`
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

    diffStream: ({ parent, commitHash, gitDir = '', res }) => {
        gitDir = defineGitDirParam(gitDir);

        const gitProcess = spawn('git', [ gitDir, 'diff', parent, commitHash ]);

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

    showStream: ({ command, gitDir = '', res }) => {
        gitDir = defineGitDirParam(gitDir);

        const gitProcess = spawn('git', [ gitDir, 'show', command ]);

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
