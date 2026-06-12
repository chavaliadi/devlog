import dotenv from 'dotenv';
import { filterCommitDiff } from '../utils/diffFilter';

dotenv.config();

export interface FetchCommitResult {
  message: string;
  commitDate: Date;
  diffText: string;
}

/**
 * Fetches the metadata and file patches for a specific commit from the GitHub API.
 * Uses the provided user token or falls back to GITHUB_PAT configured in the environment.
 * 
 * @param owner Repository owner (username or org)
 * @param repo Repository name
 * @param sha Commit SHA
 * @param token Optional access token (e.g. User's GitHub OAuth token)
 */
export const fetchCommitDiff = async (
  owner: string,
  repo: string,
  sha: string,
  token?: string
): Promise<FetchCommitResult> => {
  const activeToken = token || process.env.GITHUB_PAT;
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'DevLog-App',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  } else {
    console.warn(
      `[GitHubService] Warning: Fetching commit ${sha} without authorization token. Rate limits will apply.`
    );
  }

  console.log(`[GitHubService] Requesting commit data from: ${url}`);
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `GitHub API returned ${response.status} ${response.statusText}: ${errorBody || 'No error details'}`
    );
  }

  const data = (await response.json()) as any;

  const commitMessage = data.commit?.message || 'No commit message';
  const commitDateStr = data.commit?.committer?.date || data.commit?.author?.date || new Date().toISOString();
  const commitDate = new Date(commitDateStr);
  const files = data.files || [];

  // Filter and truncate the file patches using our utility
  const diffText = filterCommitDiff(files);

  return {
    message: commitMessage,
    commitDate,
    diffText,
  };
};
