import * as vscode from 'vscode'
import { GitFacade, NO_UPSTREAM } from './GitFacade'
import { Commit } from './types'

export const activate = (context: vscode.ExtensionContext): void => {

    const git = new GitFacade()

    const outputChannel = vscode.window.createOutputChannel('Git Fixup')
    const writeToOutputChannel = (message: string) => {
        outputChannel.appendLine(`${new Date().toISOString()}   ${message}`)
    }

    const getCommitIcon = (isInUpstream: boolean, isHighlighted: boolean): vscode.IconPath => {
        const getThemeIconUri = (theme: 'light' | 'dark'): vscode.Uri => {
            const fileNameParts: string[] = []
            fileNameParts.push('commit')
            fileNameParts.push(theme)
            if (isInUpstream) {
                fileNameParts.push('upstream')
            }
            if (isHighlighted) {
                fileNameParts.push('highlighted')
            }
            return vscode.Uri.joinPath(context.extensionUri, 'images', `${fileNameParts.join('-')}.svg`)
        }
        return {
            light: getThemeIconUri('light'),
            dark: getThemeIconUri('dark')
        }
    }

    const amendStagedChangesToCommit = async (selectedCommit: Commit & { isInUpstream: boolean }) => {
        if (selectedCommit.isInUpstream) {
            const confirm = await vscode.window.showInformationMessage('The commit has been pushed to the upstream. Do you want to proceed?', 'Yes', 'No')
            if (confirm !== 'Yes') {
                return
            }
        }
        await git.commitFixup(selectedCommit.hash)
        const isMergeConflict = await git.rebaseFixupCommit(selectedCommit.hash)
        if (isMergeConflict) {
            writeToOutputChannel(`Merge conflict while fixing ${selectedCommit.hash}`)
            vscode.window.showErrorMessage('Merge conflict\n\nResolve the conflict manually, then use Git: Commit (Amend) to commit the changes.\n', { modal: true })
            return 
        }
        const fixedCommit = await git.getLatestFixedCommit()
        const successMessage = `Fixed: ${selectedCommit.hash}->${fixedCommit.hash} - ${selectedCommit.subject}`
        writeToOutputChannel(successMessage)
        vscode.window.showInformationMessage(successMessage)
    }

    const disposable = vscode.commands.registerCommand('git-fixup.amendStagedChanges', async () => {

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            if (workspaceFolder === undefined) {
                vscode.window.showErrorMessage('No workspace folder')
                return
            }
            git.updateWorkingDirectory(workspaceFolder)

            const stagedFiles = await git.getStagedFiles()
            if (stagedFiles.length === 0) {
                vscode.window.showErrorMessage('No staged files')
                return
            }

            const currentBranch = await git.getCurrentBranch()
            const mainBranch = await git.getMainBranch()
            const isFeatureBranch = (currentBranch !== mainBranch)
            const selectableCommits = isFeatureBranch
                ? await git.getFeatureBranchCommits(currentBranch, mainBranch)
                : await git.getMainBranchCommits(mainBranch)
            if (selectableCommits.length === 0) {
                vscode.window.showErrorMessage('No commits')
                return
            }

            const commitsNotInUpstream = await git.getCommitsNotInUpstream()
            const commitChoices = await Promise.all((selectableCommits.map(async (commit) => {
                const isInUpstream = (commitsNotInUpstream !== NO_UPSTREAM) && (commitsNotInUpstream.find((upstreamCommit) => upstreamCommit.hash === commit.hash) === undefined)
                const modifiedFiles = await git.getModifiedFiles(commit.hash)
                const isHighlighted = modifiedFiles.some((filePath) => stagedFiles.includes(filePath))
                const messageSubject = commit.subject
                return {
                    iconPath: getCommitIcon(isInUpstream, isHighlighted),
                    label: `  ${messageSubject}`,
                    hash: commit.hash,
                    subject: commit.subject,
                    isInUpstream
                }
            })))
            const selectedCommit = await vscode.window.showQuickPick(commitChoices, { placeHolder: 'Select a Git commit to fix up' })

            if (selectedCommit !== undefined) {
                await amendStagedChangesToCommit(selectedCommit)
            }
        } catch (error) {
            vscode.window.showErrorMessage(error.message)
        }
    })

    context.subscriptions.push(disposable, outputChannel)

    context.subscriptions.push(
        // TODO explicit types for the arguments (most likely 1st is ISCMProvider and 2nd is ISCMHistoryItem)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vscode.commands.registerCommand('git-fixup.amendStagedChangesToHistoryItem', async (_: any, historyItem: any) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            git.updateWorkingDirectory(vscode.workspace.workspaceFolders![0]!.uri.fsPath)
            const stagedFiles = await git.getStagedFiles()
            if (stagedFiles.length === 0) {
                vscode.window.showErrorMessage('No staged files')
                return
            }
            const hash = historyItem.id
            try {
                const commit = await git.getCommit(hash)
                const isInUpstream = await git.isCommitInUptream(hash)
                await amendStagedChangesToCommit({ ...commit, isInUpstream })
            } catch (error) {
                vscode.window.showErrorMessage(error.message)
            }
        }),
        outputChannel
    )
}
