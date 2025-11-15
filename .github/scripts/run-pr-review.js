import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

(async () => {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp/pr-reviewer-mcp.js"]
  });

  const client = new Client({
    name: "pr-review-agent",
    version: "1.0.0"
  });

  await client.connect(transport);

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
  const prNumber = Number(process.env.PR_NUMBER);

  const prDataResult = await client.callTool({
    name: "get_pr_data",
    arguments: { owner, repo, prNumber }
  });

  const promptResult = await client.callPrompt({
    name: "analyze_pr",
    arguments: {
      title: prDataResult.structuredContent.title,
      description: prDataResult.structuredContent.description,
      filesChanged: prDataResult.structuredContent.filesChanged
    }
  });

  await client.callTool({
    name: "post_pr_comment",
    arguments: {
      owner,
      repo,
      prNumber,
      comment: promptResult.messages?.[0].content.text || "No comment generated"
    }
  });

  console.log("✅ PR review completed and comment posted.");
})();
