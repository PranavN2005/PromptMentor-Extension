/**
 * detector — prompt classifiers live here
 *
 * this file has two jobs:
 * 1. define the pattern configs (the actual regex rules)
 * 2. implement classifiers that use those patterns
 *
 * how to read this file:
 * - EXECUTIVE_PATTERNS / ADAPTIVE_PATTERNS: the rule lists
 * - RegexPromptClassifier: default classifier uses those rules
 * - ApiPromptClassifier: stub for future gemini/llm backend (not wired up yet)
 * - analyzePrompt(): backwards-compat wrapper so content.ts dont need changes
 * - responseContainsCode(): checks if the ai response looks like it gave a solution
 *
 * want to swap the classifier?
 * just extend PromptClassifier (in types/index.ts) and implement classify().
 * then update getActiveClassifier() in content.ts to return your new one.
 * seriously thats all you have to do
 *
 * why regex and not an llm right now?
 * - regex is instant (no api latency)
 * - totally free (no api key needed)
 * - works offline
 * - no student data leaves the browser
 * the tradeoff is it misses nuanced cases but it catches the obvious ones
 * which is good enough for a first pass
 */

import type { PatternConfig, AnalysisResult } from '../../shared/types';
import { PromptClassifier } from '../../shared/types';

// pattern configs — the detection rules

/**
 * executive patterns
 * these are the "uh oh" prompts — student is asking for the answer directly
 *
 * each entry has:
 * - pattern: the regex to match against the students text
 * - type: category label (used for analytics later)
 * - message: what we tell the student is happening
 * - suggestion: a better way they could have asked
 *
 * note: if you add patterns keep them focused on INTENT not surface words.
 * "how do I implement X" is executive even though it dont say "give me code"
 */
