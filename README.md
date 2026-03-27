# Pindrop.js 📌

> A zero-dependency, hyper-lightweight visual feedback layer for the web.

Pindrop allows your team (or clients) to drop pins directly onto your live website or web app, leave threaded comments, and seamlessly collaborate—without ever leaving the browser. 

Unlike heavy collaborative tools, Pindrop requires **no backend, no accounts, and no dependencies**. Out of the box, it runs entirely offline using your browser's local storage and generates shareable JSON files. 

Need real-time sync for a larger team? Simply attach your own storage adapter to connect it to Firebase, Supabase, PostgreSQL, or any database you choose!

---

## ✨ Features
- **Zero Dependencies**: Pure vanilla JS and CSS. Plugs into React, Vue, Svelte, or vanilla HTML alike without bloating your bundle.
- **Offline First**: Out of the box, saves comments to `localStorage` and generates `.json` export blobs so you can share feedback securely over email, Slack, or Jira.
- **Bring Your Own Database**: Want 'multiplayer' sync? Just pass a custom adapter object with `load()` and `save()` handlers to hook into your own API.
- **Smart Anchoring**: Pins perfectly attach to layout components and automatically survive CSS class name mangling from modern compilers (Tailwind, CSS Modules).
- **Automation Ready**: Comes with a built-in Node CLI to convert your exported JSON files into Markdown reports. Also exposes a complete programmatic API for Playwright/AI bots to add and resolve feedback automatically.
- **Dark Mode Support**: Seamlessly respects your OS theme preference or can be forced into Dark/Light mode.

---

## 📦 Installation

Install Pindrop via NPM:
\`\`\`bash
npm install pindrop.js
\`\`\`

---

## 🚀 Quick Start

Drop Pindrop into the root of your frontend application:

\`\`\`javascript
import { Pindrop } from 'pindrop.js';
import 'pindrop.js/dist/style.css'; // Don't forget the CSS!

// Initialize Pindrop
const pindrop = Pindrop.init({
  storageKey: 'my-app-feedback', // LocalStorage prefix key
  theme: 'auto', // 'light' | 'dark' | 'auto'
});
\`\`\`

You're done! Hit the `c` key to enter **Comment Mode**, click anywhere on the page, and leave a pin. Hit the `v` key to switch back to View Mode.

---

## 🛠 Advanced Usage

### Connecting a Custom Database (Multiplayer Sync)
To upgrade Pindrop from offline-only to a fully synced collaborative tool, provide an `adapter` in the options.

\`\`\`javascript
const pindrop = Pindrop.init({
  adapter: {
    load: async () => {
      // Fetch the comments from your backend API
      const res = await fetch('/api/comments');
      return await res.json();
    },
    save: async (comments) => {
      // Save the entire array back to your database whenever a comment changes
      await fetch('/api/comments', { 
        method: 'POST', 
        body: JSON.stringify(comments) 
      });
    }
  }
});
\`\`\`

### Event Hooks
Listen to Pindrop events to trigger custom actions (like sending an email notification when someone leaves a comment).

\`\`\`javascript
pindrop.on('comment:add', (comment) => {
  console.log('New feedback left by', comment.author);
});

pindrop.on('comment:resolve', (comment) => {
  console.log('Issue resolved! Send a webhook to Jira.');
});
\`\`\`

### AI / Bot Automation API
Pindrop exposes a programmatic API so Playwright test suites or AI agents can directly manage the board without simulating mouse clicks.

\`\`\`javascript
// Drop a new pin automatically based on a CSS query
pindrop.addComment({
  selector: 'header > button.checkout',
  text: 'This button is failing the automated contrast test.',
  author: 'QA Bot'
});

// Resolve an existing comment programmatically
pindrop.resolveComment('comment-1234', 'QA Bot');
\`\`\`

### Scope Comments To Views Or Page States
If your app reuses selectors across routes, tabs, or stateful screens, you can optionally attach scope metadata to each comment when it is created and decide whether that scope is currently active.

\`\`\`javascript
let activeScreen = 'checkout';

const pindrop = Pindrop.init({
  getScope: (element) => {
    const screen = element.closest('[data-screen]')?.getAttribute('data-screen');
    return screen ? { screen } : undefined;
  },
  isScopeActive: (scope) => scope.screen === activeScreen,
});

// Later, when your app changes screens/state:
activeScreen = 'confirmation';
pindrop.refresh();
\`\`\`

Scoped comments only render when `isScopeActive(scope)` returns `true`. Unscoped legacy comments still render normally, and comments attached to hidden elements (e.g., in a hidden tab or modal) are automatically suppressed. Call `pindrop.refresh()` after your app switches routes or UI states so the overlay can re-evaluate visibility.

### The `pindrop-cli` Export Terminal
Convert offline JSON exports into readable Markdown reports straight from your terminal.

\`\`\`bash
npx pindrop report ./my-comments.json
\`\`\`
Outputs a beautifully formatted `pindrop-report.md` file!

---

## 🧑‍💻 Contributing
Pull requests are welcome! 
1. `npm install`
2. `npm run dev` to start the live development server.
3. `npm run build` to compile the final library.

## 📄 License
MIT License
