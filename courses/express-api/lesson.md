---
title: How Hash Maps Work
---

# The problem

{{show: names}} You have a list of names and you need to find one.

Which slot holds "Dana"? You don't know. So you start at the front.

{{focus: first}} "Alice." Not her. Next.

{{focus: second}} "Bob." Nope. Keep going.

{{focus: found}} "Dana." Got it. But that took three checks just to get here.

{{focus: found}} With four items, no big deal. With a million? You might scan the entire list before finding what you want. Or worse, scan the whole thing only to learn it's not there.

{{focus: none}} Hash maps fix this. Instead of checking every slot, you compute exactly where to look. One step, done.

```data:names type=array
["Alice", "Bob", "Dana", "Eve"]
^check=0
---
first: 0
second: 1
found: 2
last: 3
```

# The hash function

{{clear: slide}}

{{show: hash-fn}} Every hash map starts with a function that turns keys into numbers.

{{focus: signature}} This function takes any string and returns an integer. Same string in, same integer out, every single time. That predictability is the whole point.

{{focus: init}} We create a variable to build up the result. It starts at zero. Think of it as a running total that gets modified as we read through the string.

{{focus: loop}} Now the loop. We go through the string one character at a time.

{{focus: char-math}} Each character has a numeric code. Lowercase "a" is 97, "b" is 98, and so on through the alphabet. Capital letters, digits, symbols — they all have codes too.

{{focus: char-math}} On each pass, we take our running total, multiply it by 31, and add the current character's code. That multiplication is the secret sauce.

Why 31? It's prime. Prime multipliers spread different strings across different output numbers more evenly than even numbers would. Two similar strings like "cat" and "bat" end up with very different hashes. Fewer collisions later.

{{focus: clamp}} Now look at the end of that line.

{{focus: clamp}} That bitwise OR with zero looks like it does nothing. But it's actually doing something critical.

JavaScript numbers are floating point by default. Once our running total gets large enough, JavaScript quietly loses precision. The bitwise OR forces the engine to treat the number as a 32-bit integer, keeping every bit exact. Without this, two strings that should hash differently might accidentally produce the same result.

{{focus: return-val}} Finally, we return the number.

Feed in "Dana" and you get back something like 2,104,580. Feed in "Dana" again, same number. Feed in "Dave" and you get something completely different. That's the contract: deterministic, but spread out.

{{focus: none}}

```code:hash-fn lang=ts
function hash(key: string): number {
  let h = 0
  for (const ch of key) {
    h = (h * 31 + ch.charCodeAt(0)) | 0
  }
  return h
}
---
signature: 1
init: 2
loop: 3
char-math: 4
clamp: 4 "| 0"
return-val: 6
```

# From hash to index

{{clear: slide}}

The hash function gives us a big number, but we need a small one — an index into an array with only a few slots.

{{split}} {{show: mod-code}} {{show: empty-buckets}} Here's the idea.

{{focus: mod-line}} The modulo operator does the conversion. It divides the hash by the array length and takes the remainder.

{{focus: none}} If our array has four slots, any number mod 4 gives us 0, 1, 2, or 3. Always a valid index, no matter how large the hash was.

{{focus: target-slot}} So "Dana" hashes to some big number, we mod it by 4, and get index 2.

{{focus: none}} We drop the value right into that slot. No scanning, no comparisons. One computation, one placement.

That's the core idea. The hash function tells you where to put things and where to find them later.

```code:mod-code lang=ts
const index = hash(key) % buckets.length
buckets[index] = value
---
mod-line: 1
store-line: 2
```

```data:empty-buckets type=array
[-, -, "Dana", -]
^index=2
---
target-slot: 2
open-slots: 0, 1, 3
```

# Filling the table

{{clear: fade}}

{{show: filled}} That worked for one key. Here's what the table looks like after inserting four.

{{focus: alice}} "Alice" hashed to slot 0.

{{focus: bob}} "Bob" ended up in slot 3. Notice how the hash function scattered them — Bob didn't go right after Alice. The distribution depends entirely on the math.

{{focus: dana}} "Dana" landed in slot 2. We already saw that one.

{{focus: eve}} {{focus: eve}} And "Eve" went to slot 1.

{{focus: none}} Four insertions, four direct placements. The hash function spread them across the array with no overlap.

Lookups work the exact same way. Want to find "Bob"? Hash "Bob", mod by 4, check slot 3. Done. Want "Eve"? Same process — hash, mod, check. One step every time.

```data:filled type=array
["Alice", "Eve", "Dana", "Bob"]
---
alice: 0
eve: 1
dana: 2
bob: 3
```

# When keys collide

{{clear: slide}}

Here's where it gets interesting.

{{split}} {{show: collision-code}} {{show: collision-arr}} What happens when two different keys hash to the same index?

{{focus: problem-line}} Say we try to insert "Frank" and his hash, mod 4, also gives us 2 — the same slot where "Dana" already lives.

{{focus: crash-slot}} We can't just overwrite Dana's data. That would destroy information. But we also can't pick a different slot, because the hash function will always point to index 2 for "Frank." Every time someone looks up "Frank," they'll check slot 2.

{{focus: none}} This is called a collision. And here's the thing — collisions are mathematically inevitable. With more keys than slots, at least two keys must share an index. Even with fewer keys than slots, random chance means overlap happens sooner than you'd expect.

So every hash map needs a plan for when this happens.

