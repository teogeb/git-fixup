export type ShortCommitHash = string

export type BranchName = string

export interface Commit {
    hash: ShortCommitHash
    subject: string
}
