import { CommitHash } from './types'

export const toShortHash = (hash: CommitHash): string => {
    return hash.substring(0, 7)
}

export const toShortCommitMessage = (message: string): string => {
    const linefeedIndex = message.indexOf('\n')
    if (linefeedIndex !== -1) {
        return message.slice(0, linefeedIndex)
    } else {
        return message
    }
}