```code:collision-code lang=ts
hash("Dana")  % 4  // gives us 2
hash("Frank") % 4  // also gives us 2

// Same index. Now what?
---
dana-hash: 1
frank-hash: 2
problem-line: 4
```

```data:collision-arr type=array
["Alice", "Eve", "collision", "Bob"]
^both=2
---
crash-slot: 2
safe-slots: 0, 1, 3
```

# Chaining

{{clear: slide}}

{{show: chain}} The most common solution: instead of storing one value per slot, store a linked list. Each slot points to a chain of entries.

{{focus: dana-node}} When "Dana" maps to slot 2, she becomes the first node in that chain.

Her node holds both the key and the value. That key matters — it's how we tell entries apart when multiple keys share the same slot.

{{focus: frank-node}} {{focus: frank-node}} When "Frank" also maps to slot 2, we add him to the front of the list. He becomes the new head, and Dana gets pushed one step back.

{{focus: none}} Now both entries live at index 2, and neither one is lost. The chain can grow as long as it needs to.

In practice, if the hash function does its job and spreads keys evenly, most chains stay short. One node, maybe two. Walking a chain that short is practically instant.

The trouble starts when too many keys pile into the same slots. Chains get long, and you're back to scanning — which is exactly what we were trying to avoid. That's where resizing comes in, but we'll get to that.

```data:chain type=linked-list
(frank Frank) -> (dana Dana) -> null
---
frank-node: frank
dana-node: dana
```

# Looking things up

{{clear: fade}}

Retrieval follows the same logic, just in reverse.

{{split}} {{show: get-fn}} {{show: get-chain}} Here's a lookup function and the chain it's searching.

{{focus: hash-step}} First, we hash the key and mod by the array length. That gives us the slot index — tells us which chain to check.

{{focus: walk-step}} Then we walk the chain at that slot. We start at the head and move forward one node at a time.

{{focus: compare-step}} {{focus: compare-step}} At each node, we compare the stored key to the one we're searching for. This is why we store keys alongside values — in a chain with multiple entries, the key is the only way to tell which one is the match.

{{focus: found-step}} If we find a match, we return its value immediately. No need to check the rest of the chain.

{{focus: miss-step}} If we reach the end of the chain without finding a match, the key isn't in the map. We return nothing. That's not an error — it just means nobody ever inserted that key.

{{focus: none}} The speed of this whole operation depends on chain length. If every chain has one entry, every lookup is one comparison. Two entries, two comparisons. As long as the hash function distributes keys evenly, this stays fast.

```code:get-fn lang=ts
function get(key: string): string | undefined {
  const index = hash(key) % buckets.length
  let current = buckets[index]
  while (current !== null) {
    if (current.key === key) return current.value
    current = current.next
  }
  return undefined
}
---
hash-step: 2
walk-step: 3, 4
compare-step: 5
found-step: 5
advance-step: 6
miss-step: 8
```

```data:get-chain type=linked-list
(frank Frank) -> (dana Dana) -> null
---
check-first: frank
check-second: dana
```

# Resizing

{{clear: slide}}

One more thing that keeps hash maps fast.

{{show: resize-fn}} As you insert more keys, chains get longer. Longer chains mean slower lookups.

{{focus: check-load}} {{focus: check-load}} To prevent this, hash maps track something called a load factor — the number of stored entries divided by the number of slots.

{{focus: grow}} When the load factor crosses a threshold — 0.75 is the standard choice — the map doubles its internal array.

{{focus: rehash}} {{focus: rehash}} Then it goes through every existing entry and rehashes it into the new, larger array. Different array size means different modulo results, so entries shuffle around to new positions.

This rehash touches every single entry. Sounds expensive. And it is — for that one operation. But here's why it works out: each doubling buys you room for as many new entries as you already have. The bigger the map gets, the longer it takes between doublings.

{{focus: none}} If you do the math, the average cost per insertion stays constant. Computer scientists call this amortized constant time. Any individual insert might be slow, but spread across all inserts, the average is tiny.

```code:resize-fn lang=ts
function resize() {
  if (size / buckets.length > 0.75) {
    const old = buckets
    buckets = new Array(old.length * 2)
    for (const chain of old) {
      for (const entry of chain) {
        const i = hash(entry.key) % buckets.length
        insert(i, entry)
      }
    }
  }
}
---
check-load: 2
grow: 4
rehash: 5, 6, 7, 8, 9
```

# The big picture

{{clear: fade}}

Here's why all of this matters.

{{split}} {{show: linear-arr}} {{show: hash-arr}} Compare the two approaches.

{{focus: linear-scan}} On the left, a plain array. Finding an element means starting at the front and checking each slot. The more data you have, the longer it takes. Double the data, double the search time.

{{focus: hash-jump}} {{focus: hash-jump}} On the right, a hash map. You compute one hash, jump to one slot, and check a tiny chain. Whether you have ten entries or ten million, that process takes about the same amount of time.

{{focus: none}} That's the difference between linear time and constant time.

Arrays are the right choice when you know the position of what you want — "give me the third item." Hash maps are the right choice when you know the name — "give me the entry for Bob."

Most real programs use both. Arrays for ordered sequences, hash maps for quick lookups by key. Understanding how they work under the hood helps you pick the right one and know what to expect from each.

```data:linear-arr type=array
["?", "?", "?", "?", "?", "?", "?", "?"]
---
linear-scan: 0, 1, 2, 3, 4, 5, 6, 7
```

```data:hash-arr type=array
[-, "found", -, -]
^hash=1
---
hash-jump: 1
empty-rest: 0, 2, 3
```