const EXECUTIVE_PATTERNS: PatternConfig[] = [
  {
    // "write me the code" "give me the solution" "generate a function" etc
    // the (me\s+)? part handles "give me" vs just "give"
    // \b = word boundary so "rewrite" dont trigger this
    pattern:
      /\b(write|give|generate|create|make|provide)\s+(me\s+)?(the\s+)?(code|function|program|solution|script|implementation|answer)/i,
    type: 'solution_request',
    message: 'Asking for complete code reduces your learning opportunity.',
    suggestion: 'What are the key steps or concepts I should consider for this problem?',
  },
  {
    // "solve this" "fix my code" "debug this for me" "finish the function"
    pattern: /\b(solve|fix|debug|complete|finish)\s+(this|the|it|my)\b/i,
    type: 'solution_request',
    message: 'Asking to solve directly skips important problem-solving practice.',
    suggestion: 'Can you give me a hint about where to start or what might be wrong?',
  },
  {
    // "how do I implement" "how to write" "how can I code X"
    // careful: "how do I understand X" is NOT executive so we only match action verbs
    pattern: /\bhow\s+(do\s+I|to|can\s+I|should\s+I)\s+(code|implement|write|create|build|make)\b/i,
    type: 'implementation_request',
    message: 'This might give you step-by-step instructions without building understanding.',
    suggestion: 'What concepts or algorithms are typically used for this type of problem?',
  },
  {
    // "what is the code" "whats the solution" "what is the answer"
    pattern: /\bwhat('s|\s+is)\s+(the\s+)?(code|solution|answer|output|result)\b/i,
    type: 'answer_request',
    message: 'Asking for the answer directly limits your learning.',
    suggestion:
      "Can you check if my approach is on the right track? Here's what I've tried: [your attempt]",
  },
  {
    // classic assignment paste: "implement a function that..." "create a class which..."
    // this pattern is a dead giveaway that the student copy pasted the problem spec
    pattern:
      /\b(implement|create|write|design|develop)\s+a\s+(class|function|method|program|algorithm)\s+(that|which|to)\b/i,
    type: 'assignment_paste',
    message: 'This looks like a pasted assignment. Try rephrasing in your own words first.',
    suggestion:
      "I'm working on [describe problem in your words]. I think I need to [your initial idea]. Is this a good starting point?",
  },
];

/**
 * adaptive patterns
 * these are the "nice!" prompts — student is doing it right
 * we dont block these just recognize them (and could affirm the student in the future)
 *
 * note: adaptive patterns dont have a suggestion field — theres nothing to redirect
 */
const ADAPTIVE_PATTERNS: PatternConfig[] = [
  {
    // asking for a hint clue nudge — all good signs
    pattern: /\b(hint|clue|guide|direction|pointer|nudge)\b/i,
    type: 'hint_request',
    message: 'Great! Asking for hints is an effective learning strategy.',
  },
  {
    // student is showing their work — "I tried..." "my approach is..." "I think..."
    // this is the most reliable signal of adaptive help-seeking
    pattern:
      /\b(my\s+(approach|solution|code|attempt|understanding|idea)|I\s+(tried|think|wrote|attempted|believe|started))\b/i,
    type: 'shows_attempt',
    message: 'Excellent! Showing your attempt helps you get targeted feedback.',
  },
  {
    // asking to understand not just to get an answer
    pattern: /\b(concept|understand|explain\s+why|learn|review|theory|principle)\b/i,
    type: 'conceptual_question',
    message: 'Good thinking! Understanding concepts helps with future problems too.',
  },
  {
    // "is this correct?" "am I on the right track?" "check my solution" — verification is good!
    pattern:
      /\b(is\s+(this|my)|am\s+I|does\s+this|check\s+(my|if))\s+(correct|right|wrong|good|bad|on\s+track|valid)/i,
    type: 'verification_request',
    message: 'Nice! Checking your understanding is a valuable metacognitive skill.',
  },
];

// regex classifier — default implementation

/**
 * RegexPromptClassifier
 * the default classifier. runs the students text against the pattern lists above
 *
 * to use a different classifier instead extend PromptClassifier and swap it in
 * via getActiveClassifier() in content.ts. you dont need to touch this class
 *
 * accuracy note: this is good at catching obvious cases but will miss nuanced ones
 * like "can you walk me through implementing X?" (sounds educational but is still
 * kind of executive). thats a known limitation — an llm classifier would do better
 */
export class RegexPromptClassifier extends PromptClassifier {
  classify(submission: string): AnalysisResult {
    // start with a clean empty result — well fill it in below
    const result: AnalysisResult = {
      isExecutive: false,
      isAdaptive: false,
      executivePatterns: [],
      adaptivePatterns: [],
      suggestions: [],
    };

    // check each executive pattern — if it matches flag it and collect the suggestion
    for (const config of EXECUTIVE_PATTERNS) {
      if (config.pattern.test(submission)) {
        result.isExecutive = true;
        result.executivePatterns.push({
          type: config.type,
          message: config.message,
        });
        // suggestion is optional on the config type so we check before pushing
        if (config.suggestion) {
          result.suggestions.push(config.suggestion);
        }
      }
    }

    // check each adaptive pattern — no suggestions needed here just flag it
    for (const config of ADAPTIVE_PATTERNS) {
      if (config.pattern.test(submission)) {
        result.isAdaptive = true;
        result.adaptivePatterns.push({
          type: config.type,
          message: config.message,
        });
      }
    }

    return result;
  }
}

// api classifier — future gemini integration (stub not wired up yet)

/**
 * ApiPromptClassifier
 * placeholder for when we connect to gemini (or any llm backend)
 *
 * right now this falls back to regex — its just a stub so you can see
 * where to plug in the real api call later
 *
 * to implement (when youre ready):
 * 1. replace the fallback in classify() with an actual fetch() to your backend
 * 2. your backend hits gemini with the students prompt + a classification prompt
 * 3. parse the response into AnalysisResult format
 * 4. update getActiveClassifier() in content.ts to return new ApiPromptClassifier()
 *
 * important: classify() in content.ts is called synchronously right now.
 * to go async (needed for api calls) youd need to change the call site too.
 * see the todo comment in content.ts near getActiveClassifier()
 */
export class ApiPromptClassifier extends PromptClassifier {
  private fallback = new RegexPromptClassifier();

  classify(submission: string): AnalysisResult {
    // todo: replace this with a real api call to your backend / gemini
    // for now just falls back to regex so nothing breaks
    console.warn('[PromptMentor] ApiPromptClassifier is a stub — using regex fallback');
    return this.fallback.classify(submission);
  }
}

// active classifier — swap here to change which one runs

/**
 * this is the single instance used by the rest of the extension
 * to switch classifiers just change whats returned here
 *
 * e.g to try the api classifier:
 *   return new ApiPromptClassifier();
 */
export function getActiveClassifier(): PromptClassifier {
  return new RegexPromptClassifier();
}

// backwards-compat wrapper

/**
 * analyzePrompt()
 * thin wrapper around the active classifiers classify() method
 * kept so content.ts dont need changes — it still calls analyzePrompt() directly
 *
 * if you add async support later update this function AND the call site in content.ts
 */
export function analyzePrompt(promptText: string): AnalysisResult {
  return getActiveClassifier().classify(promptText);
}

// response checker — separate from prompt classification

/**
 * responseContainsCode()
 * checks the ai's response (not the students prompt) for signs of code
 * used to decide whether to blur the response
 *
 * this is intentionally kept as a plain function (not a classifier subclass)
 * cause it operates on a different input — the assistants output not the students
 *
 * known limitation: can produce false positives for code-adjacent text
 * (e.g a response that *mentions* python syntax without giving a full solution)
 * good enough for v1 — can be tightened later
 */
export function responseContainsCode(responseText: string): boolean {
  const codeIndicators = [
    /```[\s\S]*?```/, // markdown code blocks (most reliable signal)
    /\bdef\s+\w+\s*\(/, // python function definition
    /\bfunction\s+\w+\s*\(/, // js/ts function definition
    /\bclass\s+\w+\s*[{:]/, // class definition (python or java/js style)
    /\bconst\s+\w+\s*=/, // js const assignment
    /\blet\s+\w+\s*=/, // js let assignment
    /\bfor\s*\([^)]+\)\s*{/, // for loop
    /\bif\s*\([^)]+\)\s*{/, // if statement
  ];

  return codeIndicators.some(indicator => indicator.test(responseText));
}
