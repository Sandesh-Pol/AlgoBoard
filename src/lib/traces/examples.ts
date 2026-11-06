import type { Analysis, TraceStep } from "../analysis/schema";

type PartialStep = Partial<TraceStep> & { title: string; sourceLine: number; activeNodeIds: string[] };
const blank = (): Omit<TraceStep, "stepIndex" | "title"> => ({
  description: "",
  sourceLine: undefined,
  variables: {},
  arrayState: [],
  mapState: [],
  setState: [],
  stackState: [],
  queueState: [],
  treeState: { nodes: [] },
  tableState: [],
  activeNodeIds: [],
  activeEdgeIds: [],
  changedValues: [],
  invariant: "",
  narration: "",
});
const finalize = (steps: PartialStep[]): TraceStep[] =>
  steps.map((s, i) => ({ ...blank(), ...s, stepIndex: i, description: s.description ?? s.narration ?? "" }));

const base = {
  requestId: "example",
  needsMoreInfo: false,
  language: "python",
  assumptions: [],
  warnings: [],
  confidence: 1,
  secondaryPatterns: [],
};

// ---------- Two Pointers: LeetCode 167 ----------
function twoSumII(): Analysis {
  const code = `def twoSum(numbers, target):
    l, r = 0, len(numbers) - 1
    while l < r:
        s = numbers[l] + numbers[r]
        if s == target:
            return [l + 1, r + 1]
        if s < target:
            l += 1
        else:
            r -= 1
    return []`;
  const nums = [1, 3, 4, 6, 8, 11];
  const target = 10;
  const steps: PartialStep[] = [];
  let l = 0;
  let r = nums.length - 1;
  const arr = (hl: number[] = []) => [{ name: "numbers", values: nums.map(String), pointers: { l, r }, highlight: hl }];
  steps.push({ title: "Init pointers", sourceLine: 2, activeNodeIds: ["n2"], activeEdgeIds: ["e1"], variables: { l: "0", r: String(r), target: "10" }, changedValues: ["l", "r"], arrayState: arr(), narration: "Start with the smallest and largest values.", invariant: "Answer, if any, lies within [l, r]." });
  while (l < r) {
    steps.push({ title: `Check l < r (${l} < ${r})`, sourceLine: 3, activeNodeIds: ["n3"], activeEdgeIds: ["e2"], variables: { l: String(l), r: String(r) }, arrayState: arr(), narration: "Pointers have not crossed, keep searching.", invariant: "Answer lies within [l, r]." });
    const s = nums[l] + nums[r];
    steps.push({ title: `s = ${nums[l]} + ${nums[r]} = ${s}`, sourceLine: 4, activeNodeIds: ["n4"], activeEdgeIds: ["e3"], variables: { l: String(l), r: String(r), s: String(s) }, changedValues: ["s"], arrayState: arr([l, r]), narration: "Sum the values under both pointers.", invariant: "Answer lies within [l, r]." });
    if (s === target) {
      steps.push({ title: `Found ${s} == ${target}`, sourceLine: 6, activeNodeIds: ["n5", "n6"], activeEdgeIds: ["e4", "e5"], variables: { l: String(l), r: String(r), s: String(s), result: `[${l + 1}, ${r + 1}]` }, changedValues: ["result"], arrayState: arr([l, r]), narration: "Sum matches — return 1-indexed positions.", invariant: "Done." });
      break;
    }
    if (s < target) {
      l++;
      steps.push({ title: `${s} < ${target} → move l right`, sourceLine: 8, activeNodeIds: ["n7", "n8"], activeEdgeIds: ["e6", "e7"], variables: { l: String(l), r: String(r), s: String(s) }, changedValues: ["l"], arrayState: arr([l]), narration: "Sum too small; only a bigger left value can help (array is sorted).", invariant: "Everything left of l cannot pair with anything ≤ r." });
    } else {
      r--;
      steps.push({ title: `${s} > ${target} → move r left`, sourceLine: 10, activeNodeIds: ["n7", "n9"], activeEdgeIds: ["e8", "e9"], variables: { l: String(l), r: String(r), s: String(s) }, changedValues: ["r"], arrayState: arr([r]), narration: "Sum too large; a smaller right value is needed.", invariant: "Everything right of r is too large to be used." });
    }
  }
  return {
    ...base,
    inputType: "leetcode_reference",
    problem: { title: "167. Two Sum II – Input Array Is Sorted", source: "leetcode", number: 167, inputFormat: "sorted int[] numbers, int target", outputFormat: "1-indexed pair [i, j]", constraints: ["2 ≤ n ≤ 3·10⁴", "exactly one solution"], examples: ["numbers=[1,3,4,6,8,11], target=10 → [2,5]"] },
    algorithmPattern: "Two Pointers",
    normalizedProblem: "Find two numbers in a sorted array that add up to target.",
    code,
    flowchart: {
      nodes: [
        { id: "n1", kind: "start", label: "twoSum(numbers, target)", line: 1 },
        { id: "n2", kind: "process", label: "l, r = 0, n - 1", line: 2 },
        { id: "n3", kind: "loop", label: "while l < r?", line: 3 },
        { id: "n4", kind: "process", label: "s = nums[l] + nums[r]", line: 4 },
        { id: "n5", kind: "decision", label: "s == target?", line: 5 },
        { id: "n6", kind: "return", label: "return [l+1, r+1]", line: 6 },
        { id: "n7", kind: "decision", label: "s < target?", line: 7 },
        { id: "n8", kind: "process", label: "l += 1", line: 8 },
        { id: "n9", kind: "process", label: "r -= 1", line: 10 },
        { id: "n10", kind: "end", label: "return []", line: 11 },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4", label: "yes" },
        { id: "e4", source: "n4", target: "n5" },
        { id: "e5", source: "n5", target: "n6", label: "yes" },
        { id: "e6", source: "n5", target: "n7", label: "no" },
        { id: "e7", source: "n7", target: "n8", label: "yes" },
        { id: "e8", source: "n7", target: "n9", label: "no" },
        { id: "e9", source: "n8", target: "n3", label: "loop" },
        { id: "e10", source: "n9", target: "n3", label: "loop" },
        { id: "e11", source: "n3", target: "n10", label: "no" },
      ],
    },
    dryRun: { input: "numbers = [1,3,4,6,8,11], target = 10", steps: finalize(steps) },
    insights: {
      patternName: "Two Pointers (opposite ends)",
      whyThisPattern: "The array is sorted, so the sum moves monotonically as either pointer moves.",
      approach: ["Place l at the start and r at the end.", "Compute the sum of both ends.", "Too small → move l right; too big → move r left.", "Stop when the sum matches."],
      pseudocode: "l, r = 0, n-1\nwhile l < r:\n  s = a[l] + a[r]\n  if s == t: return\n  if s < t: l++ else r--",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      invariant: "If a solution exists, it lies within [l, r].",
      edgeCases: ["Negative numbers", "Duplicate values", "Answer uses first and last element"],
      commonMistakes: ["Returning 0-indexed positions", "Using l <= r and pairing an element with itself"],
      alternativeApproach: "Hash map lookup in O(n) time and O(n) space (ignores sortedness).",
    },
  };
}

