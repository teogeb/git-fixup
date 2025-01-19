import simpleGit, { SimpleGit } from 'simple-git'
import { BranchName, Commit, ShortCommitHash } from './types'

export const NO_UPSTREAM = 'NO_UPSTREAM'

const toLines = (output: string): string[] => {
    const trimmed = output.replace(/\n$/, '')
    if (trimmed !== '') {
        return trimmed.split('\n')
    } else {
        return []
    }
}

export class GitFacade {

    private readonly git: SimpleGit 

    constructor() {
        this.git = simpleGit()
    }

    updateWorkingDirectory(path: string): void {
        this.git.cwd(path)
    }

    async getCurrentBranch(): Promise<BranchName> {
        const branchSummary = await this.git.branch()
        return branchSummary.current
    }

    async getMainBranch(): Promise<BranchName> {
        const CANDIDATES = ['main', 'master']
        for (const candidate of CANDIDATES) {
            if (await this.hasBranch(candidate)) {
                return candidate
            }
        }
        throw new Error('No main branch')
    }

    private async hasBranch(name: BranchName): Promise<boolean> {
        const result = await this.git.raw(['branch', '-l', name])
        return (result.trim() !== '') 
    }

    async getFeatureBranchCommits(featureBranch: BranchName, mainBranch: BranchName): Promise<readonly Commit[]> {
        return this.queryCommits(featureBranch, '--not', mainBranch)
    }

    async getMainBranchCommits(mainBranch: BranchName): Promise<readonly Commit[]> {
        return await this.queryCommits(mainBranch)
    }

    async getCommitsNotInUpstream(): Promise<readonly Commit[] | typeof NO_UPSTREAM> { 
        try {
            return (await this.queryCommits('@{u}..'))
        } catch (e) {
            if (e.message?.includes('no upstream configured')) {
                return NO_UPSTREAM
            }
            throw e
        }
    }

    async getLatestFixedCommit(): Promise<Commit> {
        return (await this.queryCommits('--grep-reflog=rebase (fixup)', '--walk-reflogs', '-1'))[0]
    }

    private async queryCommits(...args: string[]): Promise<Commit[]> {
        const lines = toLines(await this.git.raw(['log', ...args, '--format=%h %s']))
        return lines.map((line) => {
            const separatorIndex = line.indexOf(' ')
            const hash = line.slice(0, separatorIndex)
            const subject = line.slice(separatorIndex + 1)
            return { hash, subject }
        })
    }

    async commitFixup(hash: ShortCommitHash): Promise<void> {
        await this.git.commit('', undefined, { '--fixup': hash })
    }

    async rebaseFixupCommit(hash: ShortCommitHash): Promise<boolean> {
        try {
            await this.git.env({ 
                ...process.env, 
                GIT_SEQUENCE_EDITOR: 'true'  // bypass the interactive editor
            }).rebase(['--autosquash', '--autostash', '-i', `${hash}~`])
            return false
        } catch (e) {
            if (e.message?.includes('Merge conflict')) {
                return true
            }
            throw e
        }
    }

    async getStagedFiles(): Promise<string[]> {
        return toLines(await this.git.diff(['--cached', '--name-only']))
    }

    async getModifiedFiles(hash: ShortCommitHash): Promise<string[]> {
        return toLines(await this.git.raw(['show', '--name-only', '--pretty=format:', hash]))
    }
}
