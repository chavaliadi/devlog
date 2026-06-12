export interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

const MAX_FILES = 25;
const MAX_LINES_PER_FILE = 100;
const MAX_TOTAL_CHARS = 10000;

// Patterns to ignore in diff processing (lockfiles and binary/non-text media formats)
const IGNORED_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /bun\.lockb$/,
  /\.(png|jpe?g|gif|svg|ico|webp|pdf|zip|gz|tar|tgz|mp4|mp3|wav|ogg|flac|avi|mov|woff2?|ttf|eot)$/i,
];

export const isIgnoredFile = (filename: string): boolean => {
  return IGNORED_PATTERNS.some((pattern) => pattern.test(filename));
};

export const filterCommitDiff = (files: GitHubFile[]): string => {
  if (!files || files.length === 0) {
    return 'No file changes found in this commit.';
  }

  // 1. Filter out ignored file types
  const filteredFiles = files.filter((file) => !isIgnoredFile(file.filename));

  if (filteredFiles.length === 0) {
    return 'All files in this commit were ignored (lockfiles, assets, or binary data).';
  }

  let result = '';
  let fileCount = 0;

  // 2. Iterate through files up to limit
  for (const file of filteredFiles) {
    if (fileCount >= MAX_FILES) {
      result += `\n... [truncated diff: exceeded limit of ${MAX_FILES} files]`;
      break;
    }

    if (!file.patch) {
      // File has no patch (might be a newly added binary, or deleted file without patch details)
      const emptyPatchMsg = `File: ${file.filename} (${file.status}) - [No diff content available]\n\n`;
      if (result.length + emptyPatchMsg.length > MAX_TOTAL_CHARS) {
        result += `\n... [truncated diff: reached limit of ${MAX_TOTAL_CHARS} characters]`;
        break;
      }
      result += emptyPatchMsg;
      fileCount++;
      continue;
    }

    // 3. Truncate lines in the file patch
    let patchLines = file.patch.split('\n');
    let isPatchTruncated = false;

    if (patchLines.length > MAX_LINES_PER_FILE) {
      patchLines = patchLines.slice(0, MAX_LINES_PER_FILE);
      isPatchTruncated = true;
    }

    let processedPatch = patchLines.join('\n');
    if (isPatchTruncated) {
      processedPatch += `\n... [truncated patch: exceeded ${MAX_LINES_PER_FILE} lines]`;
    }

    const fileHeader = `File: ${file.filename} (${file.status})\n`;
    const fileContent = `${fileHeader}${processedPatch}\n\n`;

    // 4. Character count check
    if (result.length + fileContent.length > MAX_TOTAL_CHARS) {
      // Try to append as much of the header/patch as possible, or just truncate
      result += `\n... [truncated diff: reached limit of ${MAX_TOTAL_CHARS} characters]`;
      break;
    }

    result += fileContent;
    fileCount++;
  }

  return result.trim();
};