// ---------- Sliding Window: LeetCode 3 ----------
function longestSubstring(): Analysis {
  const code = `def lengthOfLongestSubstring(s):
    seen = {}
    left = best = 0
    for right, ch in enumerate(s):
        if ch in seen and seen[ch] >= left:
            left = seen[ch] + 1
        seen[ch] = right
        best = max(best, right - left + 1)
    return best`;
  const s = "abcabb";
  const seen: Record<string, number> = {};
  let left = 0;
  let best = 0;
  const steps: PartialStep[] = [];
  const snap = (right: number, hk?: string) => ({
    arrayState: [{ name: "s", values: s.split(""), pointers: { left, right }, highlight: [right], window: [left, right] }],
    mapState: [{ name: "seen", entries: Object.entries(seen).map(([key, v]) => ({ key, value: String(v) })), highlightKey: hk }],
  });
  steps.push({ title: "Init window", sourceLine: 3, activeNodeIds: ["n2"], activeEdgeIds: ["e1"], variables: { left: "0", best: "0" }, changedValues: ["left", "best"], arrayState: [{ name: "s", values: s.split(""), pointers: { left: 0 }, highlight: [] }], mapState: [{ name: "seen", entries: [] }], narration: "Empty window, empty last-seen map.", invariant: "s[left..right] has no repeats." });
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    steps.push({ title: `right = ${right}, ch = '${ch}'`, sourceLine: 4, activeNodeIds: ["n3"], activeEdgeIds: ["e2"], variables: { left: String(left), right: String(right), ch, best: String(best) }, changedValues: ["right", "ch"], ...snap(right), narration: "Expand the window by one character.", invariant: "s[left..right-1] has no repeats." });
    if (ch in seen && seen[ch] >= left) {
      left = seen[ch] + 1;
      steps.push({ title: `'${ch}' repeats → shrink left to ${left}`, sourceLine: 6, activeNodeIds: ["n4", "n5"], activeEdgeIds: ["e3", "e4"], variables: { left: String(left), right: String(right), ch, best: String(best) }, changedValues: ["left"], ...snap(right, ch), narration: "Duplicate inside window: jump left past its last occurrence.", invariant: "Window is valid again." });
    }
    seen[ch] = right;
    best = Math.max(best, right - left + 1);
    steps.push({ title: `seen['${ch}']=${right}, best=${best}`, sourceLine: 8, activeNodeIds: ["n6", "n7"], activeEdgeIds: ["e6", "e7"], variables: { left: String(left), right: String(right), ch, best: String(best) }, changedValues: ["seen", "best"], ...snap(right, ch), narration: `Window length is ${right - left + 1}.`, invariant: "best = longest valid window so far." });
  }
  steps.push({ title: `Return ${best}`, sourceLine: 9, activeNodeIds: ["n8"], activeEdgeIds: ["e9"], variables: { best: String(best) }, narration: "All characters processed.", invariant: "Done." });
  return {
    ...base,
    inputType: "leetcode_reference",
    problem: { title: "3. Longest Substring Without Repeating Characters", source: "leetcode", number: 3, inputFormat: "string s", outputFormat: "int length", constraints: ["0 ≤ |s| ≤ 5·10⁴"], examples: ['s="abcabb" → 3'] },
    algorithmPattern: "Sliding Window",
    secondaryPatterns: ["Hash Map"],
    normalizedProblem: "Length of the longest substring with all distinct characters.",
    code,
    flowchart: {
      nodes: [
        { id: "n1", kind: "start", label: "lengthOfLongest(s)", line: 1 },
        { id: "n2", kind: "process", label: "seen={}, left=best=0", line: 2 },
        { id: "n3", kind: "loop", label: "for right, ch in s?", line: 4 },
        { id: "n4", kind: "decision", label: "ch in window?", line: 5 },
        { id: "n5", kind: "process", label: "left = seen[ch] + 1", line: 6 },
        { id: "n6", kind: "process", label: "seen[ch] = right", line: 7 },
        { id: "n7", kind: "process", label: "best = max(best, len)", line: 8 },
        { id: "n8", kind: "return", label: "return best", line: 9 },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4", label: "yes" },
        { id: "e4", source: "n4", target: "n5", label: "yes" },
        { id: "e5", source: "n5", target: "n6" },
        { id: "e6", source: "n4", target: "n6", label: "no" },
        { id: "e7", source: "n6", target: "n7" },
        { id: "e8", source: "n7", target: "n3", label: "loop" },
        { id: "e9", source: "n3", target: "n8", label: "no" },
      ],
    },
    dryRun: { input: 's = "abcabb"', steps: finalize(steps) },
    insights: {
      patternName: "Sliding Window (variable size)",
      whyThisPattern: "We need the longest contiguous range satisfying a condition that breaks only by adding a repeat.",
      approach: ["Expand right one char at a time.", "If char was seen inside window, jump left past it.", "Record last index of char.", "Track max window length."],
      pseudocode: "left = 0\nfor right, ch in s:\n  if seen[ch] >= left: left = seen[ch]+1\n  seen[ch] = right\n  best = max(best, right-left+1)",
      timeComplexity: "O(n)",
      spaceComplexity: "O(min(n, alphabet))",
      invariant: "s[left..right] contains no duplicate characters.",
      edgeCases: ["Empty string", "All same characters", "All unique"],
      commonMistakes: ["Moving left backwards when seen[ch] < left", "Off-by-one in window length"],
      alternativeApproach: "Set-based window shrinking one step at a time (still O(n)).",
    },
  };
}

