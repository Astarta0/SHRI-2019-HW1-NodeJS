const util = require("util");
const { exec, spawn } = require("child_process");
const promisifyExec = util.promisify(exec);

const { NoAnyRemoteBranchesError } = require("./errors");
const { pipe, defineGitDirParam } = require("./utils");

const gitUtils = {
  clone: (url, targetDir) =>
    promisifyExec(`GIT_TERMINAL_PROMPT=0 git clone ${url} ${targetDir}`),

  checkout: (commitHash, gitDir = "") => {
    gitDir = defineGitDirParam(gitDir);
    return promisifyExec(`git ${gitDir} checkout ${commitHash}`);
  },

  pull: (gitDir = "") => {
    gitDir = defineGitDirParam(gitDir);
    return promisifyExec(`git ${gitDir} pull`);
  },

  fetchOrigin: (gitDir = "") => {
    gitDir = defineGitDirParam(gitDir);
    return promisifyExec(`git ${gitDir} fetch origin`);
  },

  getCommits: async (commitHash, gitDir = "") => {
    gitDir = defineGitDirParam(gitDir);

    // дата в timestamp, преобразование будет на стороне клиента
    const { stdout } = await promisifyExec(
      `git ${gitDir} log ${commitHash} --pretty=format:'{%n%h%n%s%n%aN%n%cN%n%at%n}%n'`
    );

    const commits = stdout.match(/\{\n([\s\S]*?)\n\}/g);
    if (!commits) {
      return [];
    }

    return commits
      .map(commit => commit.match(/\{\n(.*?)\n(.*?)\n(.*?)\n(.*?)\n(.*?)\n\}/))
      .map(([all, hash, subject, author, committer, date]) => ({
        hash,
        subject,
        author,
        committer,
        date
      }));
  },

  getCommitAccordingPagination: async ({
    commitHash,
    gitDir,
    skip,
    maxCount
  }) => {
    gitDir = defineGitDirParam(gitDir);

    const { stdout } = await promisifyExec(
      `git ${gitDir} rev-list ${commitHash} --skip=${skip} --max-count=${maxCount} --pretty=format:'{%n%h%n%s%n%aN%n%cN%n%at%n}%n'`
    );
    const commits = stdout.match(/\{\n([\s\S]*?)\n\}/g);
    if (!commits) {
      return [];
    }

    return commits
      .map(commit => commit.match(/\{\n(.*?)\n(.*?)\n(.*?)\n(.*?)\n(.*?)\n\}/))
      .map(([all, hash, subject, author, committer, date]) => ({
        hash,
        subject,
        author,
        committer,
        date
      }));
  },

  getNumberAllCommits: async (commitHash, gitDir = "") => {
    gitDir = defineGitDirParam(gitDir);
    let { stdout: total } = await promisifyExec(
      `git ${gitDir} rev-list ${commitHash} --count`
    );
    return total.trim();
  },

  getParentCommit: async (commitHash, gitDir = "") => {
    gitDir = defineGitDirParam(gitDir);

    const { stdout: commitParent } = await promisifyExec(
      `git ${gitDir} show ${commitHash} --pretty=format:'{%p}' --quiet`
    );

    return /\{.+\}/i.test(commitParent)
      ? `${commitHash}~`
      : `4b825dc642cb6eb9a060e54bf8d69288fbee4904`;
  },

  defineMainBranchName: async (gitDir = "") => {
    gitDir = defineGitDirParam(gitDir);

    const { stdout: mainBranchName } = await promisifyExec(
      `git ${gitDir} symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`
    );
    if (!mainBranchName) throw new NoAnyRemoteBranchesError();
    return mainBranchName.trim();
  },

  getAllRemoteBranches: async (gitDir = "") => {
    gitDir = defineGitDirParam(gitDir);

    let { stdout: remoteBranches } = await promisifyExec(
      `git ${gitDir} branch --remotes --format='%(refname:lstrip=-1)' | grep -v '^HEAD$'`
    );
    return remoteBranches.split("\n");
  },

  getWorkingTree: async (commitHash, path = "", gitDir = "") => {
    gitDir = defineGitDirParam(gitDir);

    const { stdout: stdoutLstree } = await promisifyExec(
      `git ${gitDir} ls-tree ${commitHash} ${path}`
    );

    return stdoutLstree
      .split("\n")
      .filter(str => str)
      .map(str => {
        const [, type, , name] = str.split(/\s/g);
        return {
          type,
          name
        };
      });
  },

  diffStream: ({ parent, commitHash, gitDir = "", res }) => {
    // gitDir = defineGitDirParam(gitDir);

    //const gitProcess = spawn('git', [ gitDir, 'diff', parent, commitHash ]);
    const gitProcess = spawn("git", ["diff", parent, commitHash]);

    gitProcess.stderr.setEncoding("utf8");
    gitProcess.stdout.setEncoding("utf8");

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
        res.end("Server Error");
        console.error(err);
      }
    });
  },

  showStream: ({ command, gitDir = "", res }) => {
    gitDir = defineGitDirParam(gitDir);

    // const gitProcess = spawn('git', [ gitDir, 'show', command ]);
    const gitProcess = spawn("git", ["show", command]);

    gitProcess.stderr.setEncoding("utf8");

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
        res.end("Server Error");
        console.error(err);
      }
    });
  }
};

module.exports = gitUtils;
