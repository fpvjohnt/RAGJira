"""Rewrite Jira ticket text for clarity.

This script cleans and rewrites descriptive ticket text so it can be
reused in summarisation or retrieval tasks.  It replaces lightweight
markdown, removes boilerplate phrases, and standardises headings into
plain sentences.

Usage examples::

    python step5_rewrite_tickets.py \
        --input data/jira_reference.csv \
        --output data/jira_reference_rewritten.csv

    python step5_rewrite_tickets.py --dry-run --limit 3

The script defaults to the ``Cleaned_Text`` column produced by the
cleaning pipeline, but it can fall back to ``text`` or any other column
specified with ``--source-column``.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd

# Columns we check (in order) when the user does not explicitly pass
# ``--source-column``.
DEFAULT_SOURCE_COLUMNS: tuple[str, ...] = ("Cleaned_Text", "text")


def rewrite_text(text: object) -> str:
    """Rewrite a ticket description into a concise paragraph.

    The function intentionally performs lightweight normalisation.  It is not
    meant to paraphrase the content, only to remove formatting artefacts and
    repetitive boilerplate that make the tickets harder to read.
    """

    value = "" if text is None else str(text)

    # Normalise whitespace and markdown artefacts.
    value = value.replace("\n", " ")
    value = re.sub(r"\[(?P<label>[^\]]+)\]\([^\)]+\)", r"\g<label>", value)
    value = re.sub(r"<[^>]+>", " ", value)  # HTML tags
    value = re.sub(r"[*•#_\-]+", " ", value)

    # Standardise common headings into plain sentences.
    replacements = {
        "Issue:": "The issue is",
        "Problem:": "The problem is",
        "Proposed Resolution:": "The proposed resolution is",
        "Resolution:": "The resolution is",
        "Status:": "Current status:",
        "Summary:": "Summary:",
    }
    for needle, replacement in replacements.items():
        value = value.replace(needle, replacement)

    # Remove greetings and support boilerplate.
    value = re.sub(
        r"\b(hello|hi|dear team|good (morning|afternoon)|thanks|thank you)\b[^.]*",
        "",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(
        r"(please provide|let me know if|do not hesitate|kind regards)[^.]*",
        "",
        value,
        flags=re.IGNORECASE,
    )

    # Collapse excess whitespace.
    value = re.sub(r"\s{2,}", " ", value)
    return value.strip()


def detect_source_column(df: "pd.DataFrame", candidates: Iterable[str]) -> str:
    """Return the first column in *candidates* present in *df*.

    Raises ``ValueError`` if none of the candidates exist.
    """

    for column in candidates:
        if column in df.columns:
            return column
    raise ValueError(
        "None of the candidate columns exist: " + ", ".join(candidates)
    )


def rewrite_dataframe(
    df: "pd.DataFrame",
    source_column: str,
    output_column: str,
    overwrite_source: bool,
) -> "pd.DataFrame":
    """Return a dataframe with the rewritten text attached."""

    if source_column not in df.columns:
        raise ValueError(f"Column '{source_column}' does not exist in the dataframe")

    rewritten = df[source_column].apply(rewrite_text)

    if overwrite_source:
        df[source_column] = rewritten
        return df

    df[output_column] = rewritten
    return df


def parse_args(argv: Optional[Iterable[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        default="data/jira_reference.csv",
        type=Path,
        help="CSV file containing ticket data",
    )
    parser.add_argument(
        "--output",
        default="data/jira_reference_rewritten.csv",
        type=Path,
        help="Destination CSV file",
    )
    parser.add_argument(
        "--source-column",
        default=None,
        help="Column containing the text to rewrite (defaults to Cleaned_Text)",
    )
    parser.add_argument(
        "--output-column",
        default="Rewritten_Text",
        help="Column name for the rewritten text when not overwriting the source",
    )
    parser.add_argument(
        "--overwrite-source",
        action="store_true",
        help="Replace the source column instead of adding a new one",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Number of preview rows to show when running with --dry-run",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview the rewritten text without writing a file",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Iterable[str]] = None) -> None:
    args = parse_args(argv)

    if not args.input.exists():
        raise SystemExit(f"❌ Input file not found: {args.input}")

    df = pd.read_csv(args.input)

    source_candidates = (
        [args.source_column]
        if args.source_column
        else DEFAULT_SOURCE_COLUMNS
    )

    try:
        source_column = detect_source_column(df, source_candidates)
    except ValueError as exc:  # pragma: no cover - defensive guard
        raise SystemExit(f"❌ {exc}") from exc

    result_df = rewrite_dataframe(
        df,
        source_column=source_column,
        output_column=args.output_column,
        overwrite_source=args.overwrite_source,
    )

    if args.dry_run:
        preview_columns = [source_column]
        if not args.overwrite_source:
            preview_columns.append(args.output_column)
        preview = result_df[preview_columns].head(args.limit).copy()
        print(preview)
        print("ℹ️ Dry run only – no file was written.")
        return

    args.output.parent.mkdir(parents=True, exist_ok=True)
    result_df.to_csv(args.output, index=False)
    print(
        "✅ Tickets rewritten for clearer language →",
        args.output,
    )


if __name__ == "__main__":
    main()