// ---------- Binary Search: LeetCode 704 ----------
function binarySearch(): Analysis {
  const code = `def search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`;
  const nums = [-1, 0, 3, 5, 9, 12, 15];
  const target = 12;
  let lo = 0;
  let hi = nums.length - 1;
  const steps: PartialStep[] = [];
  const disc = () => nums.map((_, i) => i).filter((i) => i < lo || i > hi);
  const arr = (p: Record<string, number>, hl: number[] = []) => [{ name: "nums", values: nums.map(String), pointers: p, highlight: hl, discarded: disc() }];
  steps.push({ title: "Init lo, hi", sourceLine: 2, activeNodeIds: ["n2"], activeEdgeIds: ["e1"], variables: { lo: "0", hi: String(hi), target: String(target) }, changedValues: ["lo", "hi"], arrayState: arr({ lo, hi }), narration: "Search space is the whole array.", invariant: "target, if present, is in nums[lo..hi]." });
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    steps.push({ title: `mid = (${lo}+${hi})//2 = ${mid}`, sourceLine: 4, activeNodeIds: ["n3", "n4"], activeEdgeIds: ["e2", "e3"], variables: { lo: String(lo), hi: String(hi), mid: String(mid) }, changedValues: ["mid"], arrayState: arr({ lo, mid, hi }, [mid]), narration: `Probe the middle: nums[${mid}] = ${nums[mid]}.`, invariant: "target in nums[lo..hi]." });
    if (nums[mid] === target) {
      steps.push({ title: `nums[${mid}] == ${target} → return ${mid}`, sourceLine: 6, activeNodeIds: ["n5", "n6"], activeEdgeIds: ["e4", "e5"], variables: { lo: String(lo), hi: String(hi), mid: String(mid), result: String(mid) }, changedValues: ["result"], arrayState: arr({ mid }, [mid]), narration: "Found the target.", invariant: "Done." });
      break;
    }
    if (nums[mid] < target) {
      lo = mid + 1;
      steps.push({ title: `${nums[mid]} < ${target} → lo = ${lo}`, sourceLine: 8, activeNodeIds: ["n7", "n8"], activeEdgeIds: ["e6", "e7"], variables: { lo: String(lo), hi: String(hi), mid: String(mid) }, changedValues: ["lo"], arrayState: arr({ lo, hi }), narration: "Discard the left half including mid.", invariant: "target in nums[lo..hi]." });
    } else {
      hi = mid - 1;
      steps.push({ title: `${nums[mid]} > ${target} → hi = ${hi}`, sourceLine: 10, activeNodeIds: ["n7", "n9"], activeEdgeIds: ["e6", "e8"], variables: { lo: String(lo), hi: String(hi), mid: String(mid) }, changedValues: ["hi"], arrayState: arr({ lo, hi }), narration: "Discard the right half including mid.", invariant: "target in nums[lo..hi]." });
    }
  }
  return {
    ...base,
    inputType: "leetcode_reference",
    problem: { title: "704. Binary Search", source: "leetcode", number: 704, inputFormat: "sorted int[] nums, int target", outputFormat: "index or -1", constraints: ["1 ≤ n ≤ 10⁴", "distinct values"], examples: ["nums=[-1,0,3,5,9,12,15], target=12 → 5"] },
    algorithmPattern: "Binary Search",
    normalizedProblem: "Return the index of target in a sorted array, or -1.",
    code,
    flowchart: {
      nodes: [
        { id: "n1", kind: "start", label: "search(nums, target)", line: 1 },
        { id: "n2", kind: "process", label: "lo, hi = 0, n - 1", line: 2 },
        { id: "n3", kind: "loop", label: "while lo <= hi?", line: 3 },
        { id: "n4", kind: "process", label: "mid = (lo + hi) // 2", line: 4 },
        { id: "n5", kind: "decision", label: "nums[mid] == target?", line: 5 },
        { id: "n6", kind: "return", label: "return mid", line: 6 },
        { id: "n7", kind: "decision", label: "nums[mid] < target?", line: 7 },
        { id: "n8", kind: "process", label: "lo = mid + 1", line: 8 },
        { id: "n9", kind: "process", label: "hi = mid - 1", line: 10 },
        { id: "n10", kind: "end", label: "return -1", line: 11 },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4", label: "yes" },
        { id: "e4", source: "n4", target: "n5" },
        { id: "e5", source: "n5", target: "n6", label: "yes" },
        { id: "e6", source: "n5", target: "n7", label: "no" },
        { id: "e7", source: "n7", target: "n8", label: "yes" },
        { id: "e8", source: "n7", target: "n9", label: "no" },
        { id: "e9", source: "n8", target: "n3", label: "loop" },
        { id: "e10", source: "n9", target: "n3", label: "loop" },
        { id: "e11", source: "n3", target: "n10", label: "no" },
      ],
    },
    dryRun: { input: "nums = [-1,0,3,5,9,12,15], target = 12", steps: finalize(steps) },
    insights: {
      patternName: "Binary Search",
      whyThisPattern: "Sorted input lets one comparison discard half of the remaining candidates.",
      approach: ["Keep a closed range [lo, hi].", "Probe mid.", "Discard the half that cannot contain target.", "Stop when found or range empty."],
      pseudocode: "lo, hi = 0, n-1\nwhile lo <= hi:\n  mid = (lo+hi)//2\n  if a[mid]==t: return mid\n  if a[mid]<t: lo=mid+1 else hi=mid-1\nreturn -1",
      timeComplexity: "O(log n)",
      spaceComplexity: "O(1)",
      invariant: "If target exists, it is inside nums[lo..hi].",
      edgeCases: ["Single element", "Target smaller/larger than all", "Target at an end"],
      commonMistakes: ["while lo < hi with closed range", "lo = mid (infinite loop)", "Overflow of lo+hi in fixed-width languages"],
      alternativeApproach: "Linear scan in O(n).",
    },
  };
}

