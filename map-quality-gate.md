# Map Quality Gate

Lumen maps should not feel like random outline cards. A good map node is concrete, editable, easy to ask about, and specific enough that a future source can brighten it.

## Quality Standard

Every generated map is checked against two layers:

- **Hard structure rules**: 3-5 clusters, 7-10 nodes, 1-3 nodes per cluster, no more than 14 links, and short labels.
- **Content rules**: avoid generic labels, avoid duplicate ideas, include concrete `why` and `startingQuestion` fields, include at least one mechanism or evidence node, include at least one debate or knowledge-gap node, and avoid too many isolated nodes.

Labels such as `overview`, `background`, `benefits`, `challenges`, `future`, `methods`, or their Chinese equivalents are treated as weak first-pass map nodes because they describe sections, not trackable knowledge.

## Confidence Level

The fast checker returns:

```json
{
  "confidence": "high",
  "score": 92,
  "shouldEvaluate": false,
  "issues": []
}
```

Confidence is derived from a simple penalty score:

- `high`: the map passes the fast checks with only minor or no issues.
- `medium`: the map is usable, but some nodes should be tightened later.
- `low`: the map is probably too generic, duplicated, incomplete, or structurally weak.

This check is synchronous and does not call an LLM, so normal map creation stays fast.

## Low-Confidence Evaluation

Only `low` confidence maps trigger an LLM quality repair pass. The repair pass runs at most once.

The evaluator receives the current map plus the fast-check issues and returns a repaired map seed. It is instructed to preserve the guiding question and good structure, while fixing weak labels, missing node kinds, thin `why` text, weak starting questions, and necessary links.

If the evaluator fails, Lumen keeps the original generated map and records the failed attempt in `seedMeta.quality.evaluator`. It does not create a fake placeholder.

## Demo Output

Final maps store quality metadata under:

```json
{
  "seedMeta": {
    "quality": {
      "confidence": "medium",
      "score": 76,
      "shouldEvaluate": false,
      "issues": [
        {
          "code": "generic_labels",
          "severity": "high",
          "message": "2 node labels are too generic.",
          "nodeIds": ["background", "future"]
        }
      ]
    }
  }
}
```

The demo shows the confidence level and up to three quality suggestions in the map's "At a glance" panel. Old maps without `seedMeta.quality` remain valid and simply do not show the quality badge.
