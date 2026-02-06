# PromptMentor Extension

A Chrome extension built with **TypeScript** that (should) promotes adaptive help-seeking from LLMs like ChatGPT during coding.

## Purpose

Based on research in computer science education, I hope this extension helps novice programmers by:
- Recognizing when they're seeking "executive help" (asking for answers)
- Redirecting toward "adaptive help" (asking for hints, concepts, verification)
- Guiding them towards building metacognitive skills for effective learning


## TO get up n rolling:

### Prereqs
- Node/npm
- Chrome browser(for now)

### Installation

1. **Clone/download the repo**

2. **Install dependencies**
   ```bash
   cd PromptMentor-Extension
   ```
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
    # Build once
    npm run build

    # Watch mode (rebuilds on file changes)
    npm run watch
   ```

4. **Load in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select the `PromptMentor-Extension` folder




## References
# Should I have these here? !!!
- [Loksa & Ko (2016)](https://dl.acm.org/doi/10.1145/2960310.2960334) - Problem-solving framework
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Lodash Debounce](https://lodash.com/docs/4.17.15#debounce)