// ---------- DP: LeetCode 70 ----------
function climbStairs(): Analysis {
  const code = `def climbStairs(n):
    memo = {}
    def ways(i):
        if i <= 1:
            return 1
        if i in memo:
            return memo[i]
        memo[i] = ways(i - 1) + ways(i - 2)
        return memo[i]
    return ways(n)`;
  const n = 4;
  const memo: Record<number, number> = {};
  const tree: TraceStep["treeState"]["nodes"] = [];
  const stack: string[] = [];
  const steps: PartialStep[] = [];
  let tid = 0;
  const snap = () => ({
    treeState: { nodes: tree.map((t) => ({ ...t })) },
    stackState: [{ name: "call stack", items: [...stack] }],
    mapState: [{ name: "memo", entries: Object.entries(memo).map(([k, v]) => ({ key: k, value: String(v) })) }],
    tableState: [{ name: "dp", colLabels: Array.from({ length: n + 1 }, (_, i) => String(i)), rows: [Array.from({ length: n + 1 }, (_, i) => (i <= 1 ? "1" : memo[i] != null ? String(memo[i]) : "·"))], highlight: [] as number[][] }],
  });
  const ways = (i: number, parent?: string): number => {
    const id = `t${++tid}`;
    tree.forEach((t) => t.state === "active" && (t.state = "pending"));
    tree.push({ id, label: `ways(${i})`, parent, state: "active" });
    stack.push(`ways(${i})`);
    steps.push({ title: `Call ways(${i})`, sourceLine: 3, activeNodeIds: ["n3"], activeEdgeIds: [], variables: { i: String(i) }, changedValues: ["i"], ...snap(), narration: parent ? "Recurse into a smaller subproblem." : "Top-level call.", invariant: "memo[k] = ways to climb k stairs." });
    let res: number;
    const node = tree.find((t) => t.id === id)!;
    if (i <= 1) {
      res = 1;
      node.state = "done";
      node.label = `ways(${i})=1`;
      steps.push({ title: `Base case i=${i} → 1`, sourceLine: 5, activeNodeIds: ["n4", "n5"], activeEdgeIds: ["e4"], variables: { i: String(i), ret: "1" }, changedValues: ["ret"], ...snap(), narration: "0 or 1 stairs: exactly one way.", invariant: "Base cases are known." });
    } else if (memo[i] != null) {
      res = memo[i];
      node.state = "memo";
      node.label = `ways(${i})=${res}`;
      steps.push({ title: `Memo hit ways(${i}) = ${res}`, sourceLine: 7, activeNodeIds: ["n6", "n7"], activeEdgeIds: ["e6"], variables: { i: String(i), ret: String(res) }, changedValues: ["ret"], ...snap(), narration: "Already computed — reuse instead of recomputing the subtree.", invariant: "Each state solved once." });
    } else {
      const a = ways(i - 1, id);
      const b = ways(i - 2, id);
      res = a + b;
      memo[i] = res;
      node.state = "done";
      node.label = `ways(${i})=${res}`;
      const s = snap();
      s.tableState[0].highlight = [[0, i]];
      steps.push({ title: `memo[${i}] = ${a} + ${b} = ${res}`, sourceLine: 8, activeNodeIds: ["n8", "n9"], activeEdgeIds: ["e8"], variables: { i: String(i), ret: String(res) }, changedValues: ["memo", "ret"], ...s, narration: "Combine the two smaller answers and cache it.", invariant: "memo[i] = memo[i-1] + memo[i-2]." });
    }
    stack.pop();
    return res;
  };
  const total = ways(n);
  steps.push({ title: `Return ${total}`, sourceLine: 10, activeNodeIds: ["n10"], activeEdgeIds: ["e10"], variables: { result: String(total) }, ...snap(), narration: `There are ${total} ways to climb ${n} stairs.`, invariant: "Done." });
  return {
    ...base,
    inputType: "leetcode_reference",
    problem: { title: "70. Climbing Stairs", source: "leetcode", number: 70, inputFormat: "int n", outputFormat: "number of distinct ways", constraints: ["1 ≤ n ≤ 45"], examples: ["n=4 → 5"] },
    algorithmPattern: "Dynamic Programming",
    secondaryPatterns: ["DFS", "Hash Map"],
    normalizedProblem: "Count ways to reach step n taking 1 or 2 steps at a time.",
    code,
    flowchart: {
      nodes: [
        { id: "n1", kind: "start", label: "climbStairs(n)", line: 1 },
        { id: "n2", kind: "process", label: "memo = {}", line: 2 },
        { id: "n3", kind: "call", label: "ways(i)", line: 3 },
        { id: "n4", kind: "decision", label: "i <= 1?", line: 4 },
        { id: "n5", kind: "return", label: "return 1", line: 5 },
        { id: "n6", kind: "decision", label: "i in memo?", line: 6 },
        { id: "n7", kind: "return", label: "return memo[i]", line: 7 },
        { id: "n8", kind: "call", label: "ways(i-1) + ways(i-2)", line: 8 },
        { id: "n9", kind: "return", label: "memo[i]; return", line: 9 },
        { id: "n10", kind: "end", label: "return ways(n)", line: 10 },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n5", label: "yes" },
        { id: "e5", source: "n4", target: "n6", label: "no" },
        { id: "e6", source: "n6", target: "n7", label: "yes" },
        { id: "e7", source: "n6", target: "n8", label: "no" },
        { id: "e8", source: "n8", target: "n9" },
        { id: "e9", source: "n8", target: "n3", label: "recurse" },
        { id: "e10", source: "n9", target: "n10" },
      ],
    },
    dryRun: { input: "n = 4", steps: finalize(steps) },
    insights: {
      patternName: "Dynamic Programming (top-down memoization)",
      whyThisPattern: "ways(i) depends only on ways(i-1) and ways(i-2): overlapping subproblems + optimal substructure.",
      approach: ["Define state ways(i).", "Base: ways(0)=ways(1)=1.", "Transition: ways(i)=ways(i-1)+ways(i-2).", "Cache each result in memo."],
      pseudocode: "ways(i):\n  if i <= 1: return 1\n  if i in memo: return memo[i]\n  memo[i] = ways(i-1) + ways(i-2)\n  return memo[i]",
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
      invariant: "memo[k] always holds the true count for k stairs.",
      edgeCases: ["n = 1", "n = 2", "n = 45 (needs memo to avoid 2ⁿ calls)"],
      commonMistakes: ["Forgetting memo → exponential time", "Wrong base case ways(0)"],
      alternativeApproach: "Bottom-up with two variables: O(n) time, O(1) space.",
    },
  };
}

export const EXAMPLES = [
  { id: "two-pointers", label: "Two Pointers · 167", build: twoSumII },
  { id: "sliding-window", label: "Sliding Window · 3", build: longestSubstring },
  { id: "binary-search", label: "Binary Search · 704", build: binarySearch },
  { id: "dp", label: "DP · 70 Climbing Stairs", build: climbStairs },
] as const;
