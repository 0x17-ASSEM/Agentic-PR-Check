import { spawn } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client.js";

async function main() {
  const server = spawn("node", ["mcp/pr-reviewer-mcp.js"], { stdio: ["pipe", "pipe", "inherit"] });

  const client = new Client();
  await client.connect("stdio", server);

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
  const prNumber = Number(process.env.PR_NUMBER);

  const prData = await client.callTool("get_pr_data", { owner, repo, prNumber });
  const analysis = await client.runPrompt("analyze_pr", prData);
  await client.callTool("post_pr_comment", { owner, repo, prNumber, comment: analysis.output });

  console.log("✅ PR review complete and comment posted!");
}

main().catch(console.error);
