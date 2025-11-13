import { MCPServer } from "@modelcontextprotocol/sdk/server.js";
import fetch from "node-fetch";

const server = new MCPServer({
  name: "PR Reviewer MCP",
  version: "1.0.0",
});

server.defineTool("get_pr_data", async ({ owner, repo, prNumber }) => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
  });
  const data = await res.json();
  return { title: data.title, body: data.body, diff_url: data.diff_url };
});

server.defineTool("post_pr_comment", async ({ owner, repo, prNumber, comment }) => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body: comment }),
  });
  const data = await res.json();
  return { comment_url: data.html_url };
});

server.definePrompt("analyze_pr", async (prData) => {
  const rules = `
  - PR title must be descriptive.
  - PR body must explain purpose.
  - No TODO or commented code left.
  `;
  const summary = `
PR Title: ${prData.title}
Body: ${prData.body}
Rules: ${rules}
Decision: Looks good if all points are followed.
`;
  return { output: summary };
});

server.start();
