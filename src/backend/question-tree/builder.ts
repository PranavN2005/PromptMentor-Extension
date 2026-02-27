/**
 * question tree builder — pure data no dom
 *
 * this file will contain:
 * - QuestionNode type — a question string + array of QuestionOption
 * - QuestionOption type — a label + pointer to next QuestionNode or LeafNode
 * - LeafNode type — terminal node that emits a suggested adaptive prompt
 * - QuestionTreeBuilder — builds the mockup v3 branching question tree
 *
 * nothing in this file will touch the dom
 * dom rendering lives in src/frontend/content/question-tree.ts ONLY
 * this file is pure data construction — could run in node.js or a test without a browser
 *
 * the tree this file builds matches the mockup v3 flow:
 *   "Did you come up with example inputs/outputs?" →
 *   "Have you planned your solution?" →
 *   leaf node with suggested adaptive prompt
 */

export {}; // placeholder
