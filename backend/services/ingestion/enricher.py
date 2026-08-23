from typing import Dict, List, Sequence
from llama_index.core.extractors.interface import BaseExtractor
from llama_index.core.schema import BaseNode

class MTGSemanticExtractor(BaseExtractor):
    """
    Analyzes MTG cards and rulings using keyword matching
    """

    async def aextract(self, nodes: Sequence[BaseNode]) -> List[Dict]:
        return [self._extract_metadata(node) for node in nodes]

    def extract(self, nodes: Sequence[BaseNode]) -> List[Dict]:
        return [self._extract_metadata(node) for node in nodes]

    def _extract_metadata(self, node: BaseNode) -> Dict:
        if node.metadata.get("type") not in ["card", "ruling"]:
            return {}

        current_text = node.get_content().lower()
        if not current_text:
            return {"phases": [], "mechanics": []}

        phases = []
        mechanics = []

        # 1. Phase Detection (Rule-based)
        if "untap" in current_text: phases.append("Untap")
        if "upkeep" in current_text: phases.append("Upkeep")
        if "draw" in current_text: phases.append("Draw")
        if "combat" in current_text or "attack" in current_text or "block" in current_text: phases.append("Combat")
        if "end step" in current_text: phases.append("End Step")

        # 2. Mechanic Detection (MTG Syntax Rules)

        if ":" in current_text: mechanics.append("Activated Ability")
        # Triggered abilities always start with When, Whenever, or At
        if "whenever" in current_text or "when " in current_text or "at the beginning" in current_text: mechanics.append("Triggered Ability")
        # Replacement effects almost always use the word "instead"
        if "instead" in current_text: mechanics.append("Replacement Effect")

        return {
            "phases": phases,
            "mechanics": mechanics,
        }