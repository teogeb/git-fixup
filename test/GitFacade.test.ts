import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import simpleGit, { SimpleGit } from 'simple-git'
import { GitFacade } from '../src/GitFacade'

describe('GitFacade', () => {

    let facade: GitFacade
    let git: SimpleGit
    let repoDirectory: string

    const configureGit = async () => {
        const configs = {
            'user.name': 'Test User',
            'user.email': 'test@test.test'
        }
        for (const [key, value] of Object.entries(configs)) {
            await git.addConfig(key, value)
        }
    }

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
        await git.init(['-b', 'main'])
        await configureGit()
        await createCommit('lorem\n\n', 'subject 1')
        await createCommit('lorem\n\n\n\nipsum\n\n', 'subject 2')
        await createCommit('lorem\n\n\n\nipsum\n\n\n\ndolor', 'subject 3\n\nbody test')
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
        const fixedCommit = await facade.getLatestFixedCommit()
        const commitsAfter = await facade.getMainBranchCommits('main')
        expect(commitsAfter[FIXABLE_COMMIT_INDEX].hash).toEqual(fixedCommit.hash)
        const fixedCommitDiff = await git.raw(['diff', '-U0', `${fixedCommit.hash}~`, `${fixedCommit.hash}`])
        expect(fixedCommitDiff).toContain('+\n+\n+foobar\n+\n')
        const fixupCommitDiff = await git.raw(['diff', '-U0', `${fixableCommit.hash}`, `${fixedCommit.hash}`])
        expect(fixupCommitDiff).toContain('-ipsum\n+foobar\n')
    })

    it('getMainBranchCommits()', async () => {
        const commits = await facade.getMainBranchCommits('main')
        expect(commits).toHaveLength(3)
        const expectedLength = (await git.raw(['rev-parse', '--short', 'HEAD'])).trim().length
        expect(commits.map((c) => c.hash.length)).toEqual([expectedLength, expectedLength, expectedLength])
        expect(commits.map((c) => c.subject)).toEqual(['subject 3', 'subject 2', 'subject 1'])
    })

    it('hasStagedFiles()', async () => {
        expect(await facade.hasStagedFiles()).toBe(false)
        await modifyFileAndStageChanges('foobar')
        expect(await facade.hasStagedFiles()).toBe(true)
        await git.commit('-')
        expect(await facade.hasStagedFiles()).toBe(false)
    })
})