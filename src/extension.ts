import * as vscode from 'vscode'
import { GitFacade, NO_UPSTREAM } from './GitFacade'
import { Commit } from './types'

export const activate = (context: vscode.ExtensionContext): void => {

    const git = new GitFacade()

    const outputChannel = vscode.window.createOutputChannel('Git Fixup')
    const writeToOutputChannel = (message: string) => {
        outputChannel.appendLine(`${new Date().toISOString()}   ${message}`)
    }

    const disposable = vscode.commands.registerCommand('git-fixup.amendStagedChanges', async () => {

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            if (workspaceFolder === undefined) {
                vscode.window.showErrorMessage('No workspace folder')
                return
            }
            git.updateWorkingDirectory(workspaceFolder)

            const hasStagedFiles = await git.hasStagedFiles()
            if (!hasStagedFiles) {
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
            const commitChoices = selectableCommits.map((commit: Commit) => {
                const isInUpstream = (commitsNotInUpstream !== NO_UPSTREAM) && (commitsNotInUpstream.find((upstreamCommit) => upstreamCommit.hash === commit.hash) === undefined)
                const messageSubject = commit.subject
                return {
                    label: `${isInUpstream ? '$(cloud)' : '$(git-commit)'} ${messageSubject}`,
                    hash: commit.hash,
                    messageSubject,
                    isInUpstream: isInUpstream
                }
            })
            const selectedCommit = await vscode.window.showQuickPick(commitChoices, { placeHolder: 'Select a Git commit to fix up' })

            if (selectedCommit !== undefined) {
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
                const successMessage = `Fixed: ${selectedCommit.hash}->${fixedCommit.hash} - ${selectedCommit.messageSubject}`
                writeToOutputChannel(successMessage)
                vscode.window.showInformationMessage(successMessage)
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(error.message)
        }
    })

    context.subscriptions.push(disposable, outputChannel)
}
