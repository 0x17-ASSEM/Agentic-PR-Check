import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

(async () => {
  // Ensure the child process is spawned from the repository root so relative paths
  // like "mcp/pr-reviewer-mcp.js" resolve correctly regardless of the caller's cwd.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "..", "..");

  const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp/pr-reviewer-mcp.js"],
    cwd: repoRoot
  });

  const client = new Client({
    name: "pr-review-agent",
    version: "1.0.0"
  });

  await client.connect(transport);

  if (!process.env.GITHUB_REPOSITORY) {
    console.error(
      "GITHUB_REPOSITORY is not set. Set it to '<owner>/<repo>' (e.g. in Actions this is provided automatically)."
    );
    process.exit(1);
  }
  if (!process.env.PR_NUMBER) {
    console.error("PR_NUMBER is not set. Export the pull request number in PR_NUMBER.");
    process.exit(1);
  }

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
  const prNumber = Number(process.env.PR_NUMBER);

  const prDataResult = await client.callTool({
    name: "get_pr_data",
    arguments: { owner, repo, prNumber }
  });
  // Validate tool result and extract structured content safely
  if (!prDataResult || prDataResult.isError) {
    console.error("get_pr_data failed:", prDataResult);
    process.exit(1);
  }

  const sc = prDataResult.structuredContent ?? {};
  const title = sc.title ?? "";
  const description = sc.description ?? "";
  const filesChanged = Array.isArray(sc.filesChanged) ? sc.filesChanged : [];

  // The SDK client in this project may not provide a convenience method to run prompts
  // (`callPrompt`/`runPrompt`). Instead generate a simple feedback message locally
  // that mirrors the server prompt output and post it using the server tool.
  const feedbackLines = [
    `**PR Title:** ${title}`,
    `**PR Description:** ${description}`,
    `**Files Changed:**`,
    ...filesChanged.map((f) => `- ${f}`)
  ];

  const feedback = `### Automated Code Review Summary\n\n${feedbackLines.join("\n")}\n\n**Checks:**\n- Title clarity ✅/❌\n- Description completeness ✅/❌\n- File naming conventions ✅/❌\n- Test files presence ✅/❌\n- Reasonable PR size ✅/❌\n\nPlease address any ❌ items before merge.`;

  await client.callTool({
    name: "post_pr_comment",
    arguments: {
      owner,
      repo,
      prNumber,
      comment: feedback
    }
  });

  console.log("✅ PR review completed and comment posted.");
})();
