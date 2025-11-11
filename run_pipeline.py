"""Run the complete RAG Jira pipeline from start to finish.

This orchestrator script runs all the steps needed to process Jira tickets
and prepare them for chatbot queries.

Usage::

    # Run the full pipeline
    python run_pipeline.py

    # Run specific steps only
    python run_pipeline.py --steps inspect,clean,index

    # Skip the chatbot and just build the index
    python run_pipeline.py --no-chatbot

    # Use custom input file
    python run_pipeline.py --input my_tickets.csv
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Optional


class PipelineRunner:
    """Orchestrates the RAG pipeline execution."""

    def __init__(
        self,
        input_file: str = "apt_tickets_complete_cleaned.csv",
        data_dir: str = "data",
        skip_chatbot: bool = False,
    ):
        self.input_file = Path(input_file)
        self.data_dir = Path(data_dir)
        self.skip_chatbot = skip_chatbot

        # Ensure data directory exists
        self.data_dir.mkdir(exist_ok=True)

    def print_step(self, step_num: int, total: int, description: str) -> None:
        """Print a formatted step header."""
        print("\n" + "=" * 80)
        print(f"STEP {step_num}/{total}: {description}")
        print("=" * 80 + "\n")

    def run_command(self, command: list[str], description: str) -> bool:
        """Run a shell command and return success status."""
        print(f"Running: {' '.join(command)}")
        print("-" * 80)

        try:
            result = subprocess.run(
                command,
                check=True,
                capture_output=False,
                text=True
            )
            print(f"\n✅ {description} completed successfully!")
            return True
        except subprocess.CalledProcessError as e:
            print(f"\n❌ {description} failed with error code {e.returncode}")
            return False
        except FileNotFoundError:
            print(f"\n❌ Command not found: {command[0]}")
            print("Make sure Python is installed and in your PATH")
            return False

    def step1_inspect(self) -> bool:
        """Step 1: Inspect the CSV file."""
        self.print_step(1, 5, "Inspect CSV File")

        if not self.input_file.exists():
            print(f"❌ Input file not found: {self.input_file}")
            print("\nPlease ensure your Jira export CSV is in the repository root.")
            return False

        return self.run_command(
            ["python", "step1_inspect_csv.py"],
            "CSV inspection"
        )

    def step2_clean(self) -> bool:
        """Step 2: Clean and prepare the text."""
        self.print_step(2, 5, "Clean Ticket Descriptions")

        return self.run_command(
            ["python", "step5_clean_descriptions.py"],
            "Text cleaning"
        )

    def step3_index(self) -> bool:
        """Step 3: Build the FAISS index."""
        self.print_step(3, 5, "Build FAISS Index")

        return self.run_command(
            ["python", "step3_build_index.py"],
            "Index building"
        )

    def step4_insights(self) -> bool:
        """Step 4: Generate insights (optional preview)."""
        self.print_step(4, 5, "Generate Insights (Preview)")

        print("NOTE: This step generates sample insights.")
        print("You can skip this if you just want to use the chatbot.\n")

        response = input("Run insight generation? [y/N]: ").strip().lower()

        if response in ["y", "yes"]:
            return self.run_command(
                ["python", "step4_generate_insights.py"],
                "Insight generation"
            )
        else:
            print("⏭️  Skipping insight generation")
            return True

    def step5_chatbot(self) -> bool:
        """Step 5: Launch the interactive chatbot."""
        self.print_step(5, 5, "Launch Interactive Chatbot")

        if self.skip_chatbot:
            print("⏭️  Chatbot launch skipped (--no-chatbot flag)")
            return True

        print("The chatbot is ready to launch!")
        print("\nYou can now query your Jira tickets using natural language.")
        print("Example questions:")
        print("  - What are the most common login issues?")
        print("  - Show me tickets about password reset")
        print("  - What problems are related to the API?\n")

        response = input("Launch chatbot now? [Y/n]: ").strip().lower()

        if response in ["", "y", "yes"]:
            print("\nLaunching chatbot...")
            print("(Type 'quit' or 'exit' to stop the chatbot)\n")

            # Run chatbot interactively
            try:
                subprocess.run(["python", "chatbot.py"], check=True)
                return True
            except subprocess.CalledProcessError:
                print("\n❌ Chatbot encountered an error")
                return False
            except KeyboardInterrupt:
                print("\n\nChatbot interrupted by user")
                return True
        else:
            print("\n✅ Pipeline complete! Run 'python chatbot.py' anytime to start the chatbot.")
            return True

    def run_full_pipeline(self, steps: Optional[list[str]] = None) -> bool:
        """Run the complete pipeline or selected steps."""
        print("=" * 80)
        print("RAG JIRA PIPELINE")
        print("=" * 80)
        print("\nThis script will guide you through processing your Jira tickets")
        print("and setting up the interactive chatbot.\n")

        # Define all steps
        all_steps = {
            "inspect": self.step1_inspect,
            "clean": self.step2_clean,
            "index": self.step3_index,
            "insights": self.step4_insights,
            "chatbot": self.step5_chatbot,
        }

        # Determine which steps to run
        if steps:
            steps_to_run = {k: v for k, v in all_steps.items() if k in steps}
        else:
            steps_to_run = all_steps

        # Run each step
        for step_name, step_func in steps_to_run.items():
            success = step_func()
            if not success:
                print(f"\n❌ Pipeline stopped due to failure in step: {step_name}")
                return False

        print("\n" + "=" * 80)
        print("PIPELINE COMPLETE!")
        print("=" * 80)
        print("\n✅ Your RAG Jira system is ready to use!")
        print("\nNext steps:")
        print("  - Run 'python chatbot.py' to start the interactive chatbot")
        print("  - Run 'python step5_rewrite_tickets.py' to improve ticket text")
        print("  - Check the 'data/' folder for generated files\n")

        return True


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--input",
        default="apt_tickets_complete_cleaned.csv",
        help="Input CSV file with Jira tickets",
    )
    parser.add_argument(
        "--data-dir",
        default="data",
        help="Directory for storing generated files",
    )
    parser.add_argument(
        "--steps",
        help="Comma-separated list of steps to run (inspect,clean,index,insights,chatbot)",
    )
    parser.add_argument(
        "--no-chatbot",
        action="store_true",
        help="Skip launching the chatbot at the end",
    )
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> None:
    """Main entry point."""
    args = parse_args(argv)

    # Parse steps if provided
    steps = None
    if args.steps:
        steps = [s.strip() for s in args.steps.split(",")]

    # Create and run pipeline
    runner = PipelineRunner(
        input_file=args.input,
        data_dir=args.data_dir,
        skip_chatbot=args.no_chatbot,
    )

    success = runner.run_full_pipeline(steps)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
