
# Git Fixup

The **Git Fixup** is a lightweight VS Code extension that simplifies the process of applying fix-up commits to a Git repository. By staging your changes and selecting a commit from your current branch, this tool automatically amends the staged changes to the selected commit using Git's rebase.

This extension helps developers to streamline their Git workflows and keep commit histories clean and organized.

## Features

- **Select Commit for Fix-Up**: Choose any commit from the current branch to apply staged changes as a fix-up.
- **Automatic Rebase**: The tool executes the required `git rebase --autosquash` command for you.
- **Upstream Safety:** If a commit has already been pushed to the remote, the tool asks an additional confirmation.

Conflicts during rebase are not resolved automatically; you will need to resolve them manually.

## Usage

1. **Stage Files for Fix-Up**:

   - Use Git's staging area to add the files you want to include in the fix-up commit.

2. **Select a Commit**:

   - Execute the "Git Fixup: Amend Staged Changes" command via the command palette or using the keyboard shortcut.
   - Browse the list of commits in your current branch.
   - Select the commit you want to fix up.

3. **Apply Fix-Up**:

   - If the commit has already been pushed to the remote, confirm the selection.
   - The tool creates a fix-up commit and automatically executes `git rebase --autosquash` to amend your changes to the selected commit.

## Keybinding

`Ctrl+Alt+Shift+F` (Windows/Linux) / `Cmd+Alt+Shift+F` (macOS)

## Contribution

Contributions are welcome! Feel free to open an issue or submit a pull request on the [GitHub repository](https://github.com/teogeb/git-fixup).

## License

[MIT](LICENSE) © Teo Gebhard

## Feedback

We value your feedback! Please report issues or suggest new features on the [GitHub issues page](https://github.com/teogeb/git-fixup/issues).
