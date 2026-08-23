import re
from typing import Sequence, Any
from llama_index.core.schema import TransformComponent, BaseNode


class MTGTextCleaner(TransformComponent):
    """Custom LlamaIndex Transformation to clean MTG syntax."""

    # Updated signature to perfectly match TransformComponent
    def __call__(self, nodes: Sequence[BaseNode], **kwargs: Any) -> Sequence[BaseNode]:
        for node in nodes:
            current_text = node.get_content()

            if not current_text:
                continue

            clean_text = re.sub(r'\(.*?\)', '', current_text)
            final_text = re.sub(r'\s+', ' ', clean_text).strip()

            node.set_content(final_text)

        return nodes