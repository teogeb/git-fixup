import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import simpleGit, { SimpleGit } from 'simple-git'
import { GitFacade } from '../src/GitFacade'
import { toShortHash } from '../src/utils'

describe('GitFacade', () => {

    let facade: GitFacade
    let git: SimpleGit
    let repoDirectory: string

    const modifyFileAndStageChanges = async (fileContent: string): Promise<void> => {
        const fileName = path.join(repoDirectory, 'file.txt')
        await fs.writeFile(fileName, fileContent)
        await git.add('.')
    }

    const createCommit = async (fileContent: string, commitMessage: string): Promise<void> => {
        await modifyFileAndStageChanges(fileContent)
        await git.commit(commitMessage)
    }

    beforeEach(async () => {
        repoDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'temp-repo-'))
        git = simpleGit(repoDirectory)
        await git.init()
        await createCommit('lorem\n\n', 'commit 1')
        await createCommit('lorem\n\n\n\nipsum\n\n', 'commit 2')
        await createCommit('lorem\n\n\n\nipsum\n\n\n\ndolor', 'commit 3')
        facade = new GitFacade()
        facade.updateWorkingDirectory(repoDirectory)
    })

    it('happy path', async () => {
        const FIXABLE_COMMIT_INDEX = 1
        const commitsBefore = await facade.getMainBranchCommits('main')
        const fixableCommit = commitsBefore[FIXABLE_COMMIT_INDEX]
        await modifyFileAndStageChanges('lorem\n\n\n\nfoobar\n\n')
        await facade.commitFixup(fixableCommit.hash)
        const isMergeConflict = await facade.rebaseFixupCommit(fixableCommit.hash)
        expect(isMergeConflict).toBe(false)
        const fixedCommitHash = await facade.getLatestFixedCommit()
        const commitsAfter = await facade.getMainBranchCommits('main')
        expect(toShortHash(commitsAfter[FIXABLE_COMMIT_INDEX].hash)).toEqual(fixedCommitHash)
        const fixedCommitDiff = await git.raw(['diff', '-U0', `${fixedCommitHash}~`, `${fixedCommitHash}`])
        expect(fixedCommitDiff).toContain('+\n+\n+foobar\n+\n')
        const fixupCommitDiff = await git.raw(['diff', '-U0', `${fixableCommit.hash}`, `${fixedCommitHash}`])
        expect(fixupCommitDiff).toContain('-ipsum\n+foobar\n')
    })

    it('getMainBranchCommits()', async () => {
        const commits = await facade.getMainBranchCommits('main')
        expect(commits).toHaveLength(3)
        expect(commits.map((c) => c.hash.length)).toEqual([40, 40, 40])
        expect(commits.map((c) => c.message)).toEqual(['commit 3', 'commit 2', 'commit 1'])
    })
})