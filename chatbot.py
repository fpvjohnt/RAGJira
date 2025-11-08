"""Interactive chatbot for querying Jira tickets using RAG.

This chatbot allows users to ask questions about their Jira tickets in natural
language. It uses the FAISS index to retrieve relevant tickets and generates
answers using a language model.

Usage examples::

    python chatbot.py

    python chatbot.py --index data/jira_index.faiss --reference data/jira_reference.csv

    python chatbot.py --model-name google/flan-t5-base
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional

import faiss
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer


class JiraChatbot:
    """Interactive chatbot for querying Jira tickets."""

    def __init__(
        self,
        index_path: str,
        reference_path: str,
        embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2",
        llm_model: str = "google/flan-t5-small",
        top_k: int = 3,
    ):
        """Initialize the chatbot with index and models.

        Args:
            index_path: Path to the FAISS index file
            reference_path: Path to the reference CSV file
            embedding_model: Name of the sentence transformer model
            llm_model: Name of the language model for generation
            top_k: Number of similar tickets to retrieve
        """
        self.top_k = top_k

        print(f"Loading FAISS index from {index_path}...")
        self.index = faiss.read_index(index_path)

        print(f"Loading reference data from {reference_path}...")
        self.reference_df = pd.read_csv(reference_path)

        print(f"Loading embedding model: {embedding_model}...")
        self.encoder = SentenceTransformer(embedding_model)

        print(f"Loading language model: {llm_model}...")
        self.tokenizer = AutoTokenizer.from_pretrained(llm_model)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(llm_model)

        print("\nChatbot ready! Type 'quit', 'exit', or 'q' to stop.\n")

    def retrieve_similar_tickets(self, query: str) -> pd.DataFrame:
        """Retrieve the most similar tickets for a given query.

        Args:
            query: User's question or search query

        Returns:
            DataFrame containing the top-k most similar tickets
        """
        query_vec = self.encoder.encode([query])
        distances, indices = self.index.search(query_vec.astype(np.float32), self.top_k)

        return self.reference_df.iloc[indices[0]].copy()

    def generate_answer(self, query: str, context_df: pd.DataFrame) -> str:
        """Generate an answer based on the query and retrieved tickets.

        Args:
            query: User's question
            context_df: DataFrame containing relevant tickets

        Returns:
            Generated answer as a string
        """
        # Build context from retrieved tickets
        context_parts = []
        for idx, row in context_df.iterrows():
            ticket_id = row.get("Key", row.get("key", f"Ticket {idx}"))
            text = row.get("Cleaned_Text", row.get("text", ""))
            summary = row.get("Summary", "")

            context_parts.append(
                f"Ticket {ticket_id}: {summary}\n{text[:300]}"
            )

        context = "\n\n".join(context_parts)

        # Create prompt for the model
        prompt = f"""Answer the question based on the following Jira tickets:

{context}

Question: {query}
Answer:"""

        # Generate response
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            max_length=512,
            truncation=True
        )

        outputs = self.model.generate(
            inputs.input_ids,
            max_length=150,
            num_beams=4,
            early_stopping=True,
            temperature=0.7
        )

        answer = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return answer

    def display_tickets(self, tickets_df: pd.DataFrame) -> None:
        """Display retrieved tickets in a readable format.

        Args:
            tickets_df: DataFrame containing tickets to display
        """
        print("\n" + "=" * 80)
        print("RELEVANT TICKETS:")
        print("=" * 80)

        for idx, row in tickets_df.iterrows():
            ticket_id = row.get("Key", row.get("key", f"Ticket {idx}"))
            summary = row.get("Summary", row.get("summary", "N/A"))
            status = row.get("Status", row.get("status", "N/A"))
            text = row.get("Cleaned_Text", row.get("text", ""))

            print(f"\n[{ticket_id}] {summary}")
            print(f"Status: {status}")
            print(f"Preview: {text[:200]}...")
            print("-" * 80)

    def chat(self) -> None:
        """Run the interactive chat loop."""
        print("=" * 80)
        print("JIRA TICKET CHATBOT")
        print("=" * 80)
        print("Ask questions about your Jira tickets!")
        print("Examples:")
        print("  - What are the most common login issues?")
        print("  - Show me tickets about password reset")
        print("  - What problems are related to the API?")
        print("=" * 80)

        while True:
            try:
                # Get user input
                user_input = input("\nYou: ").strip()

                # Check for exit commands
                if user_input.lower() in ["quit", "exit", "q", "bye"]:
                    print("\nGoodbye! Thank you for using the Jira Ticket Chatbot.")
                    break

                if not user_input:
                    continue

                # Retrieve similar tickets
                similar_tickets = self.retrieve_similar_tickets(user_input)

                # Display the tickets
                self.display_tickets(similar_tickets)

                # Generate answer
                print("\n" + "=" * 80)
                print("AI RESPONSE:")
                print("=" * 80)
                answer = self.generate_answer(user_input, similar_tickets)
                print(f"\n{answer}\n")

            except KeyboardInterrupt:
                print("\n\nInterrupted. Goodbye!")
                break
            except Exception as e:
                print(f"\nError: {e}")
                print("Please try again with a different question.")


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--index",
        default="data/jira_index.faiss",
        type=Path,
        help="Path to the FAISS index file",
    )
    parser.add_argument(
        "--reference",
        default="data/jira_reference.csv",
        type=Path,
        help="Path to the reference CSV file",
    )
    parser.add_argument(
        "--embedding-model",
        default="sentence-transformers/all-MiniLM-L6-v2",
        help="Sentence transformer model name",
    )
    parser.add_argument(
        "--llm-model",
        default="google/flan-t5-small",
        help="Language model for answer generation",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=3,
        help="Number of similar tickets to retrieve",
    )
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> None:
    """Main entry point for the chatbot."""
    args = parse_args(argv)

    # Check if files exist
    if not args.index.exists():
        print(f"Error: Index file not found: {args.index}")
        print("\nPlease run step3_build_index.py first to create the FAISS index.")
        sys.exit(1)

    if not args.reference.exists():
        print(f"Error: Reference file not found: {args.reference}")
        print("\nPlease ensure your reference CSV file exists.")
        sys.exit(1)

    # Initialize and run chatbot
    chatbot = JiraChatbot(
        index_path=str(args.index),
        reference_path=str(args.reference),
        embedding_model=args.embedding_model,
        llm_model=args.llm_model,
        top_k=args.top_k,
    )

    chatbot.chat()


if __name__ == "__main__":
    main()
