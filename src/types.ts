export type CommitHash = string

export type BranchName = string

export interface Commit {
    hash: CommitHash
    message: string
}