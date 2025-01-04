import simpleGit, { SimpleGit } from 'simple-git'
import { BranchName, Commit, CommitHash } from './types'

export const NO_UPSTREAM = 'NO_UPSTREAM'

export class GitFacade {

    private readonly git: SimpleGit 

    constructor() {
        this.git = simpleGit()
    }

    updateWorkingDirectory(path: string): void {
        this.git.cwd(path)
    }

    async getStagedFiles(): Promise<string[]> {
        const diff = await this.git.diff(['--name-only', '--cached']);
        return diff.split('\n').filter((line) => line !== '')
    }

    async getCurrentBranch(): Promise<BranchName> {
        const branchSummary = await this.git.branch()
        return branchSummary.current
    }

    async getMainBranch(): Promise<BranchName> {
        const CANDIDATES = ['main', 'master']
        for (const candidate of CANDIDATES) {
            if (await this.doesBranchExist(candidate)) {
                return candidate
            }
        }
        throw new Error('No main branch')
    }

    async doesBranchExist(name: BranchName): Promise<boolean> {
        const result = await this.git.raw(['branch', '-l', name])
        return (result.trim() !== '') 
    }

    async getFeatureBranchCommits(featureBranch: BranchName, mainBranch: BranchName): Promise<readonly Commit[]> {
        return (await this.git.log([featureBranch, '--not', mainBranch])).all
    }

    async getMainBranchCommits(mainBranch: BranchName): Promise<readonly Commit[]> {
        return (await this.git.log([mainBranch])).all
    }
    
    async getCommitsNotInUpstream(): Promise<readonly Commit[] | typeof NO_UPSTREAM> { 
        try {
            return (await this.git.log(['@{u}..'])).all
        } catch (e: any) {
            if (e.message?.includes('no upstream configured')) {
                return NO_UPSTREAM
            }
            throw e
        }
    }

    async getLatestFixedCommit(): Promise<CommitHash> {
        return await this.git.raw(['log', '-g', '-1', '--grep-reflog=rebase \(fixup\)', '--format=%h'])
    }

    async commitFixup(hash: CommitHash): Promise<void> {
        await this.git.commit('', undefined, { '--fixup': hash })
    }

    async rebaseFixupCommit(hash: CommitHash): Promise<boolean> {
        try {
            await this.git.env({ 
                ...process.env, 
                GIT_SEQUENCE_EDITOR: 'true' // Bypass the interactive editor
            }).rebase(['--autosquash', '--autostash', '-i', `${hash}~`])
            return false
        } catch (e: any) {
            if (e.message?.includes('Merge conflict')) {
                return true
            }
            throw e
        }
    }
}
