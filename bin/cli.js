#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function printHelp() {
  console.log(`
Pindrop CLI
-----------
Usage:
  npx pindrop report <path_to_comments.json>

Description:
  Reads an exported Pindrop comments JSON file and generates a beautifully formatted Markdown report.
  `);
}

function generateReport(filePath) {
  try {
    const data = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8');
    const { comments = [] } = JSON.parse(data);

    if (comments.length === 0) {
      console.log('No comments found in the provided JSON file.');
      return;
    }

    let md = '# Pindrop Feedback Report\n\n';

    comments.forEach((c) => {
      const status = c.resolved ? '✅ [RESOLVED]' : '📌 [OPEN]';
      const resolvedText = c.resolvedBy ? ` (by ${c.resolvedBy})` : '';
      
      md += `### ${status} Comment by **${c.author}**\n`;
      md += `*Placed on \`${c.anchor.selector}\` at ${new Date(c.createdAt).toLocaleString()}*\n\n`;
      md += `> ${c.text}\n\n`;

      if (c.replies && c.replies.length > 0) {
        md += `**Thread:**\n`;
        c.replies.forEach((r) => {
          md += `- **${r.author}**: ${r.text}\n`;
        });
        md += '\n';
      }
      md += '---\n\n';
    });

    const outPath = path.resolve(process.cwd(), 'pindrop-report.md');
    fs.writeFileSync(outPath, md);
    console.log(`✨ Success! Report generated at: ${outPath}`);
    
  } catch (err) {
    console.error('Error reading or parsing the file:', err.message);
  }
}

const args = process.argv.slice(2);

if (args.length < 2 || args[0] !== 'report') {
  printHelp();
  process.exit(1);
}

generateReport(args[1]);
