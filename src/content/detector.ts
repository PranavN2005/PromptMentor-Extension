/**
 * HELP-SEEKING BEHAVIOR DETECTOR
 * ==============================
 * 
 * This module detects "executive" vs "adaptive" help-seeking patterns.
 * 
 * From the research paper:
 * - EXECUTIVE: Seeking answers directly ("give me the code")
 * - ADAPTIVE: Seeking help that builds understanding ("give me a hint")
 * 
 * DESIGN CHOICE: Regex vs LLM
 * ---------------------------
 * We use regex patterns instead of calling an LLM API because:
 * 1. Speed: Regex is instant; API calls take 1-3 seconds
 * 2. Cost: Regex is free; API calls cost money
 * 3. Privacy: No user data leaves the browser
 * 4. Offline: Works without internet
 * 
 * Trade-off: Less accurate for nuanced cases, but catches common patterns.
 */

import type { PatternConfig, AnalysisResult, DetectedPattern, PatternType } from '../types';

/**
 * EXECUTIVE PATTERNS
 * These indicate the user is asking for direct solutions.
 * 
 * Each pattern has:
 * - pattern: RegExp to match
 * - type: Category for analytics
 * - message: Warning to show user
 * - suggestion: Better alternative prompt
 */
const EXECUTIVE_PATTERNS: PatternConfig[] = [
  {
    // Matches: "write code", "write a function", "give me the solution"
    // \b = word boundary (prevents matching "rewrite")
    // \s+ = one or more whitespace
    // (me\s+)? = optional "me "
    pattern: /\b(write|give|generate|create|make|provide)\s+(me\s+)?(the\s+)?(code|function|program|solution|script|implementation|answer)/i,
    type: 'solution_request',
    message: 'Asking for complete code reduces your learning opportunity.',
    suggestion: 'What are the key steps or concepts I should consider for this problem?'
  },
  {
    // Matches: "solve this", "fix my code", "debug this for me"
    pattern: /\b(solve|fix|debug|complete|finish)\s+(this|the|it|my)\b/i,
    type: 'solution_request',
    message: 'Asking to solve directly skips important problem-solving practice.',
    suggestion: 'Can you give me a hint about where to start or what might be wrong?'
  },
  {
    // Matches: "how do I implement", "how to write", "how can I code"
    pattern: /\bhow\s+(do\s+I|to|can\s+I|should\s+I)\s+(code|implement|write|create|build|make)\b/i,
    type: 'implementation_request',
    message: 'This might give you step-by-step instructions without building understanding.',
    suggestion: 'What concepts or algorithms are typically used for this type of problem?'
  },
  {
    // Matches: "what is the code", "what's the solution", "what is the answer"
    pattern: /\bwhat('s|\s+is)\s+(the\s+)?(code|solution|answer|output|result)\b/i,
    type: 'answer_request',
    message: 'Asking for the answer directly limits your learning.',
    suggestion: 'Can you check if my approach is on the right track? Here\'s what I\'ve tried: [your attempt]'
  },
  {
    // Matches common assignment phrasing: "implement a function that", "create a class which"
    pattern: /\b(implement|create|write|design|develop)\s+a\s+(class|function|method|program|algorithm)\s+(that|which|to)\b/i,
    type: 'assignment_paste',
    message: 'This looks like a pasted assignment. Try rephrasing in your own words first.',
    suggestion: 'I\'m working on [describe problem in your words]. I think I need to [your initial idea]. Is this a good starting point?'
  }
];

/**
 * ADAPTIVE PATTERNS
 * Toencourage
 
 */
const ADAPTIVE_PATTERNS: PatternConfig[] = [
  {
    pattern: /\b(hint|clue|guide|direction|pointer|nudge)\b/i,
    type: 'hint_request',
    message: 'Great! Asking for hints is an effective learning strategy.'
  },
  {
    // User shows they've tried something
    pattern: /\b(my\s+(approach|solution|code|attempt|understanding|idea)|I\s+(tried|think|wrote|attempted|believe|started))\b/i,
    type: 'shows_attempt',
    message: 'Excellent! Showing your attempt helps you get targeted feedback.'
  },
  {
    // Conceptual questions
    pattern: /\b(concept|understand|explain\s+why|learn|review|theory|principle)\b/i,
    type: 'conceptual_question',
    message: 'Good thinking! Understanding concepts helps with future problems too.'
  },
  {
    // Verification requests
    pattern: /\b(is\s+(this|my)|am\s+I|does\s+this|check\s+(my|if))\s+(correct|right|wrong|good|bad|on\s+track|valid)/i,
    type: 'verification_request',
    message: 'Nice! Checking your understanding is a valuable metacognitive skill.'
  }
];

/**
 * Analyzes a user's prompt for help-seeking patterns.
 * 
 * @param promptText - The user's message to analyze
 * @returns AnalysisResult with detected patterns and suggestions
 * 
 * @example
 * const result = analyzePrompt("Write code for binary search");
 * console.log(result.isExecutive); // true
 * console.log(result.suggestions); // ["What are the key steps..."]
 */
export function analyzePrompt(promptText: string): AnalysisResult {
  // a simple detection object with explicit types(can be subject to change if we change the patterns structure)
  const result: AnalysisResult = {
    isExecutive: false,
    isAdaptive: false,
    executivePatterns: [],
    adaptivePatterns: [],
    suggestions: []
  };

  // Check for executive patterns
  for (const config of EXECUTIVE_PATTERNS) {
    if (config.pattern.test(promptText)) {
      result.isExecutive = true;
      result.executivePatterns.push({
        type: config.type,
        message: config.message
      });
      // Only add suggestion if it exists (TypeScript enforces this check)
      if (config.suggestion) {
        result.suggestions.push(config.suggestion);
      }
    }
  }

  // Check for adaptive patterns
  for (const config of ADAPTIVE_PATTERNS) {
    if (config.pattern.test(promptText)) {
      result.isAdaptive = true;
      result.adaptivePatterns.push({
        type: config.type,
        message: config.message
      });
    }
  }

  return result;
}

/**
 * Checks if AI response contains code that might be a solution.
 * This helps us decide whether to show a warning.
 * 
 * @param responseText - The AI's response text
 * @returns true if response appears to contain code
 */
export function responseContainsCode(responseText: string): boolean {
  // Common indicators of code in responses
  const codeIndicators = [
    /```[\s\S]*?```/,           // Markdown code blocks
    /\bdef\s+\w+\s*\(/,         // Python function definitions
    /\bfunction\s+\w+\s*\(/,    // JavaScript function definitions
    /\bclass\s+\w+\s*[{:]/,     // Class definitions
    /\bconst\s+\w+\s*=/,        // JavaScript const declarations
    /\blet\s+\w+\s*=/,          // JavaScript let declarations
    /\bfor\s*\([^)]+\)\s*{/,    // For loops
    /\bif\s*\([^)]+\)\s*{/,     // If statements
  ];

  return codeIndicators.some(pattern => pattern.test(responseText));
}

