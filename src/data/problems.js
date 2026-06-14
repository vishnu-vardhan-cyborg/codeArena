export const DEMO_PROBLEMS = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    acceptance: "49.8%",
    description:
      "Given an array of integers and a target, return the indices of two numbers whose sum equals the target.",
    examples: [
      {
        input: "nums = [2, 7, 11, 15], target = 9",
        output: "[0, 1]",
      },
    ],
    constraints: [
      "Each input has exactly one valid answer.",
      "You cannot use the same element twice.",
    ],
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    acceptance: "40.7%",
    description:
      "Determine whether a string containing brackets is valid. Every opening bracket must be closed in the correct order.",
    examples: [
      {
        input: 's = "()[]{}"',
        output: "true",
      },
    ],
    constraints: [
      "The string only contains parentheses, brackets, and braces.",
      "The string length is between 1 and 10,000.",
    ],
  },
  {
    id: "longest-substring",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    acceptance: "35.2%",
    description:
      "Find the length of the longest substring that contains no repeating characters.",
    examples: [
      {
        input: 's = "abcabcbb"',
        output: "3",
      },
    ],
    constraints: [
      "The string may contain letters, digits, symbols, and spaces.",
      "The string length is at most 50,000.",
    ],
  },
  {
    id: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "Medium",
    acceptance: "67.4%",
    description:
      "Group together words that contain the same letters with the same frequencies.",
    examples: [
      {
        input: 'words = ["eat", "tea", "tan", "ate", "nat", "bat"]',
        output: '[["bat"], ["nat", "tan"], ["ate", "eat", "tea"]]',
      },
    ],
    constraints: [
      "All words contain lowercase English letters.",
      "The input contains at most 10,000 words.",
    ],
  },
  {
    id: "merge-k-lists",
    title: "Merge K Sorted Lists",
    difficulty: "Hard",
    acceptance: "52.1%",
    description:
      "Merge several sorted linked lists into one sorted linked list and return its head.",
    examples: [
      {
        input: "lists = [[1,4,5], [1,3,4], [2,6]]",
        output: "[1,1,2,3,4,4,5,6]",
      },
    ],
    constraints: [
      "Each linked list is sorted in ascending order.",
      "The total number of nodes is at most 10,000.",
    ],
  },
  {
    id: "trapping-rain-water",
    title: "Trapping Rain Water",
    difficulty: "Hard",
    acceptance: "62.8%",
    description:
      "Given elevation heights, calculate how much rain water can be trapped after raining.",
    examples: [
      {
        input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]",
        output: "6",
      },
    ],
    constraints: [
      "Each height is a non-negative integer.",
      "The array contains at most 20,000 heights.",
    ],
  },
];

export const getProblemById = (problemId) =>
  DEMO_PROBLEMS.find((problem) => problem.id === problemId);
