import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const server = new McpServer({
  name: "Agentic PR Reviewer",
  version: "1.0.0"
});

// Register tool: fetch PR data
server.registerTool(
  "get_pr_data",
  {
    title: "Fetch PR Data",
    description: "Fetch pull request details from GitHub",
    inputSchema: z.object({
      owner: z.string(),
      repo: z.string(),
      prNumber: z.number()
    }),
    outputSchema: z.object({
      title: z.string(),
      description: z.string(),
      filesChanged: z.array(z.string())
    })
  },
  async ({ owner, repo, prNumber }) => {
    const headers = { Authorization: `Bearer ${GITHUB_TOKEN}` };
    const prRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers }
    );
    const pr = await prRes.json();
    const filesRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      { headers }
    );
    const files = await filesRes.json();
    return {
      content: [
        {
          type: "text",
          text: `Fetched PR ${owner}/${repo} #${prNumber}`
        }
      ],
      structuredContent: {
        title: pr.title,
        description: pr.body || "",
        filesChanged: files.map(f => f.filename)
      }
    };
  }
);

// Register tool: post comment
server.registerTool(
  "post_pr_comment",
  {
    title: "Post PR Comment",
    description: "Post a comment to GitHub pull request",
    inputSchema: z.object({
      owner: z.string(),
      repo: z.string(),
      prNumber: z.number(),
      comment: z.string()
    }),
    outputSchema: z.object({
      status: z.number(),
      message: z.string()
    })
  },
  async ({ owner, repo, prNumber, comment }) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    const res = await fetch(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ body: comment })
      }
    );
    return {
      content: [
        {
          type: "text",
          text: `Comment posted (status ${res.status})`
        }
      ],
      structuredContent: {
        status: res.status,
        message: "Comment posted"
      }
    };
  }
);

// Register prompt: analyze PR
server.registerPrompt(
  "analyze_pr",
  {
    title: "Analyze Pull Request",
    description: "Analyze a pull request for style and compliance",
    argsSchema: z.object({
      title: z.string(),
      description: z.string(),
      filesChanged: z.array(z.string())
    })
  },
  ({ title, description, filesChanged }) => {
    const lines = [
      `**PR Title:** ${title}`,
      `**PR Description:** ${description}`,
      `**Files Changed:**`,
      ...filesChanged.map(f => `- ${f}`)
    ].join("\n");

    const feedback = `
### Automated Code Review Summary

${lines}

**Checks:**
- Title clarity ✅/❌
- Description completeness ✅/❌
- File naming conventions ✅/❌
- Test files presence ✅/❌
- Reasonable PR size ✅/❌

Please address any ❌ items before merge.
`;

    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: feedback
          }
        }
      ]
    };
  }
);

// Start server on stdio
(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
